-- BAR-024 / BAR-133 — location scope is enforced, not merely carried.
--
-- The first live waste walkthrough exposed two parts of the same defect:
--
--   * the bootstrap admin has no fixed membership location, so `/waste` had no
--     location to record against even when opened from a specific bar; and
--   * `boa_bar_record_waste` accepted any active location at the venue from any
--     crew/warehouse/bar-lead caller. Passing a bar through the route without a
--     database check would therefore turn a usability fix into an authorisation
--     hole.
--
-- Global roles (manager/admin/auditor) may target any location. Scoped roles may
-- target only the location on their membership. Write RPCs still apply their own
-- role allow-list; this predicate only answers the location half. It remains an
-- internal command helper: the read-policy half of BAR-024 is still open.

begin;

create function private.boa_bar_can_access_location(p_venue_id uuid, p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.boa_bar_membership m
    join public.boa_bar_location l
      on l.id = p_location_id and l.venue_id = m.venue_id
    where m.venue_id = p_venue_id
      and m.user_id = auth.uid()
      and m.active
      and (
        m.role = any(array['manager','auditor','admin']::public.boa_bar_role[])
        or m.location_id = p_location_id
      )
  );
$$;

comment on function private.boa_bar_can_access_location(uuid, uuid) is
  'BAR-024. Global roles may target any venue location; scoped roles only their membership location. Internal to command RPCs.';

revoke all on function private.boa_bar_can_access_location(uuid, uuid) from public, anon, authenticated;

-- Waste is the first command brought under BAR-024. Other command RPCs remain
-- open under BAR-024 and are not claimed complete by this migration.
create or replace function public.boa_bar_record_waste(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_sku uuid := (p_payload->>'sku_id')::uuid;
  v_containers integer := (p_payload->>'containers')::integer;
  v_reason text := btrim(coalesce(p_payload->>'reason',''));
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_occurred timestamptz := coalesce((p_payload->>'occurred_at')::timestamptz, now());
  v_ml_per integer;
  v_on_hand bigint;
  v_movement uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised to record waste at this venue' using errcode = '42501';
  end if;
  if not private.boa_bar_can_access_location(v_venue, v_location) then
    raise exception 'not authorised to record waste at this location' using errcode = '42501';
  end if;

  select id into v_existing from public.boa_bar_movement
    where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('movement_id', v_existing, 'replayed', true);
  end if;

  if v_reason not in ('Breakage', 'Spillage', 'Foam / line loss', 'Refused pour', 'Other') then
    raise exception 'unknown waste reason %', coalesce(nullif(v_reason,''), '(empty)') using errcode = '22023';
  end if;

  if v_containers is null or v_containers <= 0 then
    raise exception 'waste must be at least one container' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.boa_bar_location l
    where l.id = v_location and l.venue_id = v_venue and l.active
  ) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;

  select ml_per_container into v_ml_per from public.boa_bar_sku
    where id = v_sku and venue_id = v_venue and active;
  if v_ml_per is null then
    raise exception 'no active SKU % at this venue', v_sku using errcode = '23503';
  end if;

  select coalesce(containers, 0) into v_on_hand from private.boa_bar_balance
    where venue_id = v_venue and location_id = v_location and sku_id = v_sku;
  if coalesce(v_on_hand, 0) < v_containers then
    raise exception 'cannot waste % containers; the location holds %', v_containers, coalesce(v_on_hand, 0)
      using errcode = '23514';
  end if;

  v_movement := private.boa_bar_post_movement(jsonb_build_object(
    'venue_id', v_venue,
    'idempotency_key', v_key,
    'kind', 'waste',
    'occurred_at', v_occurred,
    'source', coalesce(p_payload->>'source', 'pwa'),
    'reason', v_reason,
    'metadata', jsonb_build_object('reason_code', v_reason),
    'lines', jsonb_build_array(jsonb_build_object(
      'sku_id', v_sku,
      'location_id', v_location,
      'container_delta', -v_containers,
      'ml_delta', -(v_containers::bigint * v_ml_per)
    ))
  ), auth.uid());

  return jsonb_build_object('movement_id', v_movement, 'replayed', false);
end;
$$;

revoke all on function public.boa_bar_record_waste(jsonb) from public, anon;
grant execute on function public.boa_bar_record_waste(jsonb) to authenticated;

comment on function public.boa_bar_record_waste(jsonb) is
  'BAR-063/BAR-024/BAR-133. Waste against an authorised recording location, with the design reason vocabulary enforced.';

commit;

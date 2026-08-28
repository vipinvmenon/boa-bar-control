-- BAR-063 + the remainder of BAR-133 — waste is recorded against the bar that
-- recorded it.
--
-- Two defects being closed here.
--
-- BAR-133: `demo-store.tsx:353` posted EVERY waste to the location whose code is
-- `bar_3`, whichever bar the crew member was standing in. Bar 1's variance was
-- understated by exactly what Bar 3's was overstated, and both figures were
-- indefensible. The location now comes from the command and is validated against
-- the venue.
--
-- BAR-063: there was no waste write path at all beyond the generic movement RPC,
-- so nothing enforced the reason vocabulary. A free-text reason makes the waste
-- column useless for the excise return, which needs waste grouped by cause.
--
-- The vocabulary is the design's own, from design-script.jsx:308:
--   Breakage, Spillage, Foam / line loss, Refused pour, Other
-- It is enforced here rather than only in the UI, because "authorisation and
-- validation are enforced in the database" is the rule that makes the client a
-- convenience rather than a control.

begin;

create function public.boa_bar_record_waste(p_payload jsonb)
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

  select id into v_existing from public.boa_bar_movement
    where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('movement_id', v_existing, 'replayed', true);
  end if;

  -- The design's five reasons, and only those. Anything else and the waste column
  -- cannot be grouped by cause on the excise return.
  if v_reason not in ('Breakage', 'Spillage', 'Foam / line loss', 'Refused pour', 'Other') then
    raise exception 'unknown waste reason %', coalesce(nullif(v_reason,''), '(empty)') using errcode = '22023';
  end if;

  if v_containers is null or v_containers <= 0 then
    raise exception 'waste must be at least one container' using errcode = '23514';
  end if;

  -- BAR-133. The location is taken from the command and must belong to this
  -- venue. It is never defaulted to a particular bar.
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

  -- A bar cannot waste more than it holds. Where this fires the position is
  -- wrong, and quietly posting a negative position hides the error inside the
  -- variance report where it will be read as theft.
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
  'BAR-063/BAR-133. Waste against the recording location, with the design''s reason vocabulary enforced.';

commit;

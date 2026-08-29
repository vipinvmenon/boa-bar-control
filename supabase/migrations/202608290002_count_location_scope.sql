-- BAR-024 / BAR-082 — a count is opened and submitted only at an authorised
-- location.
--
-- The count implementations already enforce role, validation, idempotency,
-- sealing and recount semantics. Keep those bodies intact and put the shared
-- location boundary in public wrappers. The renamed implementations move to
-- `private` and are unreachable by client roles; only the wrappers may call
-- them. This avoids copying two long command bodies into a second source of
-- truth.

begin;

alter function public.boa_bar_open_count(jsonb)
  rename to boa_bar_open_count_unscoped;
alter function public.boa_bar_open_count_unscoped(jsonb)
  set schema private;

alter function public.boa_bar_submit_count(jsonb)
  rename to boa_bar_submit_count_unscoped;
alter function public.boa_bar_submit_count_unscoped(jsonb)
  set schema private;

revoke all on function private.boa_bar_open_count_unscoped(jsonb)
  from public, anon, authenticated;
revoke all on function private.boa_bar_submit_count_unscoped(jsonb)
  from public, anon, authenticated;

create function public.boa_bar_open_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_can_access_location(v_venue, v_location) then
    raise exception 'not authorised to count at this location' using errcode = '42501';
  end if;
  return private.boa_bar_open_count_unscoped(p_payload);
end;
$$;

create function public.boa_bar_submit_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_can_access_location(v_venue, v_location) then
    raise exception 'not authorised to count at this location' using errcode = '42501';
  end if;
  return private.boa_bar_submit_count_unscoped(p_payload);
end;
$$;

revoke all on function public.boa_bar_open_count(jsonb) from public, anon;
grant execute on function public.boa_bar_open_count(jsonb) to authenticated;
revoke all on function public.boa_bar_submit_count(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;

comment on function public.boa_bar_open_count(jsonb) is
  'BAR-024/BAR-161. Opens a blinded count only at a location the caller may operate.';
comment on function public.boa_bar_submit_count(jsonb) is
  'BAR-024/BAR-082/BAR-084. Submits and seals a blind count only at a location the caller may operate.';
comment on function private.boa_bar_open_count_unscoped(jsonb) is
  'Internal count implementation. The public location-scoped wrapper is the only client entry point.';
comment on function private.boa_bar_submit_count_unscoped(jsonb) is
  'Internal count implementation. The public location-scoped wrapper is the only client entry point.';

commit;

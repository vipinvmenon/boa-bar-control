-- BAR-141 — apply queued actor attribution to the dedicated command RPCs.
--
-- The command implementations already contain the domain validation. Renaming
-- them and placing a thin SECURITY DEFINER wrapper in front avoids copying those
-- bodies (and accidentally letting them drift). The wrapper validates the
-- replaying session and original actor, then changes the JWT subject only for the
-- duration of this transaction. `auth.uid()` in the existing implementation and
-- its internal movement call therefore resolves to the original actor.

begin;

alter function public.boa_bar_create_docket(jsonb) rename to boa_bar_create_docket_session_actor;
alter function public.boa_bar_accept_docket(jsonb) rename to boa_bar_accept_docket_session_actor;
alter function public.boa_bar_submit_count(jsonb) rename to boa_bar_submit_count_session_actor;
alter function public.boa_bar_record_waste(jsonb) rename to boa_bar_record_waste_session_actor;
alter function public.boa_bar_record_receipt(jsonb) rename to boa_bar_record_receipt_session_actor;

create function public.boa_bar_create_docket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid;
begin
  v_actor := private.boa_bar_queued_actor(p_payload, (p_payload->>'venue_id')::uuid);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  return public.boa_bar_create_docket_session_actor(p_payload);
end;
$$;

create function public.boa_bar_accept_docket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid;
  v_actor uuid;
begin
  select venue_id into v_venue from public.boa_bar_docket where id = nullif(p_payload->>'docket_id', '')::uuid;
  if v_venue is null then
    raise exception 'docket not found' using errcode = 'P0002';
  end if;
  v_actor := private.boa_bar_queued_actor(p_payload, v_venue);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  return public.boa_bar_accept_docket_session_actor(p_payload);
end;
$$;

create function public.boa_bar_submit_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid;
begin
  v_actor := private.boa_bar_queued_actor(p_payload, (p_payload->>'venue_id')::uuid);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  return public.boa_bar_submit_count_session_actor(p_payload);
end;
$$;

create function public.boa_bar_record_waste(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid;
begin
  v_actor := private.boa_bar_queued_actor(p_payload, (p_payload->>'venue_id')::uuid);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  return public.boa_bar_record_waste_session_actor(p_payload);
end;
$$;

create function public.boa_bar_record_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid;
begin
  v_actor := private.boa_bar_queued_actor(p_payload, (p_payload->>'venue_id')::uuid);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  return public.boa_bar_record_receipt_session_actor(p_payload);
end;
$$;

revoke all on function public.boa_bar_create_docket_session_actor(jsonb) from public, anon, authenticated;
revoke all on function public.boa_bar_accept_docket_session_actor(jsonb) from public, anon, authenticated;
revoke all on function public.boa_bar_submit_count_session_actor(jsonb) from public, anon, authenticated;
revoke all on function public.boa_bar_record_waste_session_actor(jsonb) from public, anon, authenticated;
revoke all on function public.boa_bar_record_receipt_session_actor(jsonb) from public, anon, authenticated;

grant execute on function public.boa_bar_create_docket(jsonb) to authenticated;
grant execute on function public.boa_bar_accept_docket(jsonb) to authenticated;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;
grant execute on function public.boa_bar_record_waste(jsonb) to authenticated;
grant execute on function public.boa_bar_record_receipt(jsonb) to authenticated;

comment on function public.boa_bar_create_docket(jsonb) is 'BAR-141. Creates a docket under the original queued actor.';
comment on function public.boa_bar_accept_docket(jsonb) is 'BAR-141. Accepts a docket under the original queued actor.';
comment on function public.boa_bar_submit_count(jsonb) is 'BAR-141. Submits a count under the original queued actor.';
comment on function public.boa_bar_record_waste(jsonb) is 'BAR-141. Records waste under the original queued actor.';
comment on function public.boa_bar_record_receipt(jsonb) is 'BAR-141. Records a receipt under the original queued actor.';

commit;

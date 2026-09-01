-- BAR-141 — preserve the person who performed a queued movement.
--
-- A device may enqueue a write while signed in as one staff member and replay it
-- after a shift handover. The actor is therefore carried in the durable payload,
-- but it is never trusted blindly: the replaying session and the original actor
-- must both still be active members of the venue.

begin;

create function private.boa_bar_queued_actor(p_payload jsonb, p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_actor uuid := coalesce(nullif(p_payload->>'actor_id', '')::uuid, v_caller);
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.boa_bar_membership m
    where m.venue_id = p_venue_id
      and m.user_id = v_caller
      and m.active
  ) then
    raise exception 'replaying user has no active membership at this venue' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.boa_bar_membership m
    where m.venue_id = p_venue_id
      and m.user_id = v_actor
      and m.active
  ) then
    raise exception 'original actor has no active membership at this venue' using errcode = '42501';
  end if;

  return v_actor;
exception
  when invalid_text_representation then
    raise exception 'actor_id must be a UUID' using errcode = '22023';
end;
$$;

revoke all on function private.boa_bar_queued_actor(jsonb, uuid) from public, anon, authenticated;

create or replace function public.boa_bar_submit_movement(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_actor uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;

  v_actor := private.boa_bar_queued_actor(p_payload, v_venue);
  return private.boa_bar_post_movement(p_payload, v_actor);
end;
$$;

revoke all on function public.boa_bar_submit_movement(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_movement(jsonb) to authenticated;

comment on function public.boa_bar_submit_movement(jsonb) is
  'BAR-141. Posts a queued movement under its original active venue member, while requiring an active replaying session.';

commit;

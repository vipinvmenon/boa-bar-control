-- BAR-144, and the half of BAR-143 that does not depend on how people sign in.
--
-- Today a membership can only be created by somebody who already holds one, and
-- only through the database password. Two consequences on the night:
--
--   * a bar lead arriving at 20:00 cannot be enrolled at all;
--   * when the manager leaves at 23:00, variance, reports and count sign-off leave
--     with them, because nobody can be promoted.
--
-- WHAT THIS DOES NOT DECIDE. How a person gets an auth session — magic link,
-- password, or anonymous — is an auth-model choice and it is the user's, not an
-- agent's. Everything here works with ANY of them: it binds an ALREADY signed-in
-- user to a named membership. Whatever is chosen later plugs in underneath.
--
-- Why an invite code rather than typing an email. At load-in, on congested
-- cellular, a manager reading a six-character code aloud works; looking up twenty
-- email addresses does not. The code also carries the person's NAME and ROLE, set
-- by the manager in advance, so the chain of custody has a real name from the
-- first movement rather than being backfilled later.

begin;

create table public.boa_bar_invite (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id) on delete cascade,
  -- Six characters, no O/0/I/1: this gets read aloud across a loading bay.
  code text not null,
  role public.boa_bar_role not null,
  location_id uuid references public.boa_bar_location(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  unique (venue_id, code)
);

comment on table public.boa_bar_invite is
  'Single-use, expiring codes that bind a signed-in user to a named membership (BAR-143/BAR-144).';

alter table public.boa_bar_invite enable row level security;

-- The code IS the secret, so only management may read the table. A claimant does
-- not read it — they present a code to an RPC, which is why claiming works without
-- any select privilege at all.
create policy boa_bar_invite_read on public.boa_bar_invite for select
  using (private.boa_bar_has_role(venue_id, array['manager','admin']::public.boa_bar_role[]));

revoke all on public.boa_bar_invite from anon, authenticated;
grant select on public.boa_bar_invite to authenticated;

-- ---------------------------------------------------------------------------
-- Creating an invite.
-- ---------------------------------------------------------------------------

create function public.boa_bar_create_invite(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_role public.boa_bar_role := (p_payload->>'role')::public.boa_bar_role;
  v_location uuid := nullif(p_payload->>'location_id','')::uuid;
  v_name text := btrim(coalesce(p_payload->>'display_name',''));
  v_hours integer := coalesce((p_payload->>'valid_hours')::integer, 24);
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
  v_try integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_has_role(v_venue, array['manager','admin']::public.boa_bar_role[]) then
    raise exception 'only a manager or admin may invite staff' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'an invite needs the person''s name' using errcode = '22023';
  end if;
  -- Only a manager or admin may create another one. Otherwise a bar lead could
  -- promote themselves by inviting a second account and claiming it.
  if v_role in ('manager','admin')
     and not private.boa_bar_has_role(v_venue, array['admin']::public.boa_bar_role[]) then
    raise exception 'only an admin may invite a manager or admin' using errcode = '42501';
  end if;
  if v_location is not null and not exists (
    select 1 from public.boa_bar_location l where l.id = v_location and l.venue_id = v_venue
  ) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;
  if v_hours < 1 or v_hours > 72 then
    raise exception 'an invite must be valid for between 1 and 72 hours' using errcode = '22023';
  end if;

  loop
    v_try := v_try + 1;
    v_code := (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into public.boa_bar_invite
        (venue_id, code, role, location_id, display_name, created_by, expires_at)
      values
        (v_venue, v_code, v_role, v_location, v_name, auth.uid(), now() + make_interval(hours => v_hours))
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 8 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('invite_id', v_id, 'code', v_code, 'display_name', v_name, 'role', v_role);
end;
$$;

revoke all on function public.boa_bar_create_invite(jsonb) from public, anon;
grant execute on function public.boa_bar_create_invite(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Claiming one.
-- ---------------------------------------------------------------------------

create function public.boa_bar_claim_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_invite public.boa_bar_invite;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Serialise on the code so two devices cannot claim the same invite.
  perform pg_advisory_xact_lock(hashtext('boa_bar_claim_invite:' || upper(btrim(coalesce(p_code,'')))));

  select * into v_invite from public.boa_bar_invite
    where code = upper(btrim(coalesce(p_code,'')));

  -- One message for "wrong code" and "already used", deliberately: distinguishing
  -- them turns this into an oracle for guessing valid codes.
  if v_invite.id is null or v_invite.claimed_by is not null then
    raise exception 'that code is not valid' using errcode = '42501';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'that code has expired; ask for a new one' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.boa_bar_membership m
    where m.venue_id = v_invite.venue_id and m.user_id = auth.uid() and m.active
  ) then
    raise exception 'this device already has access to that venue' using errcode = '23505';
  end if;

  insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
  values (v_invite.venue_id, auth.uid(), v_invite.role, v_invite.location_id, true);

  -- The name comes from the invite, set by the manager in advance, so the chain of
  -- custody carries a real name from the very first movement.
  insert into public.boa_bar_person (venue_id, user_id, display_name)
  values (v_invite.venue_id, auth.uid(), v_invite.display_name)
  on conflict (venue_id, user_id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.boa_bar_person_name_history (venue_id, user_id, previous_name, new_name, changed_by)
  values (v_invite.venue_id, auth.uid(), null, v_invite.display_name, auth.uid());

  update public.boa_bar_invite
    set claimed_by = auth.uid(), claimed_at = now()
    where id = v_invite.id;

  return jsonb_build_object(
    'venue_id', v_invite.venue_id,
    'role', v_invite.role,
    'display_name', v_invite.display_name
  );
end;
$$;

revoke all on function public.boa_bar_claim_invite(text) from public, anon;
grant execute on function public.boa_bar_claim_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Changing or revoking a role on site.
-- ---------------------------------------------------------------------------

create function public.boa_bar_set_membership(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_user uuid := (p_payload->>'user_id')::uuid;
  v_role public.boa_bar_role := nullif(p_payload->>'role','')::public.boa_bar_role;
  v_location uuid := nullif(p_payload->>'location_id','')::uuid;
  v_active boolean := coalesce((p_payload->>'active')::boolean, true);
  v_admins integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_has_role(v_venue, array['manager','admin']::public.boa_bar_role[]) then
    raise exception 'only a manager or admin may change a role' using errcode = '42501';
  end if;
  if v_role in ('manager','admin')
     and not private.boa_bar_has_role(v_venue, array['admin']::public.boa_bar_role[]) then
    raise exception 'only an admin may grant manager or admin' using errcode = '42501';
  end if;

  -- Locking every admin out of the venue mid-event would be unrecoverable from
  -- inside the app, so the last one cannot be removed or demoted.
  if not v_active or v_role is distinct from 'admin' then
    select count(*) into v_admins from public.boa_bar_membership
      where venue_id = v_venue and role = 'admin' and active and user_id <> v_user;
    if v_admins = 0 and exists (
      select 1 from public.boa_bar_membership
      where venue_id = v_venue and user_id = v_user and role = 'admin' and active
    ) then
      raise exception 'this is the last admin; promote somebody else first' using errcode = '23514';
    end if;
  end if;

  if v_active then
    if v_role is null then
      raise exception 'a role is required' using errcode = '22023';
    end if;
    update public.boa_bar_membership
      set active = false
      where venue_id = v_venue and user_id = v_user and active;
    insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
    values (v_venue, v_user, v_role, v_location, true)
    on conflict (venue_id, user_id, role, location_id) do update set active = true;
  else
    update public.boa_bar_membership
      set active = false
      where venue_id = v_venue and user_id = v_user;
  end if;

  return jsonb_build_object('user_id', v_user, 'role', v_role, 'active', v_active);
end;
$$;

revoke all on function public.boa_bar_set_membership(jsonb) from public, anon;
grant execute on function public.boa_bar_set_membership(jsonb) to authenticated;

commit;

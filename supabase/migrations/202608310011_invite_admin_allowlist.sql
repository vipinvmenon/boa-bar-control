-- BAR-143/BAR-144: only the two named operators may issue invitations.
-- The allowlist is checked against auth.users inside a SECURITY DEFINER function,
-- so hiding the Team control is only a convenience; the RPC remains authoritative.

begin;

create or replace function private.boa_bar_is_invite_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email, '')) in (
        'vipinmenon16@gmail.com',
        'salman@bangaloreopenair.com'
      )
  );
$$;

create or replace function public.boa_bar_can_invite()
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select private.boa_bar_is_invite_admin();
$$;

revoke all on function public.boa_bar_can_invite() from public, anon;
grant execute on function public.boa_bar_can_invite() to authenticated;

drop policy if exists boa_bar_invite_read on public.boa_bar_invite;
create policy boa_bar_invite_read on public.boa_bar_invite for select
  using (private.boa_bar_is_invite_admin());

-- Replace the role-based gate with the explicit operator allowlist.
create or replace function public.boa_bar_create_invite(p_payload jsonb)
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
  if not private.boa_bar_is_invite_admin() then
    raise exception 'only the designated BOA operators may invite staff' using errcode = '42501';
  end if;
  if not private.boa_bar_has_role(v_venue, array['manager','admin']::public.boa_bar_role[]) then
    raise exception 'invite operator is not a member of this venue' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'an invite needs the person''s name' using errcode = '22023';
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
    v_code := (select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.boa_bar_invite (venue_id, code, role, location_id, display_name, created_by, expires_at)
      values (v_venue, v_code, v_role, v_location, v_name, auth.uid(), now() + make_interval(hours => v_hours))
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

commit;

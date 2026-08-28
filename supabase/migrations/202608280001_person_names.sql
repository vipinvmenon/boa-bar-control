-- BAR-124 — person-name resolution.
--
-- Why this exists: `boa_bar_docket.issued_by` and `.accepted_by`,
-- `boa_bar_movement.actor_id` and `boa_bar_count_session.assigned_to` are all
-- `auth.users(id)`. `auth.users` is NOT readable by the `authenticated` role, so
-- until now there was no way for the app to turn any of those columns into a
-- name. Every custody screen in references/design-source/ shows two real names
-- ("ISSUED BY CHANDAN", "ACCEPTED BY RAHUL", "Lead: Aditi"), and the activity
-- ledger shows "CHANDAN → RAHUL". A chain of custody that reads "Authenticated
-- staff → Authenticated staff" documents nothing and is worthless to excise.
--
-- Scope deliberately narrow: a name, per venue, readable by co-members. No email,
-- no phone, no photo. Staff names are personal data and this repository is
-- private precisely because it carries them; there is no reason to put contact
-- details within reach of the browser bundle as well.

begin;

create table public.boa_bar_person (
  venue_id uuid not null references public.boa_bar_venue(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The full name as it should appear on a printed excise or settlement record.
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  -- What the design actually renders in a row: the first name alone. Generated,
  -- so the UI never has to split a string and two screens cannot disagree.
  short_name text generated always as (split_part(btrim(display_name), ' ', 1)) stored,
  updated_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

comment on table public.boa_bar_person is
  'Resolves auth.users.id to a display name, per venue. The only personal data the client may read (BAR-124).';
comment on column public.boa_bar_person.short_name is
  'First name, generated. The design renders first names; deriving this in the client let two screens disagree.';

alter table public.boa_bar_person enable row level security;

-- Readable by anyone holding any membership of the same venue. Names are needed
-- by every screen that shows a custody or ledger row, which is every role.
create policy boa_bar_person_read on public.boa_bar_person for select
  using (private.boa_bar_has_role(venue_id, enum_range(null::public.boa_bar_role)));

-- No write policy. As with every other table, writes go through a
-- SECURITY DEFINER RPC and the role holds no table-level write privilege.
revoke all on public.boa_bar_person from anon, authenticated;
grant select on public.boa_bar_person to authenticated;

-- ---------------------------------------------------------------------------
-- Setting a name.
-- ---------------------------------------------------------------------------
-- Two callers are legitimate: a person naming themselves at first sign-in, and a
-- manager naming crew who signed in on a shared device. Nobody else, and in
-- particular nobody may rename another person's completed custody record —
-- which is why the previous value is written to the ledger-adjacent audit trail
-- below rather than being silently overwritten.

create table public.boa_bar_person_name_history (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_name text,
  new_name text not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

comment on table public.boa_bar_person_name_history is
  'Append-only. A name appearing on a signed custody record must not be changeable without trace (BAR-124).';

alter table public.boa_bar_person_name_history enable row level security;

create policy boa_bar_person_name_history_read on public.boa_bar_person_name_history for select
  using (private.boa_bar_has_role(venue_id, array['manager','auditor','admin']::public.boa_bar_role[]));

create trigger boa_bar_person_name_history_immutable
  before update or delete on public.boa_bar_person_name_history
  for each row execute function private.boa_bar_reject_mutation();

revoke all on public.boa_bar_person_name_history from anon, authenticated;
grant select on public.boa_bar_person_name_history to authenticated;

create function public.boa_bar_set_person_name(p_venue_id uuid, p_display_name text, p_user_id uuid default null)
returns public.boa_bar_person
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_previous text;
  v_row public.boa_bar_person;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Naming yourself needs only membership. Naming somebody else needs management.
  if v_target = auth.uid() then
    if not private.boa_bar_has_role(p_venue_id, enum_range(null::public.boa_bar_role)) then
      raise exception 'not authorised for venue' using errcode = '42501';
    end if;
  elsif not private.boa_bar_has_role(p_venue_id, array['manager','admin']::public.boa_bar_role[]) then
    raise exception 'only a manager may name another person' using errcode = '42501';
  end if;

  -- The target must actually work at this venue. Otherwise this table becomes a
  -- way to write an arbitrary name against an arbitrary user id.
  if not exists (
    select 1 from public.boa_bar_membership m
    where m.venue_id = p_venue_id and m.user_id = v_target and m.active
  ) then
    raise exception 'no active membership for that person at this venue' using errcode = '23503';
  end if;

  if length(v_name) = 0 then
    raise exception 'a display name is required' using errcode = '22023';
  end if;
  if length(v_name) > 60 then
    raise exception 'display name is longer than 60 characters' using errcode = '22001';
  end if;

  select display_name into v_previous
  from public.boa_bar_person
  where venue_id = p_venue_id and user_id = v_target;

  if v_previous is distinct from v_name then
    insert into public.boa_bar_person_name_history (venue_id, user_id, previous_name, new_name, changed_by)
    values (p_venue_id, v_target, v_previous, v_name, auth.uid());
  end if;

  insert into public.boa_bar_person (venue_id, user_id, display_name)
  values (p_venue_id, v_target, v_name)
  on conflict (venue_id, user_id) do update
    set display_name = excluded.display_name, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.boa_bar_set_person_name(uuid, text, uuid) from public, anon;
grant execute on function public.boa_bar_set_person_name(uuid, text, uuid) to authenticated;

commit;

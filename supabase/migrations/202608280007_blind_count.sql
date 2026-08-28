-- BAR-161 / BAR-083 — blind counting enforced by the database.
--
-- Until now this was a UI convention. `boa_bar_inventory_snapshot` authorised on
-- `enum_range(null::public.boa_bar_role)` — every role — and returned every
-- location, so a bar lead's own device could fetch the expected position for the
-- bar it was about to count with one REST call and no UI involved. The word
-- "blind" appeared nowhere in the SQL. Non-negotiable 3 requires the database to
-- enforce it, and docs/SECURITY.md sets out exactly how.
--
-- WHY IT IS COUNT-SCOPED, NOT ROLE-SCOPED. Crew are allowed to see stock in
-- general; that is in the access tier. What they must not see is the expected
-- quantity for the location they are ACTIVELY COUNTING. A role gate cannot express
-- that, because the same person with the same role may legitimately read the same
-- bar's position ten minutes earlier and ten minutes later.
--
-- A CORRECTION TO THIS MORNING'S OWN WORK. BAR-082 gave
-- `boa_bar_submit_count` the job of creating the session at submit time, which
-- was simpler and worked offline — but it left NO open session to key this rule
-- on, and so removed the only hook the security model has. Opening a count is
-- therefore an explicit act again: `boa_bar_open_count` creates the draft, and
-- creating the draft is what blinds you. Submitting closes it.

begin;

-- ---------------------------------------------------------------------------
-- The predicate everything else hangs off.
-- ---------------------------------------------------------------------------

create function private.boa_bar_is_blinded(p_venue_id uuid, p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.boa_bar_count_session cs
    where cs.venue_id = p_venue_id
      and cs.location_id = p_location_id
      and cs.assigned_to = auth.uid()
      and cs.status = 'draft'
  );
$$;

comment on function private.boa_bar_is_blinded(uuid, uuid) is
  'True while the CALLER holds an open (draft) count session for this location. The single definition of "blinded" (BAR-161).';

revoke all on function private.boa_bar_is_blinded(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The snapshot withholds the location being counted.
-- ---------------------------------------------------------------------------

create or replace function public.boa_bar_inventory_snapshot(p_venue_id uuid)
returns table (
  location_id uuid,
  location_code text,
  location_name text,
  location_kind public.boa_bar_location_kind,
  sku_id uuid,
  sku_code text,
  sku_name text,
  category_key text,
  container_type text,
  ml_per_container integer,
  containers bigint,
  ml bigint,
  value_minor bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.boa_bar_has_role(p_venue_id, enum_range(null::public.boa_bar_role)) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;
  return query
    select l.id, l.code, l.name, l.kind, s.id, s.code, s.name, s.category_key,
      s.container_type, s.ml_per_container,
      coalesce(b.containers, 0), coalesce(b.ml, 0), coalesce(b.value_minor, 0),
      coalesce(b.updated_at, '-infinity'::timestamptz)
    from public.boa_bar_location l
    cross join public.boa_bar_sku s
    left join private.boa_bar_balance b
      on b.venue_id = p_venue_id and b.location_id = l.id and b.sku_id = s.id
    where l.venue_id = p_venue_id and s.venue_id = p_venue_id and l.active and s.active
      -- BAR-161. The location the caller is counting is omitted entirely, rather
      -- than returned as zero: a zero row is itself a claim about the position,
      -- and a counter who saw zeroes would reasonably enter zeroes.
      and not private.boa_bar_is_blinded(p_venue_id, l.id)
    order by l.code, s.code;
end;
$$;

revoke all on function public.boa_bar_inventory_snapshot(uuid) from public, anon;
grant execute on function public.boa_bar_inventory_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Raw ledger reads cannot reconstruct the blinded position either.
-- ---------------------------------------------------------------------------
-- Withholding the snapshot alone would be theatre: `boa_bar_movement_line` is
-- readable by every role, so a counter could sum the deltas for their own bar and
-- arrive at the same figure. docs/SECURITY.md requirement 2.

drop policy if exists boa_bar_movement_line_read on public.boa_bar_movement_line;

create policy boa_bar_movement_line_read on public.boa_bar_movement_line for select
  using (
    exists (
      select 1 from public.boa_bar_movement m
      where m.id = movement_id
        and private.boa_bar_has_role(m.venue_id, enum_range(null::public.boa_bar_role))
        and not private.boa_bar_is_blinded(m.venue_id, boa_bar_movement_line.location_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Opening a count — the act that blinds you.
-- ---------------------------------------------------------------------------

create function public.boa_bar_open_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_kind text := coalesce(nullif(p_payload->>'count_kind',''), 'mid_event');
  v_session uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised to count at this venue' using errcode = '42501';
  end if;
  if v_kind not in ('opening_warehouse','opening_bar','mid_event','close_out') then
    raise exception 'unknown count kind %', v_kind using errcode = '22023';
  end if;
  if not exists (select 1 from public.boa_bar_location l where l.id = v_location and l.venue_id = v_venue and l.active) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;

  -- Reuse an open one rather than stacking drafts: reopening the screen after a
  -- reload must continue the same count, not start a rival one.
  select id into v_session from public.boa_bar_count_session
    where venue_id = v_venue and location_id = v_location
      and assigned_to = auth.uid() and status = 'draft'
    order by created_at desc limit 1;

  if v_session is null then
    insert into public.boa_bar_count_session (venue_id, location_id, count_kind, status, assigned_to)
    values (v_venue, v_location, v_kind, 'draft', auth.uid())
    returning id into v_session;
  end if;

  return jsonb_build_object('count_session_id', v_session, 'blinded', true);
end;
$$;

revoke all on function public.boa_bar_open_count(jsonb) from public, anon;
grant execute on function public.boa_bar_open_count(jsonb) to authenticated;

comment on function public.boa_bar_open_count(jsonb) is
  'BAR-161. Opens a draft count session. Creating the draft is what blinds the caller to that location''s position.';

-- ---------------------------------------------------------------------------
-- 4. Submitting closes the open session rather than creating a second one.
-- ---------------------------------------------------------------------------

create or replace function public.boa_bar_submit_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_kind text := coalesce(nullif(p_payload->>'count_kind',''), 'mid_event');
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_occurred timestamptz := coalesce((p_payload->>'occurred_at')::timestamptz, now());
  v_session uuid;
  v_existing uuid;
  v_business_date date;
  v_line jsonb;
  v_sku_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised to count at this venue' using errcode = '42501';
  end if;

  select id into v_existing from public.boa_bar_count_session
    where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('count_session_id', v_existing, 'replayed', true);
  end if;

  if v_kind not in ('opening_warehouse','opening_bar','mid_event','close_out') then
    raise exception 'unknown count kind %', v_kind using errcode = '22023';
  end if;
  if not exists (select 1 from public.boa_bar_location l where l.id = v_location and l.venue_id = v_venue) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;
  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'a count needs at least one line' using errcode = '22023';
  end if;
  if v_occurred > now() + interval '1 hour' then
    raise exception 'occurred_at is in the future; check the device clock' using errcode = '22023';
  end if;

  v_business_date := private.boa_bar_business_date(v_venue, v_occurred);
  if v_business_date is null then
    raise exception 'unknown venue %', v_venue using errcode = '23503';
  end if;

  -- BAR-161. Close the caller's OPEN session for this location if there is one.
  -- The draft is what blinded them, so submitting is what lifts it, and the
  -- session that recorded the blind period is the session the count belongs to.
  select id into v_session from public.boa_bar_count_session
    where venue_id = v_venue and location_id = v_location
      and assigned_to = auth.uid() and status = 'draft'
    order by created_at desc limit 1;

  if v_session is null then
    insert into public.boa_bar_count_session
      (venue_id, location_id, count_kind, status, assigned_to, submitted_at, idempotency_key, business_date)
    values
      (v_venue, v_location, v_kind, 'submitted', auth.uid(), v_occurred, v_key, v_business_date)
    returning id into v_session;
  else
    update public.boa_bar_count_session
      set status = 'submitted',
          submitted_at = v_occurred,
          idempotency_key = v_key,
          business_date = v_business_date,
          count_kind = v_kind
      where id = v_session;
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    v_sku_id := (v_line->>'sku_id')::uuid;
    if not exists (select 1 from public.boa_bar_sku s where s.id = v_sku_id and s.venue_id = v_venue and s.active) then
      raise exception 'no active SKU % at this venue', v_line->>'sku_id' using errcode = '23503';
    end if;
    if (v_line->>'full_containers')::integer < 0 or coalesce((v_line->>'partial_ml')::integer, 0) < 0 then
      raise exception 'a counted quantity cannot be negative' using errcode = '23514';
    end if;
    if exists (select 1 from public.boa_bar_count_line where count_session_id = v_session and sku_id = v_sku_id) then
      raise exception 'the same SKU appears twice in this count' using errcode = '23505';
    end if;

    insert into public.boa_bar_count_line
      (count_session_id, sku_id, full_containers, partial_ml, gross_weight_g, evidence)
    values (
      v_session, v_sku_id,
      (v_line->>'full_containers')::integer,
      coalesce((v_line->>'partial_ml')::integer, 0),
      nullif(v_line->>'gross_weight_g','')::numeric,
      coalesce(v_line->'evidence','{}'::jsonb)
    );
    v_count := v_count + 1;
  end loop;

  -- BAR-084. Seal the expected position from the ledger, as at the moment counted.
  insert into private.boa_bar_count_seal (count_session_id, sku_id, expected_containers, expected_ml)
  select
    v_session,
    s.id,
    coalesce(sum(ml.container_delta), 0),
    coalesce(sum(ml.ml_delta), 0)
  from public.boa_bar_sku s
  left join public.boa_bar_movement_line ml on ml.sku_id = s.id and ml.location_id = v_location
  left join public.boa_bar_movement m on m.id = ml.movement_id and m.venue_id = v_venue and m.occurred_at <= v_occurred
  where s.venue_id = v_venue
    and s.id in (select sku_id from public.boa_bar_count_line where count_session_id = v_session)
    and (ml.id is null or m.id is not null)
  group by s.id
  on conflict (count_session_id, sku_id) do nothing;

  return jsonb_build_object(
    'count_session_id', v_session,
    'lines', v_count,
    'business_date', v_business_date,
    'replayed', false
  );
end;
$$;

revoke all on function public.boa_bar_submit_count(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;

commit;

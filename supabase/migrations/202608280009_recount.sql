-- BAR-145 — a way to fix a bad count during the event.
--
-- A crew member types 110 instead of 11 and submits. There is no edit, no
-- recount, no void, no adjustment — so the choice is a knowingly false record or
-- abandoning the app mid-event. Both are worse than the typo.
--
-- WHY NOT AN EDIT. The same reasoning as the ledger: a count is evidence of what
-- somebody observed at a moment, with their name against it. Letting that row be
-- rewritten destroys the only thing that made it worth collecting, and it would
-- let a variance be tuned after the fact by whoever disliked it. So a correction
-- is a NEW count that supersedes the old one, and the original stays exactly as it
-- was submitted.
--
-- No enum value is added. Superseded-ness is a link, not a status: the old session
-- keeps `status = 'submitted'` because that is what happened, and carries
-- `superseded_by_session_id`. A status change would overwrite the fact that it was
-- once the live count.

begin;

alter table public.boa_bar_count_session
  add column supersedes_session_id uuid references public.boa_bar_count_session(id),
  add column superseded_by_session_id uuid references public.boa_bar_count_session(id),
  -- Why the recount was needed, in the counter's own words. The excise return does
  -- not care; the next morning's review does.
  add column supersede_reason text,
  add constraint boa_bar_count_session_not_self_superseding
    check (supersedes_session_id is null or supersedes_session_id <> id);

create index boa_bar_count_session_live_idx
  on public.boa_bar_count_session (venue_id, location_id, submitted_at desc)
  where superseded_by_session_id is null;

comment on column public.boa_bar_count_session.superseded_by_session_id is
  'Set when a later count replaces this one (BAR-145). The row itself is never edited — a superseded count remains exactly as it was submitted.';

-- ---------------------------------------------------------------------------
-- The observed quantities are append-only.
-- ---------------------------------------------------------------------------
-- Without this, "corrections are recounts" is a convention rather than a rule, and
-- the cheapest way to fix a count would still be to UPDATE the row.

-- A dedicated message rather than reusing private.boa_bar_reject_mutation, whose
-- text is "BOA bar ledger rows are immutable; post an adjustment instead". A count
-- line is not a ledger row and the remedy is not an adjustment — it is a recount.
-- An error that names the wrong remedy sends the reader looking for a feature that
-- does not exist.
create function private.boa_bar_reject_count_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'a submitted count cannot be edited; submit a recount instead'
    using errcode = '55000';
end;
$$;

revoke all on function private.boa_bar_reject_count_mutation() from public, anon, authenticated;

create trigger boa_bar_count_line_immutable
  before update or delete on public.boa_bar_count_line
  for each row execute function private.boa_bar_reject_count_mutation();

-- The session row still needs UPDATE — draft becomes submitted, and a superseded
-- link gets set — but the facts of who counted what, where, must not move.
create function private.boa_bar_guard_count_session()
returns trigger language plpgsql as $$
begin
  if new.venue_id <> old.venue_id
     or new.location_id <> old.location_id
     or new.assigned_to <> old.assigned_to then
    raise exception 'a count cannot be moved to another location or person; submit a recount instead'
      using errcode = '55000';
  end if;
  -- Once a count is sealed its instant is fixed. Moving it would move the
  -- position it was judged against, which is the whole basis of its variance.
  if old.submitted_at is not null and new.submitted_at <> old.submitted_at then
    raise exception 'a submitted count cannot be re-stamped; submit a recount instead'
      using errcode = '55000';
  end if;
  if old.superseded_by_session_id is not null
     and new.superseded_by_session_id <> old.superseded_by_session_id then
    raise exception 'this count has already been superseded' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger boa_bar_count_session_guard
  before update on public.boa_bar_count_session
  for each row execute function private.boa_bar_guard_count_session();

-- ---------------------------------------------------------------------------
-- Submitting a recount.
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
  v_supersedes uuid := nullif(p_payload->>'supersedes_session_id','')::uuid;
  v_reason text := nullif(btrim(coalesce(p_payload->>'supersede_reason','')), '');
  v_session uuid;
  v_existing uuid;
  v_business_date date;
  v_line jsonb;
  v_sku_id uuid;
  v_count integer := 0;
  v_prev public.boa_bar_count_session;
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

  -- BAR-145. Validate what is being replaced BEFORE writing anything.
  if v_supersedes is not null then
    select * into v_prev from public.boa_bar_count_session where id = v_supersedes;
    if v_prev.id is null then
      raise exception 'the count being replaced does not exist' using errcode = '23503';
    end if;
    if v_prev.venue_id <> v_venue or v_prev.location_id <> v_location then
      raise exception 'a recount must replace a count of the same location' using errcode = '23514';
    end if;
    if v_prev.submitted_at is null then
      raise exception 'that count was never submitted; there is nothing to replace' using errcode = '23514';
    end if;
    if v_prev.superseded_by_session_id is not null then
      raise exception 'that count has already been replaced by a later one' using errcode = '23514';
    end if;
    -- A recount says the earlier observation was wrong. Saying why is the whole
    -- value of the record to the next morning's review.
    if v_reason is null then
      raise exception 'a recount needs a reason' using errcode = '22023';
    end if;
  end if;

  v_business_date := private.boa_bar_business_date(v_venue, v_occurred);
  if v_business_date is null then
    raise exception 'unknown venue %', v_venue using errcode = '23503';
  end if;

  select id into v_session from public.boa_bar_count_session
    where venue_id = v_venue and location_id = v_location
      and assigned_to = auth.uid() and status = 'draft'
    order by created_at desc limit 1;

  if v_session is null then
    insert into public.boa_bar_count_session
      (venue_id, location_id, count_kind, status, assigned_to, submitted_at,
       idempotency_key, business_date, supersedes_session_id, supersede_reason)
    values
      (v_venue, v_location, v_kind, 'submitted', auth.uid(), v_occurred,
       v_key, v_business_date, v_supersedes, v_reason)
    returning id into v_session;
  else
    update public.boa_bar_count_session
      set status = 'submitted',
          submitted_at = v_occurred,
          idempotency_key = v_key,
          business_date = v_business_date,
          count_kind = v_kind,
          supersedes_session_id = v_supersedes,
          supersede_reason = v_reason
      where id = v_session;
  end if;

  if v_supersedes is not null then
    update public.boa_bar_count_session
      set superseded_by_session_id = v_session
      where id = v_supersedes;
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
    'supersedes_session_id', v_supersedes,
    'replayed', false
  );
end;
$$;

revoke all on function public.boa_bar_submit_count(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;

commit;

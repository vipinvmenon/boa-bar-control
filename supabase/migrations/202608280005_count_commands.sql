-- BAR-082 + BAR-084 — counts are recorded, and the position they are judged
-- against is sealed at the moment they are submitted.
--
-- Until now `boa_bar_count_line` had no write path at all: no RPC, no grant,
-- nothing. The count screen collected a blind count and navigated to a
-- confirmation screen, discarding it. Phase 2 of the specification is
-- "accept, count (blind), waste", and a count that is not stored is not a count.
--
-- BAR-084 — why the seal exists. A variance report compares what was counted
-- against what the ledger says should have been there. If that expected figure is
-- recomputed whenever the report is opened, then any movement posted afterwards
-- silently changes a number somebody has already signed. The expected position is
-- therefore frozen when the count is submitted, and the report reads the frozen
-- figure.
--
-- The seal lives in `private`, unreachable by the client, because it IS the
-- expected position — the single thing a counting user must never see for the
-- location they are counting (non-negotiable 3). Sealing it in a crew-readable
-- table would defeat blind counting more comprehensively than any UI mistake.

begin;

-- Idempotency for the count command. One user action, one session, however many
-- times a flaky network makes the device retry.
alter table public.boa_bar_count_session
  add column idempotency_key uuid,
  add column business_date date;

create unique index boa_bar_count_session_idempotency_idx
  on public.boa_bar_count_session (venue_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.boa_bar_count_session.idempotency_key is
  'Identifies the user action that submitted this count, so a retry replays instead of creating a second count (BAR-069).';

create table private.boa_bar_count_seal (
  count_session_id uuid not null references public.boa_bar_count_session(id) on delete restrict,
  sku_id uuid not null references public.boa_bar_sku(id),
  expected_containers bigint not null,
  expected_ml bigint not null,
  sealed_at timestamptz not null default now(),
  primary key (count_session_id, sku_id)
);

comment on table private.boa_bar_count_seal is
  'The ledger-derived expected position at the instant a count was submitted (BAR-084). In `private` because it is the expected figure a counter must never see (non-negotiable 3).';

-- Append-only, like the ledger it is derived from. A seal that can be edited
-- after the fact is not a seal.
create trigger boa_bar_count_seal_immutable
  before update or delete on private.boa_bar_count_seal
  for each row execute function private.boa_bar_reject_mutation();

-- No grant of any kind. Only SECURITY DEFINER functions read it.
revoke all on private.boa_bar_count_seal from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- boa_bar_submit_count
-- ---------------------------------------------------------------------------
-- One call submits the whole count: it creates the session, writes the observed
-- lines, and seals the expected position. One command per user action, which is
-- what lets it be queued in the outbox and replayed safely offline.
--
-- It returns NO expected figures and no variance. A counting device must not be
-- able to learn the expected position by submitting and reading the reply.

create function public.boa_bar_submit_count(p_payload jsonb)
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

  -- Replay. Returns the same session rather than creating a second count, which
  -- would be indistinguishable from a genuine recount.
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

  insert into public.boa_bar_count_session
    (venue_id, location_id, count_kind, status, assigned_to, submitted_at, idempotency_key, business_date)
  values
    (v_venue, v_location, v_kind, 'submitted', auth.uid(), v_occurred, v_key, v_business_date)
  returning id into v_session;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    v_sku_id := (v_line->>'sku_id')::uuid;
    if not exists (select 1 from public.boa_bar_sku s where s.id = v_sku_id and s.venue_id = v_venue and s.active) then
      raise exception 'no active SKU % at this venue', v_line->>'sku_id' using errcode = '23503';
    end if;
    if (v_line->>'full_containers')::integer < 0 or (v_line->>'partial_ml')::integer < 0 then
      raise exception 'a counted quantity cannot be negative' using errcode = '23514';
    end if;

    -- Unique (count_session_id, sku_id) already forbids a duplicate line; this
    -- turns the constraint violation into a sentence.
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

  -- BAR-084 — seal the expected position, summed from the LEDGER up to the moment
  -- the count was taken. Deliberately not read from private.boa_bar_balance: that
  -- projection only holds the position *now*, and a count submitted from a queue
  -- an hour later must be judged against the position at the time it was counted.
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
  group by s.id;

  -- No expected figure, no variance, no total volume. A counting device learns
  -- nothing from this reply that it did not already type in.
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

comment on function public.boa_bar_submit_count(jsonb) is
  'BAR-082/BAR-084. Records a blind count and seals the ledger-derived expected position. Returns no expected figures.';

commit;

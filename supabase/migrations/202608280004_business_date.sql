-- BAR-123 (+ half of BAR-023) — the business date spans the festival night.
--
-- `business_date` was the IST calendar date and was supplied by the CLIENT. Two
-- consequences, both fatal to the audit:
--
--   1. The night splits at midnight. A close-out count at 01:30 belongs to the
--      10 October event but recorded as 11 October, so the identity
--      `opening + in − out − sold − comped − wasted = closing` cannot be closed
--      for the event. That identity is the entire product.
--   2. A device supplied the value, so a phone with a wrong clock — or anybody
--      willing to edit a queued payload — could move a movement to another day
--      and step around a count. History could be backdated around the very
--      control it was meant to be measured by.
--
-- Both are fixed the same way: the server derives it and ignores what the client
-- sent. A business day now starts at a configurable hour (06:00 by default), so
-- everything between load-in and the small hours of the following morning lands on
-- the event's own date.

begin;

alter table public.boa_bar_venue
  add column business_day_start_hour smallint not null default 6
    check (business_day_start_hour between 0 and 23);

comment on column public.boa_bar_venue.business_day_start_hour is
  'Hour, venue-local, at which the business day rolls over. 6 means a movement at 01:30 belongs to the previous date (BAR-123).';

create function private.boa_bar_business_date(p_venue_id uuid, p_occurred_at timestamptz)
returns date
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select (((p_occurred_at at time zone v.timezone) - make_interval(hours => v.business_day_start_hour))::date)
  from public.boa_bar_venue v
  where v.id = p_venue_id;
$$;

comment on function private.boa_bar_business_date(uuid, timestamptz) is
  'The business date for an instant, in the venue timezone, rolling over at the venue cutoff. The only place this is computed (BAR-123).';

revoke all on function private.boa_bar_business_date(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The poster now derives the date, and refuses a future timestamp.
-- ---------------------------------------------------------------------------

create or replace function private.boa_bar_post_movement(p_payload jsonb, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_kind public.boa_bar_movement_kind := (p_payload->>'kind')::public.boa_bar_movement_kind;
  v_occurred timestamptz := coalesce((p_payload->>'occurred_at')::timestamptz, now());
  v_business_date date;
  v_existing uuid;
  v_line jsonb;
  v_container_sum bigint := 0;
  v_ml_sum bigint := 0;
begin
  if p_actor is null then
    raise exception 'a movement must name its actor' using errcode = '28000';
  end if;

  -- A queued movement may legitimately be hours old: it was created offline and
  -- drained later, and its occurred_at is when the physical event happened. The
  -- FUTURE is the direction that cannot be legitimate, so only that is refused,
  -- with an hour of tolerance for ordinary clock skew.
  if v_occurred > now() + interval '1 hour' then
    raise exception 'occurred_at is in the future; check the device clock' using errcode = '22023';
  end if;

  -- Derived, never taken from the payload. See the file header.
  v_business_date := private.boa_bar_business_date(v_venue, v_occurred);
  if v_business_date is null then
    raise exception 'unknown venue %', v_venue using errcode = '23503';
  end if;

  select id into v_existing from public.boa_bar_movement where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'movement requires lines' using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    v_container_sum := v_container_sum + (v_line->>'container_delta')::bigint;
    v_ml_sum := v_ml_sum + (v_line->>'ml_delta')::bigint;
  end loop;
  if v_kind in ('issue','transfer','return') and (v_container_sum <> 0 or v_ml_sum <> 0) then
    raise exception 'custody movements must balance across locations' using errcode = '23514';
  end if;
  if v_kind = 'receipt' and v_ml_sum <= 0 then raise exception 'receipt must add stock' using errcode = '23514'; end if;
  if v_kind in ('sale','comp','waste') and v_ml_sum >= 0 then raise exception 'depletion must remove stock' using errcode = '23514'; end if;

  insert into public.boa_bar_movement (
    id, venue_id, idempotency_key, kind, business_date, occurred_at, actor_id, source,
    reason, docket_id, reverses_movement_id, metadata
  ) values (
    v_id, v_venue, v_key, v_kind, v_business_date, v_occurred, p_actor,
    coalesce(p_payload->>'source','pwa'),
    nullif(p_payload->>'reason',''), (p_payload->>'docket_id')::uuid,
    (p_payload->>'reverses_movement_id')::uuid, coalesce(p_payload->'metadata','{}'::jsonb)
  );

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    insert into public.boa_bar_movement_line (
      movement_id, sku_id, location_id, container_delta, ml_delta, value_delta_minor, evidence
    ) values (
      v_id, (v_line->>'sku_id')::uuid, (v_line->>'location_id')::uuid,
      (v_line->>'container_delta')::integer, (v_line->>'ml_delta')::bigint,
      coalesce((v_line->>'value_delta_minor')::bigint,0), coalesce(v_line->'evidence','{}'::jsonb)
    );
    insert into private.boa_bar_balance (venue_id, location_id, sku_id, containers, ml, value_minor, last_movement_id)
    values (v_venue, (v_line->>'location_id')::uuid, (v_line->>'sku_id')::uuid,
      (v_line->>'container_delta')::bigint, (v_line->>'ml_delta')::bigint,
      coalesce((v_line->>'value_delta_minor')::bigint,0), v_id)
    on conflict (venue_id, location_id, sku_id) do update set
      containers = boa_bar_balance.containers + excluded.containers,
      ml = boa_bar_balance.ml + excluded.ml,
      value_minor = boa_bar_balance.value_minor + excluded.value_minor,
      last_movement_id = excluded.last_movement_id,
      updated_at = now();
  end loop;
  return v_id;
exception when unique_violation then
  select id into v_existing from public.boa_bar_movement where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  raise;
end;
$$;

revoke all on function private.boa_bar_post_movement(jsonb, uuid) from public, anon, authenticated;

-- Opening stock reports the date it used; make it the same derivation rather than
-- a second copy of the rule.
create or replace function public.boa_bar_open_stock(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_occurred timestamptz := coalesce((p_payload->>'occurred_at')::timestamptz, now());
  v_date date;
  v_actor uuid := coalesce(auth.uid(), (p_payload->>'actor_id')::uuid);
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_sku public.boa_bar_sku;
  v_key uuid;
  v_movement uuid;
begin
  if v_venue is null or v_location is null then
    raise exception 'venue_id and location_id are required' using errcode = '22023';
  end if;

  if auth.uid() is not null then
    if not private.boa_bar_has_role(v_venue, array['warehouse','manager','admin']::public.boa_bar_role[]) then
      raise exception 'only warehouse, manager or admin may post opening stock' using errcode = '42501';
    end if;
  end if;

  if v_actor is null then
    raise exception 'actor_id is required when called without a session' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.boa_bar_membership m
    where m.venue_id = v_venue and m.user_id = v_actor and m.active
  ) then
    raise exception 'the actor holds no active membership at this venue' using errcode = '23503';
  end if;

  if not exists (select 1 from public.boa_bar_location l where l.id = v_location and l.venue_id = v_venue) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;

  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'opening stock requires lines' using errcode = '22023';
  end if;

  v_date := private.boa_bar_business_date(v_venue, v_occurred);
  if v_date is null then raise exception 'unknown venue %', v_venue using errcode = '23503'; end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    select * into v_sku from public.boa_bar_sku
      where venue_id = v_venue and code = (v_line->>'sku_code') and active;
    if v_sku.id is null then
      raise exception 'no active SKU with code % at this venue', v_line->>'sku_code' using errcode = '23503';
    end if;
    if (v_line->>'containers')::integer <= 0 then
      raise exception 'opening line for % must be positive; omit the SKU instead of opening it at zero', v_sku.code
        using errcode = '23514';
    end if;
    v_lines := v_lines || jsonb_build_object(
      'sku_id', v_sku.id,
      'location_id', v_location,
      'container_delta', (v_line->>'containers')::integer,
      'ml_delta', (v_line->>'containers')::bigint * v_sku.ml_per_container
    );
  end loop;

  v_key := md5('boa_bar_open_stock:' || v_venue::text || ':' || v_location::text || ':' || v_date::text)::uuid;

  v_movement := private.boa_bar_post_movement(jsonb_build_object(
    'venue_id', v_venue,
    'idempotency_key', v_key,
    'kind', 'receipt',
    'occurred_at', v_occurred,
    'source', coalesce(p_payload->>'source', 'bootstrap'),
    'reason', coalesce(nullif(p_payload->>'reason',''), 'Opening stock'),
    'metadata', jsonb_build_object('opening', true, 'lines', jsonb_array_length(v_lines)),
    'lines', v_lines
  ), v_actor);

  return jsonb_build_object(
    'movement_id', v_movement,
    'business_date', v_date,
    'lines', jsonb_array_length(v_lines),
    'idempotency_key', v_key
  );
end;
$$;

revoke all on function public.boa_bar_open_stock(jsonb) from public, anon;
grant execute on function public.boa_bar_open_stock(jsonb) to authenticated;

commit;

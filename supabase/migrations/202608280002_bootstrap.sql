-- BAR-156 (+ BAR-032) — make the system startable.
--
-- On a freshly migrated database every location reads zero and every writable
-- movement only *removes* stock, so the warehouse can never be loaded and the
-- system cannot be started at all. This migration closes that, and seeds the
-- reference data the app needs to render anything.
--
-- Why reference data lives in a MIGRATION and not in supabase/seed.sql:
-- `seed.sql` is applied by `supabase db reset` against a LOCAL database only. It
-- is never applied by `db push`, which is how the hosted project is deployed — so
-- the hosted project has had no venue, no location and no SKU since the schema was
-- applied on 27 August, which is why nothing has ever been verified against real
-- data. This is a single-event project with exactly one venue; its locations and
-- its bar list are reference data, not test fixtures. `seed.sql` is reduced to a
-- pointer at this file so there is one source of truth rather than two.
--
-- Three things are corrected in the previously seeded values, all found by reading
-- them against the live repository's formatting rules:
--
--   1. `container_type` was '650 ml bottle'. The column is the container TYPE;
--      the size is already in `ml_per_container`. Conflating them made the unit
--      render as '650 ML BOTTLES' and the spec line as
--      'Beer · 650 ml 650 ml bottle'.
--   2. Kingfisher's `units_per_case` was 12. The design shows 288 bottles as
--      '12 cases' and the docket states 24 per case, so 12 is wrong and would
--      have printed '24 cases' on an issue.
--   3. Five SKUs the design's catalogue shows were missing entirely (Bira,
--      Signature Rare, Smirnoff, Tonic Water, Soda).

begin;

-- ---------------------------------------------------------------------------
-- 1. One movement poster, three entry points.
-- ---------------------------------------------------------------------------
-- boa_bar_submit_movement took the actor from auth.uid() and did the validation,
-- the ledger insert and the balance upsert in one body. The opening-stock path
-- below needs the same insert and the same balance upsert, but has to be runnable
-- from a direct database session during bootstrap, when auth.uid() is null and no
-- signed-in user exists yet.
--
-- Copying those twenty lines would put two writers on private.boa_bar_balance,
-- and the projection disagreeing with the ledger is precisely the failure
-- non-negotiable 2 exists to prevent. So the body moves to one internal function
-- that takes the actor explicitly, and the public entry points pass it in.
-- boa_bar_submit_movement keeps its signature and its behaviour exactly.

create function private.boa_bar_post_movement(p_payload jsonb, p_actor uuid)
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
  v_existing uuid;
  v_line jsonb;
  v_container_sum bigint := 0;
  v_ml_sum bigint := 0;
begin
  if p_actor is null then
    raise exception 'a movement must name its actor' using errcode = '28000';
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
    v_id, v_venue, v_key, v_kind, (p_payload->>'business_date')::date,
    (p_payload->>'occurred_at')::timestamptz, p_actor, coalesce(p_payload->>'source','pwa'),
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

comment on function private.boa_bar_post_movement(jsonb, uuid) is
  'The only writer of the ledger and its balance projection. Public entry points supply the actor (BAR-156).';

create or replace function public.boa_bar_submit_movement(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;
  return private.boa_bar_post_movement(p_payload, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Claiming the venue — the first membership.
-- ---------------------------------------------------------------------------
-- A membership can only be created by someone who already holds one, and on a
-- fresh database nobody does. Something has to break that circle.
--
-- This does, exactly once: it grants the caller `admin` and records their name,
-- but ONLY while the venue has no active membership at all. The moment one exists
-- this function refuses forever, so the window is open only between applying this
-- migration and the first sign-in — both of which the operator controls.
--
-- The residual risk is real and worth stating: whoever signs in first during that
-- window becomes admin. Verify it is closed after bootstrap (the script does), and
-- treat a venue that has been sitting unclaimed as suspect.

create function public.boa_bar_claim_venue(p_venue_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(v_name) = 0 then
    raise exception 'a display name is required — an unnamed admin defeats the chain of custody' using errcode = '22023';
  end if;

  select id into v_venue from public.boa_bar_venue where code = p_venue_code;
  if v_venue is null then
    raise exception 'no venue with code %', p_venue_code using errcode = '23503';
  end if;

  -- Serialise, so two simultaneous claims cannot both see an empty venue.
  perform pg_advisory_xact_lock(hashtext('boa_bar_claim_venue:' || v_venue::text));

  if exists (select 1 from public.boa_bar_membership where venue_id = v_venue and active) then
    raise exception 'venue % is already claimed; a manager must grant further memberships', p_venue_code
      using errcode = '42501';
  end if;

  insert into public.boa_bar_membership (venue_id, user_id, role, active)
  values (v_venue, auth.uid(), 'admin', true);

  insert into public.boa_bar_person (venue_id, user_id, display_name)
  values (v_venue, auth.uid(), v_name)
  on conflict (venue_id, user_id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.boa_bar_person_name_history (venue_id, user_id, previous_name, new_name, changed_by)
  values (v_venue, auth.uid(), null, v_name, auth.uid());

  return jsonb_build_object('venue_id', v_venue, 'role', 'admin', 'display_name', v_name);
end;
$$;

revoke all on function public.boa_bar_claim_venue(text, text) from public, anon;
grant execute on function public.boa_bar_claim_venue(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Opening stock — BAR-156 proper.
-- ---------------------------------------------------------------------------
-- Opening stock is a `receipt` movement, not a magic starting quantity. That
-- matters: stock is derived by summing the ledger (non-negotiable 2), so a
-- starting position that did not enter through the ledger would be invisible to
-- every calculation and to the excise return.
--
-- The idempotency key is DERIVED, not supplied — from the venue, the location and
-- the business date. Running this twice on the same day therefore replays and
-- returns the same movement rather than doubling the warehouse, which is the
-- mistake an operator makes at 06:00 on load-in when they are not sure the first
-- run worked.

create function public.boa_bar_open_stock(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_date date := coalesce((p_payload->>'business_date')::date, (now() at time zone 'Asia/Kolkata')::date);
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

  -- A signed-in caller must hold a stock-handling role. A caller with no
  -- auth.uid() is a direct database session, which already required the database
  -- password; it must still name a real member as the actor, because an opening
  -- movement with no accountable person is not evidence of anything.
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

  -- Derived, so a nervous second run replays instead of doubling the warehouse.
  -- md5 returns 32 hex characters, which is directly castable to uuid. Chosen
  -- over an extension function so this needs no extension to be installed.
  v_key := md5('boa_bar_open_stock:' || v_venue::text || ':' || v_location::text || ':' || v_date::text)::uuid;

  v_movement := private.boa_bar_post_movement(jsonb_build_object(
    'venue_id', v_venue,
    'idempotency_key', v_key,
    'kind', 'receipt',
    'business_date', v_date,
    'occurred_at', coalesce(p_payload->>'occurred_at', now()::text),
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

comment on function public.boa_bar_open_stock(jsonb) is
  'BAR-156. Opening stock as a receipt movement through the ledger. Idempotency key derived from venue+location+business_date so a repeat run replays.';

-- ---------------------------------------------------------------------------
-- 4. Reference data — the venue, its locations and its catalogue.
-- ---------------------------------------------------------------------------
-- Idempotent and convergent: `do update` rather than `do nothing`, so re-running
-- this corrects a row that was seeded wrongly by the old supabase/seed.sql rather
-- than silently leaving it. That is what fixes the container_type and
-- units_per_case defects described at the top of this file.

insert into public.boa_bar_venue (id, code, name, event_date, timezone) values
  ('00000000-0000-4000-8000-000000000001', 'boa-2026', 'Bangalore Open Air 2026', '2026-10-10', 'Asia/Kolkata')
-- Conflict on the NATURAL key, not the surrogate id: a row already present under
-- a different id must converge, not raise a unique violation on (venue_id, code).
on conflict (code) do update set
  name = excluded.name, event_date = excluded.event_date, timezone = excluded.timezone;

insert into public.boa_bar_location (id, venue_id, code, name, kind) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'warehouse',        'Warehouse',          'warehouse'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'bar_1',            'Bar 1',              'bar'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'bar_2',            'Bar 2',              'bar'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'bar_3',            'Bar 3',              'bar'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'bar_4',            'Bar 4',              'bar'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'hospitality',      'Hospitality',        'hospitality'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'eddies_lounge',    'Eddie’s Lounge',     'lounge'),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'promoters_lounge', 'Promoter’s Lounge',  'lounge'),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', 'in_transit',       'In transit',         'in_transit')
on conflict (venue_id, code) do update set name = excluded.name, kind = excluded.kind;

-- The bars are named 'Bar 1'..'Bar 4' with no suffix, because the design renders
-- them as 'BAR 1'..'BAR 4' and the previous seed's 'Bar 1 · Main' would have put
-- 'BAR 1 · MAIN' on a card sized for six characters. Whether the four bars are
-- actually identical is open decision 2 — the schema is per-location either way.

-- container_type is the TYPE only. ml_per_container carries the size.
-- units_per_case: 24 for beer and mixers, 12 for spirits, 1 for a keg —
-- Kingfisher's 24 is stated on the design's own docket.
-- excise_category is PROVISIONAL, pending the return template (BAR-158). It is
-- populated rather than left NULL so the shape of the excise view can be built,
-- but the vocabulary will almost certainly change once the template is in hand.
insert into public.boa_bar_sku
  (id, venue_id, code, name, category_key, container_type, ml_per_container, units_per_case, tare_weight_g, excise_category, is_supplied) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'KF650',  'Kingfisher Premium', 'bottled_beer', 'bottle', 650,   24, null, 'beer',   true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'BUD500', 'Budweiser',          'bottled_beer', 'can',    500,   24, null, 'beer',   false),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'COR355', 'Corona Extra',       'bottled_beer', 'bottle', 355,   24, null, 'beer',   false),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', 'BIRA330','Bira 91 White',      'bottled_beer', 'can',    330,   24, null, 'beer',   false),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'STOK30', 'STOK Draught',       'draught_beer', 'keg',    30000,  1, null, 'beer',   true),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'OM750',  'Old Monk',           'spirits',      'bottle', 750,   12, 480,  'spirit', false),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001', 'SIG750', 'Signature Rare',     'spirits',      'bottle', 750,   12, 480,  'spirit', false),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000001', 'SMI750', 'Smirnoff No.21',     'spirits',      'bottle', 750,   12, 480,  'spirit', false),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'COKE300','Coca-Cola',          'mixers',       'bottle', 300,   24, null, null,     false),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000001', 'TON200', 'Tonic Water',        'mixers',       'bottle', 200,   24, null, null,     false),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'SOD300', 'Soda',               'mixers',       'bottle', 300,   24, null, null,     false)
on conflict (venue_id, code) do update set
  name = excluded.name,
  category_key = excluded.category_key,
  container_type = excluded.container_type,
  ml_per_container = excluded.ml_per_container,
  units_per_case = excluded.units_per_case,
  tare_weight_g = excluded.tare_weight_g,
  excise_category = excluded.excise_category,
  is_supplied = excluded.is_supplied;
-- Deliberately does NOT set `active = true`: converging a wrong value is one
-- thing, silently resurrecting an SKU somebody retired is another.

commit;

-- @proves: BEHAVIOURAL | hand-keyed sale movements are rejected
-- @proves: BEHAVIOURAL | movement lines cannot cross venue boundaries
-- @proves: BEHAVIOURAL | comps are balanced two-leg moves to hospitality
-- BAR-017 / BAR-018 / BAR-022 — the ledger's new movement invariants.

begin;
create extension if not exists pgtap;

select plan(6);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated',
        'movement-guards@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000c1', 'manager', null, true);

-- A second venue's rows make the scope check observable without depending on
-- another seeded venue being present in the hosted project.
insert into public.boa_bar_venue (id, code, name, event_date, timezone)
values ('00000000-0000-4000-8000-0000000000f1', 'GUARD', 'Guard Test Venue', current_date, 'Asia/Kolkata');
insert into public.boa_bar_location (id, venue_id, code, name, kind)
values ('00000000-0000-4000-8000-0000000000f2',
        '00000000-0000-4000-8000-0000000000f1', 'GUARD-WH', 'Guard Warehouse', 'warehouse');
-- BAR-166 note, 3 September 2026. `excise_category` became NOT NULL with a
-- foreign key in 202608310010, and this fixture had never been updated — so this
-- whole suite ERRORED before its first assertion, silently taking three
-- behavioural proofs (hand-keyed sales refused, cross-venue lines refused, comps
-- balanced) out of the gate. Found the first time the suite ran against the
-- hosted schema. A test that cannot run is not a test.
insert into public.boa_bar_sku
  (id, venue_id, code, name, category_key, excise_category, container_type, ml_per_container)
values ('00000000-0000-4000-8000-0000000000f3',
        '00000000-0000-4000-8000-0000000000f1', 'GUARD-SKU', 'Guard Beer',
        'bottled_beer', 'beer', 'bottle', 650);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '24000000-0000-4000-8000-000000000011',
       'kind', 'sale', 'source', 'pwa',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'location_id', '00000000-0000-4000-8000-000000000101',
         'container_delta', -1, 'ml_delta', -650)))) $$,
  '42501', 'sale movements must come from POS import',
  'a hand-keyed sale is rejected before it reaches the ledger'
);

select is(
  (select count(*)::integer from public.boa_bar_movement
   where idempotency_key = '24000000-0000-4000-8000-000000000011'),
  0,
  'the rejected sale writes no movement'
);

select throws_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '24000000-0000-4000-8000-000000000012',
       'kind', 'receipt', 'source', 'movement-guards',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-0000000000f3',
         'location_id', '00000000-0000-4000-8000-000000000101',
         'container_delta', 1, 'ml_delta', 650)))) $$,
  '23514', 'movement lines must use SKU and location from the movement venue',
  'a movement cannot reference a SKU from another venue'
);

select lives_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '24000000-0000-4000-8000-000000000013',
       'kind', 'comp', 'source', 'movement-guards',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201',
           'location_id', '00000000-0000-4000-8000-000000000101',
           'container_delta', -1, 'ml_delta', -650),
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201',
           'location_id', '00000000-0000-4000-8000-000000000106',
           'container_delta', 1, 'ml_delta', 650)))) $$,
  'a balanced comp can move stock to hospitality'
);
set constraints boa_bar_validate_comp immediate;
set constraints boa_bar_validate_comp deferred;

select is(
  (select coalesce(sum(ml_delta), 0)::bigint from public.boa_bar_movement_line
   where movement_id = (select id from public.boa_bar_movement
                        where idempotency_key = '24000000-0000-4000-8000-000000000013')),
  0::bigint,
  'the comp ledger legs net to zero millilitres'
);

select throws_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '24000000-0000-4000-8000-000000000014',
       'kind', 'comp', 'source', 'movement-guards',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'location_id', '00000000-0000-4000-8000-000000000101',
         'container_delta', -1, 'ml_delta', -650)))) $$,
  '23514', 'custody movements must balance across locations',
  'an unbalanced comp is rejected'
);

select * from finish();
rollback;

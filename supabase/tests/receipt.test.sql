-- @proves: BEHAVIOURAL | Posts real deliveries and asserts the ledger and the
-- @proves: BEHAVIOURAL | balance projection move together. Proves the duplicate
-- @proves: BEHAVIOURAL | delivery-note guard, which no idempotency key can catch.
--
-- BAR-060 — recording a delivery.
--
-- The assertion worth having here is the duplicate guard. An idempotency key stops
-- one submission posting twice; it cannot stop a person entering the same pallet
-- twice twenty minutes apart, because that is genuinely two actions. On a busy
-- load-in that mistake silently inflates the warehouse and resurfaces later as
-- unexplained shrinkage.
--
-- Runs as the migration owner with a JWT claim set, so the security-definer
-- functions see a real caller. Everything is rolled back.

begin;
create extension if not exists pgtap;

select plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1',
        'authenticated', 'authenticated', 'warehouse@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, active)
values ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000c1', 'warehouse', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

select lives_ok(
  $$ select public.boa_bar_record_receipt(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000101',
       'idempotency_key', '55555555-5555-4555-8555-555555555555',
       'supplier', 'STOK',
       'delivery_note', 'STK-2261',
       'lines', jsonb_build_array(
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 144),
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000204', 'containers', 6)))) $$,
  'a two-line delivery is recorded'
);

-- Stock is derived by summing the ledger, so that is what is asserted — not the
-- projection alone, which is only a cache of it.
select is(
  (select sum(container_delta) from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.metadata->>'delivery_note' = 'STK-2261'
     and ml.sku_id = '00000000-0000-4000-8000-000000000201'),
  144::bigint,
  'the ledger holds the delivered quantity'
);

select is(
  (select containers from private.boa_bar_balance
   where location_id = '00000000-0000-4000-8000-000000000101'
     and sku_id = '00000000-0000-4000-8000-000000000204'),
  6::bigint,
  'and the projection agrees with it'
);

-- Volume is derived from the SKU, never supplied by the caller: a container count
-- and a volume that disagree is a corrupt receipt.
select is(
  (select ml.ml_delta from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.metadata->>'delivery_note' = 'STK-2261'
     and ml.sku_id = '00000000-0000-4000-8000-000000000204'),
  180000::bigint,
  'volume is derived from the SKU (6 kegs x 30 L)'
);

-- THE ASSERTION THIS TEST EXISTS FOR.
select throws_ok(
  $$ select public.boa_bar_record_receipt(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000101',
       'idempotency_key', '66666666-6666-4666-8666-666666666666',
       'supplier', 'STOK',
       'delivery_note', 'STK-2261',
       'lines', jsonb_build_array(
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 144)))) $$,
  '23505',
  -- The message names the note, the supplier and the instant of the first
  -- recording, so it cannot be matched literally. The SQLSTATE is the contract;
  -- the prose is for the person at load-in.
  null::text,
  'the same delivery note cannot be recorded twice'
);

select throws_ok(
  $$ select public.boa_bar_record_receipt(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000101',
       'idempotency_key', '77777777-7777-4777-8777-777777777777',
       'supplier', 'STOK',
       'lines', jsonb_build_array(
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 12)))) $$,
  '22023',
  'a delivery needs its delivery note or invoice number',
  'a delivery without a note is refused'
);

select throws_ok(
  $$ select public.boa_bar_record_receipt(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000101',
       'idempotency_key', '88888888-8888-4888-8888-888888888888',
       'supplier', 'STOK', 'delivery_note', 'STK-9001',
       'lines', jsonb_build_array(
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 12),
         jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 12)))) $$,
  '23505',
  'the same product appears twice on this delivery',
  'a duplicated product line is refused'
);

-- Replay of the SAME action is success, not a second delivery.
select is(
  (select (public.boa_bar_record_receipt(jsonb_build_object(
     'venue_id', '00000000-0000-4000-8000-000000000001',
     'location_id', '00000000-0000-4000-8000-000000000101',
     'idempotency_key', '55555555-5555-4555-8555-555555555555',
     'supplier', 'STOK', 'delivery_note', 'STK-2261',
     'lines', jsonb_build_array(
       jsonb_build_object('sku_id', '00000000-0000-4000-8000-000000000201', 'containers', 144)))))->>'replayed'),
  'true',
  'replaying the same submission returns the original rather than doubling it'
);

select * from finish();
rollback;

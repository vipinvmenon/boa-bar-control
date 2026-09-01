-- @proves: BEHAVIOURAL | The movement and movement-line ledger is append-only.
-- @proves: BEHAVIOURAL | The canonical position is derived by summing ledger lines.
-- BAR-030 — behavioral coverage for the ledger core.
--
-- The fixture is deliberately created and exercised inside one transaction. The
-- test runs as the migration owner so UPDATE and DELETE reach the immutability
-- triggers instead of being rejected earlier by the client role's privileges.

begin;
create extension if not exists pgtap;

select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000b1',
        'authenticated', 'authenticated', 'ledger-behaviour@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000b1', 'manager', null, true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select lives_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '30000000-0000-4000-8000-000000000001',
       'kind', 'receipt', 'source', 'ledger-test',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'location_id', '00000000-0000-4000-8000-000000000101',
         'container_delta', 2, 'ml_delta', 1300, 'value_delta_minor', 2000)))) $$,
  'the first fixture movement is appended through the command path'
);

select lives_ok(
  $$ select public.boa_bar_submit_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', '30000000-0000-4000-8000-000000000002',
       'kind', 'receipt', 'source', 'ledger-test',
       'business_date', current_date, 'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'location_id', '00000000-0000-4000-8000-000000000101',
         'container_delta', 3, 'ml_delta', 1950, 'value_delta_minor', 3000)))) $$,
  'the second fixture movement is appended through the command path'
);

-- The owner is intentional here: a client role has no UPDATE or DELETE grant,
-- which would test privileges rather than whether the trigger fires.
select throws_ok(
  $$ update public.boa_bar_movement
     set reason = 'tampered'
     where idempotency_key = '30000000-0000-4000-8000-000000000001' $$,
  '55000',
  'BOA bar ledger rows are immutable; post an adjustment instead',
  'a movement header cannot be updated'
);

select throws_ok(
  $$ delete from public.boa_bar_movement
     where idempotency_key = '30000000-0000-4000-8000-000000000001' $$,
  '55000',
  'BOA bar ledger rows are immutable; post an adjustment instead',
  'a movement header cannot be deleted'
);

select throws_ok(
  $$ update public.boa_bar_movement_line
     set container_delta = 99
     where movement_id = (select id from public.boa_bar_movement
                          where idempotency_key = '30000000-0000-4000-8000-000000000001') $$,
  '55000',
  'BOA bar ledger rows are immutable; post an adjustment instead',
  'a movement line cannot be updated'
);

select throws_ok(
  $$ delete from public.boa_bar_movement_line
     where movement_id = (select id from public.boa_bar_movement
                          where idempotency_key = '30000000-0000-4000-8000-000000000001') $$,
  '55000',
  'BOA bar ledger rows are immutable; post an adjustment instead',
  'a movement line cannot be deleted'
);

-- The four failed mutations above must not have changed the observations that
-- the position is calculated from.
select is(
  (select count(*)::integer from public.boa_bar_movement
   where idempotency_key in (
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000002')),
  2,
  'failed ledger mutations leave both movement headers intact'
);

select is(
  (select count(*)::integer from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.idempotency_key in (
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000002')),
  2,
  'failed ledger mutations leave both movement lines intact'
);

-- Compare every numeric position column with an independent aggregate over the
-- append-only source rows. The private balance projection is not used here.
select is(
  (select containers from public.boa_bar_v_position
   where venue_id = '00000000-0000-4000-8000-000000000001'
     and location_id = '00000000-0000-4000-8000-000000000101'
     and sku_id = '00000000-0000-4000-8000-000000000201'),
  (select sum(ml.container_delta)::bigint from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.venue_id = '00000000-0000-4000-8000-000000000001'
     and ml.location_id = '00000000-0000-4000-8000-000000000101'
     and ml.sku_id = '00000000-0000-4000-8000-000000000201'),
  'position containers equal the sum of ledger container deltas'
);

select is(
  (select ml from public.boa_bar_v_position
   where venue_id = '00000000-0000-4000-8000-000000000001'
     and location_id = '00000000-0000-4000-8000-000000000101'
     and sku_id = '00000000-0000-4000-8000-000000000201'),
  (select sum(ml.ml_delta)::bigint from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.venue_id = '00000000-0000-4000-8000-000000000001'
     and ml.location_id = '00000000-0000-4000-8000-000000000101'
     and ml.sku_id = '00000000-0000-4000-8000-000000000201'),
  'position millilitres equal the sum of ledger millilitre deltas'
);

select is(
  (select value_minor from public.boa_bar_v_position
   where venue_id = '00000000-0000-4000-8000-000000000001'
     and location_id = '00000000-0000-4000-8000-000000000101'
     and sku_id = '00000000-0000-4000-8000-000000000201'),
  (select sum(ml.value_delta_minor)::bigint from public.boa_bar_movement_line ml
   join public.boa_bar_movement m on m.id = ml.movement_id
   where m.venue_id = '00000000-0000-4000-8000-000000000001'
     and ml.location_id = '00000000-0000-4000-8000-000000000101'
     and ml.sku_id = '00000000-0000-4000-8000-000000000201'),
  'position value equals the sum of ledger value deltas'
);

select * from finish();
rollback;

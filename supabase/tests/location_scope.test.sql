-- @proves: BEHAVIOURAL | Connects as scoped and global roles and proves the waste
-- @proves: BEHAVIOURAL | command's location boundary. Read policies remain open BAR-024 work.
-- BAR-024 / BAR-133 — a crew member's location is a database control.

begin;
create extension if not exists pgtap;

select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'bar3@example.test', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'manager@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-0000000000b1',
    'bar_lead',
    '00000000-0000-4000-8000-000000000104', -- bar_3
    true
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-0000000000b2',
    'manager',
    null,
    true
  );

-- Seed the warehouse, then move two containers to each bar as the migration
-- owner. The setup respects the ledger's receipt/issue semantics and rolls back.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

select private.boa_bar_post_movement(jsonb_build_object(
  'venue_id', '00000000-0000-4000-8000-000000000001',
  'idempotency_key', '24000000-0000-4000-8000-000000000001',
  'kind', 'receipt',
  'source', 'location-scope-test',
  'lines', jsonb_build_array(jsonb_build_object(
    'sku_id', '00000000-0000-4000-8000-000000000201',
    'location_id', '00000000-0000-4000-8000-000000000101',
    'container_delta', 4,
    'ml_delta', 2600
  ))
), '00000000-0000-4000-8000-0000000000b2'::uuid);

select private.boa_bar_post_movement(jsonb_build_object(
  'venue_id', '00000000-0000-4000-8000-000000000001',
  'idempotency_key', '24000000-0000-4000-8000-000000000002',
  'kind', 'issue',
  'source', 'location-scope-test',
  'lines', jsonb_build_array(
    jsonb_build_object(
      'sku_id', '00000000-0000-4000-8000-000000000201',
      'location_id', '00000000-0000-4000-8000-000000000101',
      'container_delta', -4,
      'ml_delta', -2600
    ),
    jsonb_build_object(
      'sku_id', '00000000-0000-4000-8000-000000000201',
      'location_id', '00000000-0000-4000-8000-000000000104',
      'container_delta', 2,
      'ml_delta', 1300
    ),
    jsonb_build_object(
      'sku_id', '00000000-0000-4000-8000-000000000201',
      'location_id', '00000000-0000-4000-8000-000000000105',
      'container_delta', 2,
      'ml_delta', 1300
    )
  )
), '00000000-0000-4000-8000-0000000000b2'::uuid);

-- ---------------------------------------------------------------------------
-- Scoped bar lead: writes Bar 3, never Bar 4.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);  -- see the BAR-141 note below
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$ select public.boa_bar_record_waste(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'sku_id', '00000000-0000-4000-8000-000000000201',
       'containers', 1,
       'reason', 'Breakage',
       'idempotency_key', '24000000-0000-4000-8000-000000000003')) $$,
  'a bar lead can record waste at their assigned bar'
);

select throws_ok(
  $$ select public.boa_bar_record_waste(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'sku_id', '00000000-0000-4000-8000-000000000201',
       'containers', 1,
       'reason', 'Breakage',
       'idempotency_key', '24000000-0000-4000-8000-000000000004')) $$,
  '42501',
  'not authorised to record waste at this location',
  'a bar lead cannot record waste at another bar'
);

select is(
  (
    select count(*)::integer
    from public.boa_bar_movement m
    join public.boa_bar_movement_line ml on ml.movement_id = m.id
    where m.idempotency_key = '24000000-0000-4000-8000-000000000004'
      and ml.location_id = '00000000-0000-4000-8000-000000000105'
  ),
  0,
  'the rejected cross-bar command wrote no ledger row'
);

select lives_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event')) $$,
  'a bar lead can open a count at their assigned bar'
);

select throws_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'count_kind', 'mid_event')) $$,
  '42501',
  'not authorised to count at this location',
  'a bar lead cannot open a count at another bar'
);

select lives_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event',
       'idempotency_key', '24000000-0000-4000-8000-000000000006',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 0,
         'partial_ml', 0)))) $$,
  'a bar lead can submit a count at their assigned bar'
);

select throws_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'count_kind', 'mid_event',
       'idempotency_key', '24000000-0000-4000-8000-000000000007',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 0,
         'partial_ml', 0)))) $$,
  '42501',
  'not authorised to count at this location',
  'a bar lead cannot submit a count at another bar'
);

select is(
  (select count(*)::integer from public.boa_bar_count_session
   where idempotency_key = '24000000-0000-4000-8000-000000000007'),
  0,
  'the rejected cross-bar count wrote no session'
);

-- ---------------------------------------------------------------------------
-- Global manager: no fixed location, but may explicitly operate either bar.
-- ---------------------------------------------------------------------------

-- BAR-141 LEAK, found 3 September 2026 the first time this suite ran against the
-- hosted schema. The five BAR-141 wrappers do
-- `set_config('request.jwt.claim.sub', <actor>, true)` so a queued command posts
-- as its original author. `true` means transaction-local — and pgTAP runs this
-- whole file in ONE transaction, while `auth.uid()` reads
-- `request.jwt.claim.sub` in PREFERENCE to `request.jwt.claims`.
--
-- So the first `record_waste` below pins auth.uid() to the bar lead for the rest
-- of the file, and every later `set local request.jwt.claims` is silently
-- ignored. That is why the three manager assertions failed with the BAR LEAD's
-- permissions: "a manager can record waste at an explicitly selected bar" was
-- never testing a manager.
--
-- Clearing the override is what makes an identity switch mean anything here. In
-- production each RPC is its own transaction so the leak is bounded to one call,
-- but the wrapper restoring what it overrode is the real fix and is recorded as a
-- defect in docs/CURRENT-STATE.md.
select set_config('request.jwt.claim.sub', '', true);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$ select public.boa_bar_record_waste(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'sku_id', '00000000-0000-4000-8000-000000000201',
       'containers', 1,
       'reason', 'Spillage',
       'idempotency_key', '24000000-0000-4000-8000-000000000005')) $$,
  'a manager can record waste at an explicitly selected bar'
);

select lives_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'count_kind', 'mid_event')) $$,
  'a manager can open a count at an explicitly selected bar'
);

select lives_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000105',
       'count_kind', 'mid_event',
       'idempotency_key', '24000000-0000-4000-8000-000000000008',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 0,
         'partial_ml', 0)))) $$,
  'a manager can submit a count at an explicitly selected bar'
);

select * from finish();
rollback;

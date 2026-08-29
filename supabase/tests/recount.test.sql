-- BAR-145 — a bad count is superseded, never edited.
--
-- This file closes the last gap the suite has been reporting since it was written:
-- **it attempts an UPDATE and a DELETE and asserts the triggers fire.** Every
-- earlier assertion about immutability was an assertion that a trigger EXISTS.
--
-- Run as the migration owner throughout, deliberately. `authenticated` holds no
-- UPDATE grant on any table, so an UPDATE attempted as that role would fail on
-- privileges and prove nothing about the trigger. Proving a trigger requires a
-- caller who would otherwise be allowed.
--
-- Everything is rolled back, including the auth.users row.

begin;
create extension if not exists pgtap;

select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000b1',
        'authenticated', 'authenticated', 'recounter@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000b1',
        'bar_lead',
        '00000000-0000-4000-8000-000000000104',
        true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

-- The typo: 110 where 11 was meant.
select lives_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event',
       'idempotency_key', '11111111-1111-4111-8111-111111111111',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 110,
         'partial_ml', 0)))) $$,
  'a count can be submitted'
);

-- ---------------------------------------------------------------------------
-- It cannot be edited. This is the assertion BAR-030 has been missing.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.boa_bar_count_line set full_containers = 11
     where sku_id = '00000000-0000-4000-8000-000000000201' $$,
  '55000',
  'a submitted count cannot be edited; submit a recount instead',
  'UPDATE on a count line is rejected by the trigger'
);

select throws_ok(
  $$ delete from public.boa_bar_count_line
     where sku_id = '00000000-0000-4000-8000-000000000201' $$,
  '55000',
  'a submitted count cannot be edited; submit a recount instead',
  'DELETE on a count line is rejected by the trigger'
);

select throws_ok(
  $$ update public.boa_bar_count_session
     set location_id = '00000000-0000-4000-8000-000000000102'
     where idempotency_key = '11111111-1111-4111-8111-111111111111' $$,
  '55000',
  'a count cannot be moved to another location or person; submit a recount instead',
  'a count cannot be moved to another location'
);

-- ---------------------------------------------------------------------------
-- The remedy is a recount, and it has to say why.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'idempotency_key', '22222222-2222-4222-8222-222222222222',
       'supersedes_session_id', (select id from public.boa_bar_count_session
                                 where idempotency_key = '11111111-1111-4111-8111-111111111111'),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 11, 'partial_ml', 0)))) $$,
  '22023',
  'a recount needs a reason',
  'a recount without a reason is refused'
);

select lives_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'idempotency_key', '33333333-3333-4333-8333-333333333333',
       'supersedes_session_id', (select id from public.boa_bar_count_session
                                 where idempotency_key = '11111111-1111-4111-8111-111111111111'),
       'supersede_reason', 'Typed 110 instead of 11',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 11, 'partial_ml', 0)))) $$,
  'a recount with a reason is accepted'
);

select is(
  (select superseded_by_session_id is not null from public.boa_bar_count_session
   where idempotency_key = '11111111-1111-4111-8111-111111111111'),
  true,
  'the original is marked superseded'
);

-- The point of superseding rather than editing: the wrong figure is still there,
-- with the name of whoever entered it.
select is(
  (select full_containers from public.boa_bar_count_line cl
   join public.boa_bar_count_session cs on cs.id = cl.count_session_id
   where cs.idempotency_key = '11111111-1111-4111-8111-111111111111'),
  110,
  'and the original observation is preserved exactly as submitted'
);

select throws_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'idempotency_key', '44444444-4444-4444-8444-444444444444',
       'supersedes_session_id', (select id from public.boa_bar_count_session
                                 where idempotency_key = '11111111-1111-4111-8111-111111111111'),
       'supersede_reason', 'again',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'full_containers', 12, 'partial_ml', 0)))) $$,
  '23514',
  'that count has already been replaced by a later one',
  'the same count cannot be superseded twice'
);

select * from finish();
rollback;

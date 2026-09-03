-- @proves: BEHAVIOURAL | Opens a count, abandons it, and asserts the blind lifts.
-- @proves: BEHAVIOURAL | Attempts to abandon a submitted count and somebody else's,
-- @proves: BEHAVIOURAL | and asserts both are refused.
-- BAR-166 — a count can be ended without submitting a figure nobody took.
--
-- Every assertion here is the acceptance criterion in ROADMAP.md, in order:
--
--   1. a draft session can be closed by the person holding it
--   2. the blind lifts immediately
--   3. a submitted session cannot be closed
--   4. the abandonment is on the record, with who and why
--
-- The blind assertions are the ones that matter and the ones that are easy to
-- fake. `private.boa_bar_is_blinded` is called directly, before and after, as the
-- counting user — not inferred from the snapshot returning rows, because a
-- snapshot can be empty for a dozen unrelated reasons.
--
-- Everything is rolled back, including the auth.users rows.

begin;
create extension if not exists pgtap;

select plan(14);

-- Two people, because "somebody else's count" is one of the rules.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1',
        'authenticated', 'authenticated', 'abandoner@example.test', now(), now()),
       ('00000000-0000-4000-8000-0000000000c2',
        'authenticated', 'authenticated', 'other-counter@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000c1', 'bar_lead',
        '00000000-0000-4000-8000-000000000104', true),
       ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-0000000000c2', 'bar_lead',
        '00000000-0000-4000-8000-000000000104', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- 1. Open a count. Opening is what blinds.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event')) $$,
  'a bar lead can open a count on their location');

select ok(
  private.boa_bar_is_blinded(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104'),
  'opening the count blinds this device to that location');

-- ---------------------------------------------------------------------------
-- 2. A reason is not optional.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.boa_bar_abandon_count(jsonb_build_object(
       'count_session_id', (select id from public.boa_bar_count_session
                             where assigned_to = '00000000-0000-4000-8000-0000000000c1'
                               and status = 'draft' limit 1),
       'reason', '   ')) $$,
  '22023',
  'a reason is required to abandon a count',
  'a blank reason is refused, not stored as an empty string');

-- ---------------------------------------------------------------------------
-- 3. Somebody else cannot abandon it.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}';

select throws_ok(
  $$ select public.boa_bar_abandon_count(jsonb_build_object(
       'count_session_id', (select id from public.boa_bar_count_session
                             where assigned_to = '00000000-0000-4000-8000-0000000000c1'
                               and status = 'draft' limit 1),
       'reason', 'not mine to close')) $$,
  '42501',
  'only the person holding this count can abandon it',
  'another crew member cannot abandon a count they do not hold');

select ok(
  private.boa_bar_is_blinded(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104') = false,
  'the blind is per-user: the second person was never blinded by the first''s count');

-- ---------------------------------------------------------------------------
-- 4. The holder can, and the blind lifts.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

select lives_ok(
  $$ select public.boa_bar_abandon_count(jsonb_build_object(
       'count_session_id', (select id from public.boa_bar_count_session
                             where assigned_to = '00000000-0000-4000-8000-0000000000c1'
                               and status = 'draft' limit 1),
       'reason', 'Opened on the wrong bar')) $$,
  'the person holding the count can abandon it');

select ok(
  private.boa_bar_is_blinded(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104') = false,
  'THE BLIND LIFTS: the location is readable again immediately after abandoning');

select is(
  (select status::text from public.boa_bar_count_session
    where assigned_to = '00000000-0000-4000-8000-0000000000c1'
    order by created_at desc limit 1),
  'abandoned',
  'the session is recorded as abandoned, not deleted');

select is(
  (select abandon_reason from public.boa_bar_count_session
    where assigned_to = '00000000-0000-4000-8000-0000000000c1'
    order by created_at desc limit 1),
  'Opened on the wrong bar',
  'the reason is on the record');

select is(
  (select abandoned_by from public.boa_bar_count_session
    where assigned_to = '00000000-0000-4000-8000-0000000000c1'
    order by created_at desc limit 1),
  '00000000-0000-4000-8000-0000000000c1'::uuid,
  'who abandoned it is on the record');

-- ---------------------------------------------------------------------------
-- 5. Replay is idempotent, and the record is final.
-- ---------------------------------------------------------------------------
select is(
  (select public.boa_bar_abandon_count(jsonb_build_object(
     'count_session_id', (select id from public.boa_bar_count_session
                           where assigned_to = '00000000-0000-4000-8000-0000000000c1'
                           order by created_at desc limit 1),
     'reason', 'Opened on the wrong bar'))->>'replayed'),
  'true',
  'a replayed abandon returns the same answer rather than raising');

select throws_ok(
  $$ update public.boa_bar_count_session
        set abandon_reason = 'something else'
      where status = 'abandoned' $$,
  '23514',
  'an abandoned count session is final; start a new count instead',
  'an abandoned session cannot have its reason rewritten');

-- ---------------------------------------------------------------------------
-- 6. A SUBMITTED count is evidence and cannot be abandoned.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.boa_bar_submit_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event',
       'idempotency_key', '22222222-2222-4222-8222-222222222222',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', (select id from public.boa_bar_sku
                     where venue_id = '00000000-0000-4000-8000-000000000001' limit 1),
         'full_containers', 3,
         'partial_ml', 0)))) $$,
  'the same person can then take a real count and submit it');

select throws_ok(
  $$ select public.boa_bar_abandon_count(jsonb_build_object(
       'count_session_id', (select id from public.boa_bar_count_session
                             where assigned_to = '00000000-0000-4000-8000-0000000000c1'
                               and status = 'submitted'
                             order by created_at desc limit 1),
       'reason', 'changed my mind')) $$,
  '23514',
  'a submitted count cannot be abandoned; take a recount instead, which supersedes it and keeps both on the record',
  'a SUBMITTED count cannot be abandoned — the remedy is a recount (BAR-145)');

select * from finish();
rollback;

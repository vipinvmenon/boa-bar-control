-- @proves: BEHAVIOURAL | Connects AS a role: sets request.jwt.claims and switches to
-- @proves: BEHAVIOURAL | `authenticated`, so RLS applies. Proves the movement_line policy —
-- @proves: BEHAVIOURAL | the bar lead reads their bar, then cannot once a count is open.
-- BAR-161 / BAR-083 — blind counting, proved rather than asserted.
--
-- The first test here that simulates a SIGNED-IN USER. `auth.uid()` reads the
-- `request.jwt.claims` GUC, so setting that GUC makes every security-definer
-- function behave as it would for a real caller; switching to the `authenticated`
-- role additionally makes RLS apply, which is the only way to prove a policy.
--
-- Everything is created inside the transaction and rolled back, including the
-- auth.users row and the movement — nothing here persists.
--
-- The first version of this file asserted `private.boa_bar_is_blinded` directly
-- while acting as `authenticated`, and failed with "permission denied for
-- function boa_bar_is_blinded". That was the test being wrong and the schema being
-- right: the predicate is internal and `authenticated` must not be able to call
-- it. What follows asserts the OBSERVABLE consequences instead, which is the
-- stronger claim — it is what an attacker with the anon key and a JWT can
-- actually reach.

begin;
create extension if not exists pgtap;

select plan(6);

-- ---------------------------------------------------------------------------
-- Setup, as the migration owner: a bar lead, and some real stock at Bar 3 for
-- the policy to have something to hide.
-- ---------------------------------------------------------------------------

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-0000000000a1',
  'authenticated', 'authenticated', 'counter@example.test', now(), now()
);

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-0000000000a1',
  'bar_lead',
  '00000000-0000-4000-8000-000000000104',  -- bar_3
  true
);

-- Act as that user from here on. Done before the receipt so the movement is
-- attributed to a real member.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

-- A receipt into Bar 3, so "the lines are not readable" is a real assertion and
-- not vacuously true against an empty ledger.
select lives_ok(
  $$ select private.boa_bar_post_movement(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'idempotency_key', gen_random_uuid(),
       'kind', 'receipt',
       'occurred_at', now(),
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000201',
         'location_id', '00000000-0000-4000-8000-000000000104',
         'container_delta', 24,
         'ml_delta', 15600))
     ), '00000000-0000-4000-8000-0000000000a1'::uuid) $$,
  'stock exists at the bar about to be counted'
);

-- ---------------------------------------------------------------------------
-- Become the crew member. RLS now applies.
-- ---------------------------------------------------------------------------

set local role authenticated;

-- Before opening a count, the bar lead may read their bar. That is the access
-- tier, and it is exactly why a role gate cannot express this rule: the same
-- person with the same role may legitimately read this ten minutes earlier.
select isnt_empty(
  $$ select 1 from public.boa_bar_inventory_snapshot('00000000-0000-4000-8000-000000000001')
     where location_code = 'bar_3' $$,
  'with no open count, the snapshot returns their bar'
);

select isnt_empty(
  $$ select 1 from public.boa_bar_movement_line
     where location_id = '00000000-0000-4000-8000-000000000104' $$,
  'and the raw movement lines for their bar are readable'
);

-- ---------------------------------------------------------------------------
-- Open the count. Creating the draft is what blinds them.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event')) $$,
  'a bar lead can open a count on their own bar'
);

-- THE ASSERTION THIS WHOLE TASK EXISTS FOR. One REST call to the snapshot was all
-- it took to read the expected position for the bar about to be counted.
select is_empty(
  $$ select 1 from public.boa_bar_inventory_snapshot('00000000-0000-4000-8000-000000000001')
     where location_code = 'bar_3' $$,
  'once the count is open, the snapshot returns NO row for that location'
);

-- Withholding the snapshot alone would be theatre: the same figure could be
-- summed from the raw ledger. docs/SECURITY.md requirement 2.
select is_empty(
  $$ select 1 from public.boa_bar_movement_line
     where location_id = '00000000-0000-4000-8000-000000000104' $$,
  'and the raw movement lines for that location are no longer readable'
);

select * from finish();
rollback;

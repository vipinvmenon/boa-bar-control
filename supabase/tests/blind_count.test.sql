-- BAR-161 / BAR-083 — blind counting, proved rather than asserted.
--
-- This is the first test here that simulates a SIGNED-IN USER. `auth.uid()` reads
-- the `request.jwt.claims` GUC, so setting that GUC inside the transaction makes
-- every security-definer function and every RLS policy behave as it would for a
-- real caller. docs/SECURITY.md requirement 8 asks for exactly this.
--
-- Everything is created inside the transaction and rolled back, including the
-- auth.users row — nothing here persists.
--
-- HONEST NOTE: this file had never been executed when it was written. The machine
-- it was authored on has no PostgreSQL, so `db push` and `pnpm test:db` are the
-- first things to parse it. If the auth.users insert needs more columns on this
-- Supabase version, that is the likely failure and it is a one-line fix.

begin;
create extension if not exists pgtap;

select plan(6);

-- A venue member who is about to count Bar 3.
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

-- Become that user for the rest of the transaction.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Before opening a count: the bar lead may read their bar. That is the access
-- tier, and it is why a role gate cannot express this rule.
-- ---------------------------------------------------------------------------

select is(
  private.boa_bar_is_blinded(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104'
  ),
  false,
  'a bar lead with no open count is not blinded'
);

select isnt_empty(
  $$ select 1 from public.boa_bar_inventory_snapshot('00000000-0000-4000-8000-000000000001')
     where location_code = 'bar_3' $$,
  'and the snapshot returns their bar'
);

-- ---------------------------------------------------------------------------
-- Open a count on Bar 3. Creating the draft is what blinds them.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.boa_bar_open_count(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000001',
       'location_id', '00000000-0000-4000-8000-000000000104',
       'count_kind', 'mid_event')) $$,
  'a bar lead can open a count on their own bar'
);

select is(
  private.boa_bar_is_blinded(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104'
  ),
  true,
  'opening the count blinds them to that location'
);

-- THE ASSERTION THIS WHOLE TASK EXISTS FOR. One REST call to the snapshot was
-- all it took to read the expected position for the bar about to be counted.
select is_empty(
  $$ select 1 from public.boa_bar_inventory_snapshot('00000000-0000-4000-8000-000000000001')
     where location_code = 'bar_3' $$,
  'the snapshot no longer returns ANY row for the location being counted'
);

-- Withholding the snapshot alone would be theatre: the raw ledger lines would let
-- the same figure be summed. docs/SECURITY.md requirement 2.
select is_empty(
  $$ select 1 from public.boa_bar_movement_line
     where location_id = '00000000-0000-4000-8000-000000000104' $$,
  'and the raw movement lines for that location are not readable either'
);

select * from finish();
rollback;

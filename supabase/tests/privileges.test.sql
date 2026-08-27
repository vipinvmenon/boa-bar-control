-- BAR-012 + BAR-122 — behavioural privilege tests.
--
-- These assert what the roles can actually DO, not that objects exist. They are
-- the first tests in this project of that kind, and they exist because the
-- previous suite went green while TRUNCATE was reachable by `anon` on eleven
-- tables and every RLS policy would have errored at query time.
--
-- Each assertion below fails if the lockdown migration is reverted, which is the
-- property that makes it worth having.

begin;
create extension if not exists pgtap;

select plan(37);

-- ---------------------------------------------------------------------------
-- BAR-122 — anon holds nothing at all on any bar table.
-- ---------------------------------------------------------------------------
-- This is the check that matters most: the anon key ships in the browser
-- bundle, so any privilege here is effectively public.

select table_privs_are('public', 'boa_bar_venue',          'anon', '{}'::text[], 'anon has no privilege on venue');
select table_privs_are('public', 'boa_bar_location',       'anon', '{}'::text[], 'anon has no privilege on location');
select table_privs_are('public', 'boa_bar_membership',     'anon', '{}'::text[], 'anon has no privilege on membership');
select table_privs_are('public', 'boa_bar_sku',            'anon', '{}'::text[], 'anon has no privilege on sku');
select table_privs_are('public', 'boa_bar_serve_map',      'anon', '{}'::text[], 'anon has no privilege on serve map');
select table_privs_are('public', 'boa_bar_docket',         'anon', '{}'::text[], 'anon has no privilege on docket');
select table_privs_are('public', 'boa_bar_docket_line',    'anon', '{}'::text[], 'anon has no privilege on docket line');
select table_privs_are('public', 'boa_bar_movement',       'anon', '{}'::text[], 'anon has no privilege on movement');
select table_privs_are('public', 'boa_bar_movement_line',  'anon', '{}'::text[], 'anon has no privilege on movement line');
select table_privs_are('public', 'boa_bar_count_session',  'anon', '{}'::text[], 'anon has no privilege on count session');
select table_privs_are('public', 'boa_bar_count_line',     'anon', '{}'::text[], 'anon has no privilege on count line');
select table_privs_are('public', 'boa_bar_pos_import',     'anon', '{}'::text[], 'anon has no privilege on pos import');
select table_privs_are('public', 'boa_bar_pos_row',        'anon', '{}'::text[], 'anon has no privilege on pos row');

-- ---------------------------------------------------------------------------
-- BAR-122 — authenticated holds SELECT and nothing else where it reads.
-- ---------------------------------------------------------------------------
-- No INSERT, UPDATE, DELETE or TRUNCATE anywhere. Writes go through
-- SECURITY DEFINER RPCs so the caller never needs table-level write privileges,
-- and granting them would bypass the validation those RPCs enforce.

select table_privs_are('public', 'boa_bar_venue',          'authenticated', '{SELECT}'::text[], 'authenticated may only read venue');
select table_privs_are('public', 'boa_bar_location',       'authenticated', '{SELECT}'::text[], 'authenticated may only read location');
select table_privs_are('public', 'boa_bar_membership',     'authenticated', '{SELECT}'::text[], 'authenticated may only read membership');
select table_privs_are('public', 'boa_bar_sku',            'authenticated', '{SELECT}'::text[], 'authenticated may only read sku');
select table_privs_are('public', 'boa_bar_movement',       'authenticated', '{SELECT}'::text[], 'authenticated may only read movement');
select table_privs_are('public', 'boa_bar_movement_line',  'authenticated', '{SELECT}'::text[], 'authenticated may only read movement line');
select table_privs_are('public', 'boa_bar_docket',         'authenticated', '{SELECT}'::text[], 'authenticated may only read docket');
select table_privs_are('public', 'boa_bar_docket_line',    'authenticated', '{SELECT}'::text[], 'authenticated may only read docket line');
select table_privs_are('public', 'boa_bar_count_session',  'authenticated', '{SELECT}'::text[], 'authenticated may only read count session');
select table_privs_are('public', 'boa_bar_count_line',     'authenticated', '{SELECT}'::text[], 'authenticated may only read count line');

-- Management data stays unreachable from the client entirely.
select table_privs_are('public', 'boa_bar_serve_map',  'authenticated', '{}'::text[], 'serve map is not client-readable');
select table_privs_are('public', 'boa_bar_pos_import', 'authenticated', '{}'::text[], 'pos import is not client-readable');
select table_privs_are('public', 'boa_bar_pos_row',    'authenticated', '{}'::text[], 'pos rows are not client-readable');

-- ---------------------------------------------------------------------------
-- BAR-012 — the policy helper is reachable, and nothing else in `private` is.
-- ---------------------------------------------------------------------------
-- Without USAGE here every RLS policy in migration 1 errors at query time,
-- because all of them call private.boa_bar_has_role().

select schema_privs_are('private', 'authenticated', '{USAGE}'::text[], 'authenticated has USAGE on private, and no CREATE');
select schema_privs_are('private', 'anon', '{}'::text[], 'anon has nothing on private');

select function_privs_are(
  'private', 'boa_bar_has_role', array['uuid', 'boa_bar_role[]'],
  'authenticated', '{EXECUTE}'::text[],
  'authenticated may execute the role helper'
);

-- The cached projection must stay server-side. If this ever grants SELECT, the
-- blind count is defeated by reading the balance directly (docs/SECURITY.md).
select table_privs_are('private', 'boa_bar_balance', 'authenticated', '{}'::text[], 'the balance projection is not client-readable');
select table_privs_are('private', 'boa_bar_balance', 'anon', '{}'::text[], 'anon cannot reach the balance projection');

-- ---------------------------------------------------------------------------
-- ADR-013 — the command RPCs are the write path, and only staff may call them.
-- ---------------------------------------------------------------------------
-- The tables stay read-only (asserted above); these functions are how anything
-- gets written. If anon could call them, the lockdown above would be pointless.

select function_privs_are('public', 'boa_bar_submit_movement', array['jsonb'], 'anon', '{}'::text[], 'anon cannot post movements');
select function_privs_are('public', 'boa_bar_submit_movement', array['jsonb'], 'authenticated', '{EXECUTE}'::text[], 'staff may post movements');

select function_privs_are('public', 'boa_bar_create_docket', array['jsonb'], 'anon', '{}'::text[], 'anon cannot create dockets');
select function_privs_are('public', 'boa_bar_create_docket', array['jsonb'], 'authenticated', '{EXECUTE}'::text[], 'staff may create dockets');

select function_privs_are('public', 'boa_bar_accept_docket', array['jsonb'], 'anon', '{}'::text[], 'anon cannot accept dockets');
select function_privs_are('public', 'boa_bar_accept_docket', array['jsonb'], 'authenticated', '{EXECUTE}'::text[], 'staff may accept dockets');

select * from finish();
rollback;

-- STILL NOT COVERED, and both are BAR-030:
--   * That the immutability triggers actually reject an UPDATE or DELETE. That
--     needs a committed movement row to update, which needs a venue, a location,
--     an SKU and an auth.users row — i.e. a fixture harness.
--   * That the RLS policies produce the right row visibility per role. That
--     needs a session with a real JWT claim, not just a privilege check.
-- Privileges are necessary but not sufficient: these tests prove a role cannot
-- reach a table, not that it sees the correct rows within one it can.

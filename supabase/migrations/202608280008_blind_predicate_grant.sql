-- BAR-161 — grant EXECUTE on the blind predicate to `authenticated`.
--
-- A LIVE DEFECT in 202608280007, caught by the test written alongside it. Any
-- signed-in user reading `boa_bar_movement_line` currently gets:
--
--     permission denied for function boa_bar_is_blinded
--
-- which breaks the activity feed, the bar workspace's movement summary and the
-- variance report for everybody.
--
-- WHY. An RLS policy is evaluated as the QUERYING role, not as the table owner.
-- So a policy that calls a function requires the querying role to hold EXECUTE on
-- it. 202608280007 added `private.boa_bar_is_blinded` to the
-- `boa_bar_movement_line` read policy and revoked EXECUTE from `authenticated` in
-- the same breath.
--
-- This is the SAME MISTAKE BAR-012 fixed once already, for
-- `private.boa_bar_has_role`, and that migration wrote down the reason in its own
-- header. It was repeated anyway, four migrations later, by the same author. The
-- pattern worth naming: a `revoke all` on a function used inside a policy is not a
-- hardening measure, it is an outage.
--
-- Is the grant safe? Yes, and narrowly so. `boa_bar_is_blinded` keys on
-- `auth.uid()`, so a caller can only ever learn whether THEY hold an open count on
-- a location. It discloses nothing about anybody else, and nothing about a
-- position. `anon` still holds nothing.
--
-- `privileges.test.sql` now asserts this for every function a policy calls, so the
-- third occurrence fails the suite instead of reaching the database.

begin;

revoke all on function private.boa_bar_is_blinded(uuid, uuid) from public, anon;
grant execute on function private.boa_bar_is_blinded(uuid, uuid) to authenticated;

comment on function private.boa_bar_is_blinded(uuid, uuid) is
  'True while the CALLER holds an open (draft) count session for this location. Called from an RLS policy, so `authenticated` MUST hold EXECUTE (BAR-161) — see 202608280008.';

commit;

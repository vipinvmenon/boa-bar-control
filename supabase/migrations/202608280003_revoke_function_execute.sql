-- Close two EXECUTE holes, one of them found by the privilege suite the moment it
-- was first actually run against the database, and one found by auditing this
-- morning's own work against that failure.
--
-- ROOT CAUSE, both times: `create function` grants EXECUTE to PUBLIC by default.
-- Granting to `authenticated` afterwards does not remove that, so a function is
-- reachable by `anon` — whose key ships in the browser bundle — unless the default
-- grant is explicitly revoked. Migration 202608270002 did the revoke for the two
-- docket RPCs; the four functions created before it did not.
--
-- 1. public.boa_bar_submit_movement — `anon` holds EXECUTE. This is the assertion
--    `privileges.test.sql` calls 'anon cannot post movements', and it has been
--    failing since it was written on 27 August: it was written and recorded as
--    passing without ever being executed. In practice the function's own
--    `auth.uid() is null` guard rejects an anonymous caller, so the hole was not
--    exploitable — but the defence was one accidental line away from being the
--    only thing standing between the anon key and the ledger.
--
-- 2. private.boa_bar_post_movement — added THIS MORNING by 202608280002, and worse
--    than the first. `authenticated` was granted USAGE on schema `private` in
--    202608270001 so that RLS policies could resolve `boa_bar_has_role`. Combined
--    with the default PUBLIC grant, any signed-in user could call the internal
--    poster directly — and it takes the actor as a PARAMETER, because the whole
--    point of extracting it was to let the bootstrap supply one. So a crew member
--    could post any movement, to any location, attributed to anyone, with no role
--    check whatsoever: it bypasses both the role gate in
--    boa_bar_submit_movement and the two-party rules in the docket RPCs.
--
--    Not exploitable in the field, because 202608280002 has not been applied. It
--    would have been the single worst hole in the schema.
--
-- The lesson is mechanical, so the fix is mechanical: the assertions added to
-- privileges.test.sql cover every function, so a future one that forgets its
-- revoke fails the suite instead of being noticed by luck.

begin;

-- ---------------------------------------------------------------------------
-- The two holes.
-- ---------------------------------------------------------------------------

revoke all on function public.boa_bar_submit_movement(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_movement(jsonb) to authenticated;

-- No grant to anybody. Every caller is a SECURITY DEFINER function that runs as
-- the owner, and the owner's privileges do not come from these grants.
revoke all on function private.boa_bar_post_movement(jsonb, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Two more that were not holes but were one grant away from becoming one.
-- ---------------------------------------------------------------------------

-- Reachable only with USAGE on `private`, which `anon` does not have. Revoked so
-- that a future `grant usage on schema private to anon` cannot quietly expose it.
revoke all on function private.boa_bar_reject_mutation() from public, anon;

-- boa_bar_has_role is deliberately executable by `authenticated`: every RLS policy
-- calls it, and without it every policy errors at query time (BAR-012). But it
-- does not need to be executable by PUBLIC, and it discloses whether a given user
-- holds a role at a venue.
revoke all on function private.boa_bar_has_role(uuid, public.boa_bar_role[]) from public, anon;
grant execute on function private.boa_bar_has_role(uuid, public.boa_bar_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Stop this recurring.
-- ---------------------------------------------------------------------------
-- Default privileges apply to functions created LATER, so this does not fix
-- anything above — it stops the next function from arriving with the same hole
-- even if its migration forgets the revoke.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

commit;

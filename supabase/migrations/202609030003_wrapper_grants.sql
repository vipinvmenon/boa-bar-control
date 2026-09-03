-- BAR-011 — close the anon EXECUTE holes on the five BAR-141 wrappers.
--
-- Found by `privileges.test.sql` assertion 36 ("anon cannot accept dockets:
-- Extra privileges: EXECUTE") on 3 September 2026, the first time the suite was
-- run against the hosted database after BAR-166 was written.
--
-- THE SAME MISTAKE, THE THIRD TIME. `create function` grants EXECUTE to PUBLIC
-- by default, and PUBLIC includes `anon`. CURRENT-STATE.md event-stopper 20
-- records this exact defect on `private.boa_bar_post_movement`, with the note
-- "it was live, not theoretical". `202608310013_queued_actor_commands.sql`
-- renamed the five command RPCs to `*_session_actor` and CREATED five new
-- wrappers in front of them (BAR-141, so a queued movement is attributed to
-- whoever created it rather than whoever was signed in when the queue flushed).
-- It carefully revoked from the five renamed functions and granted the wrappers
-- to `authenticated` — and never revoked PUBLIC from the wrappers it had just
-- created.
--
-- NOT EXPLOITABLE, and the distinction matters. Every one of the five wrappers
-- calls `private.boa_bar_queued_actor` as its first statement, and that function
-- raises `28000 authentication required` when `auth.uid()` is null. An `anon`
-- caller — the key that ships in the browser bundle — reaches the function and is
-- refused. So this is a defence-in-depth failure, not a breach: nothing could be
-- written through it.
--
-- It is still a defect worth its own migration. BAR-011's rule is that no
-- `boa_bar_` function is reachable by `anon` AT ALL, precisely so that the
-- security of the system does not rest on every function's first statement being
-- right. Two of these five already had a weaker internal check than the others
-- when they were written.
--
-- The lesson, for the next person adding a command RPC: revoke in the same
-- statement block that creates it. `privileges.test.sql` enumerates every
-- function for both roles and is the only reason this was found rather than
-- shipped.

begin;

revoke all on function public.boa_bar_create_docket(jsonb) from public, anon;
revoke all on function public.boa_bar_accept_docket(jsonb) from public, anon;
revoke all on function public.boa_bar_submit_count(jsonb) from public, anon;
revoke all on function public.boa_bar_record_waste(jsonb) from public, anon;
revoke all on function public.boa_bar_record_receipt(jsonb) from public, anon;

-- Re-granted because `revoke ... from public` on a function also removes the
-- privilege `authenticated` holds by virtue of PUBLIC. Granting explicitly is
-- what makes the privilege visible to `privileges.test.sql` rather than implied.
grant execute on function public.boa_bar_create_docket(jsonb) to authenticated;
grant execute on function public.boa_bar_accept_docket(jsonb) to authenticated;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;
grant execute on function public.boa_bar_record_waste(jsonb) to authenticated;
grant execute on function public.boa_bar_record_receipt(jsonb) to authenticated;

commit;

-- BAR-012 + BAR-122 — close two privilege holes found by the 24 August audit and
-- confirmed against the live schema.
--
-- BAR-122: TRUNCATE is not restricted by row level security. Supabase grants
-- broad privileges on public tables to `anon` and `authenticated` by default, and
-- migration 1 revoked them on only two of the thirteen tables. The anon key
-- ships in the browser bundle, so anyone holding it could truncate eleven
-- tables — including the SKU catalogue and every docket, count and POS row.
-- RLS would not have stopped it. This is the single widest hole in the schema.
--
-- BAR-012: every RLS policy calls private.boa_bar_has_role(). Migration 1 did
-- `revoke all on schema private from public`, so `authenticated` has no USAGE on
-- that schema and cannot resolve the function. Every policy would therefore
-- error at query time. The existing pgTAP suite did not catch this because it
-- runs as a superuser and only asserts that objects exist.

begin;

-- ---------------------------------------------------------------------------
-- BAR-122 — revoke everything, then grant back only what the app reads.
-- ---------------------------------------------------------------------------
-- Writes are deliberately NOT granted. Every write goes through a
-- SECURITY DEFINER RPC (boa_bar_submit_movement and the command RPCs to come in
-- BAR-155), which runs as the owner and does not need the caller to hold table
-- privileges. Granting INSERT directly would bypass the validation those RPCs
-- exist to enforce.

revoke all on public.boa_bar_venue          from anon, authenticated;
revoke all on public.boa_bar_location       from anon, authenticated;
revoke all on public.boa_bar_membership     from anon, authenticated;
revoke all on public.boa_bar_sku            from anon, authenticated;
revoke all on public.boa_bar_serve_map      from anon, authenticated;
revoke all on public.boa_bar_docket         from anon, authenticated;
revoke all on public.boa_bar_docket_line    from anon, authenticated;
revoke all on public.boa_bar_movement       from anon, authenticated;
revoke all on public.boa_bar_movement_line  from anon, authenticated;
revoke all on public.boa_bar_count_session  from anon, authenticated;
revoke all on public.boa_bar_count_line     from anon, authenticated;
revoke all on public.boa_bar_pos_import     from anon, authenticated;
revoke all on public.boa_bar_pos_row        from anon, authenticated;

-- `anon` is never granted anything back. This is an invited-staff application:
-- an unauthenticated caller has no legitimate read of any bar table.

-- Restore SELECT for signed-in staff. Row visibility remains governed by the
-- RLS policies from migration 1; these grants only make the tables reachable.
-- The five the client reads directly (src/lib/auth.tsx, src/lib/live-repository.ts):
grant select on public.boa_bar_venue       to authenticated;
grant select on public.boa_bar_location    to authenticated;
grant select on public.boa_bar_membership  to authenticated;
grant select on public.boa_bar_sku         to authenticated;
grant select on public.boa_bar_movement    to authenticated;

-- Plus the ones migration 1 intended to expose, kept at parity so the read
-- policies it defined remain meaningful:
grant select on public.boa_bar_docket        to authenticated;
grant select on public.boa_bar_docket_line   to authenticated;
grant select on public.boa_bar_movement_line to authenticated;
grant select on public.boa_bar_count_session to authenticated;
grant select on public.boa_bar_count_line    to authenticated;

-- boa_bar_serve_map, boa_bar_pos_import and boa_bar_pos_row are intentionally
-- NOT granted. Their migration-1 policies restrict them to manager/auditor/admin,
-- and the serve map plus POS money columns are management data — see
-- docs/SECURITY.md. They will be served through purpose-built RPCs.

-- Stop the hole reopening on every future table. Narrowly scoped: TRUNCATE
-- only, schema public only, these two roles only.
alter default privileges in schema public revoke truncate on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- BAR-012 — make the policy helper reachable.
-- ---------------------------------------------------------------------------
-- USAGE on the schema and EXECUTE on this one function, nothing more. The
-- function is SECURITY DEFINER and returns only a boolean about the caller's own
-- membership, so exposing it discloses nothing. The projection table
-- private.boa_bar_balance stays unreachable — no grant is issued on it.

grant usage on schema private to authenticated;
grant execute on function private.boa_bar_has_role(uuid, public.boa_bar_role[]) to authenticated;

comment on schema private is
  'Server-side internals. authenticated holds USAGE plus EXECUTE on boa_bar_has_role only (BAR-012); no table in here is client-readable.';

commit;

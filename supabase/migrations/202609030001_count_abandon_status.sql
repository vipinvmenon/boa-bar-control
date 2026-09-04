-- BAR-166 — a count can end without being submitted.
--
-- This file contains ONE statement, on purpose. Since PostgreSQL 12 the value may
-- be ADDED inside a transaction, but it cannot be USED in that same transaction
-- ("unsafe use of new value of enum type"). So the value is added here, alone,
-- and every use of it lives in 202609030002_count_abandon.sql, which runs
-- afterwards in its own transaction.
--
-- The begin/commit is therefore doing nothing except satisfying `check:sql`,
-- which requires exactly one pair per migration. That is a fair rule and this is
-- a fair exception to argue with rather than to work around silently: wrapping a
-- lone ALTER TYPE is safe precisely because nothing follows it here.
--
-- Why a status and not a link. BAR-145 deliberately modelled superseded-ness as a
-- link rather than a status, because a superseded count WAS submitted and the
-- status has to keep saying so. Abandonment is the opposite case: it is what
-- happened to the session, it is terminal, and no other fact about the session is
-- being overwritten. `private.boa_bar_is_blinded` already keys off
-- `status = 'draft'`, so this also means the predicate that enforces
-- non-negotiable 3 does not have to be touched — which is the safest place for
-- this change to land.

begin;

alter type public.boa_bar_count_status add value if not exists 'abandoned';

commit;

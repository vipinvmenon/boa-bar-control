-- BAR-082 / BAR-084 — keep the queued count command authenticated-only.
--
-- The queued-actor migration recreates the public wrapper after the original
-- location-scoped function grant. PostgreSQL gives a newly-created function
-- EXECUTE to PUBLIC, so the wrapper must revoke that default explicitly.

begin;

revoke all on function public.boa_bar_submit_count(jsonb) from public, anon;
grant execute on function public.boa_bar_submit_count(jsonb) to authenticated;

comment on function public.boa_bar_submit_count(jsonb) is
  'BAR-082/BAR-084. Authenticated queued command that records a blind count and seals its theoretical position.';

commit;

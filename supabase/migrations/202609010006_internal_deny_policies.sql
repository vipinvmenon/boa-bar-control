-- BAR-013 — make protected-table denial explicit.
--
-- These relations are not part of the client data API. Their only callers are
-- SECURITY DEFINER functions and service-role operations. Explicit deny
-- policies document that boundary and keep future grants from becoming an
-- accidental read path; table owners and service_role retain their existing
-- privileged behavior.

begin;

create policy boa_bar_balance_deny_client on private.boa_bar_balance
  for all to public using (false) with check (false);

create policy boa_bar_count_seal_deny_client on private.boa_bar_count_seal
  for all to public using (false) with check (false);

create policy boa_bar_tolerance_band_deny_client on public.boa_bar_tolerance_band
  for all to public using (false) with check (false);

create policy boa_bar_excise_category_deny_client on public.boa_bar_excise_category
  for all to public using (false) with check (false);

commit;

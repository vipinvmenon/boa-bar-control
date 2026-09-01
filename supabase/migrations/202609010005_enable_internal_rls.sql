-- BAR-013 — enable RLS on internal/protected tables.
--
-- These tables have no client grants and are read or written only by
-- SECURITY DEFINER command/read functions. Keep them policy-less: adding a
-- client policy here would expose the balance projection or the blind-count
-- theoretical position. Function owners and service_role retain access.

begin;

alter table private.boa_bar_balance enable row level security;
alter table private.boa_bar_count_seal enable row level security;
alter table public.boa_bar_tolerance_band enable row level security;
alter table public.boa_bar_excise_category enable row level security;

commit;

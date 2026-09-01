-- BAR-013 — pin search_path on private trigger and validation functions.
--
-- These functions are SECURITY INVOKER trigger/guard functions, not client API
-- functions, but an explicit path keeps name resolution deterministic and clears
-- the mutable-search-path security lint.

begin;

alter function private.boa_bar_check_movement_line_scope()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_guard_count_session()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_reject_count_mutation()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_reject_hand_keyed_sale()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_reject_mutation()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_reject_negative_position()
  set search_path = public, private, pg_temp;
alter function private.boa_bar_validate_comp()
  set search_path = public, private, pg_temp;

commit;

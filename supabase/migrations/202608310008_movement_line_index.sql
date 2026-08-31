-- BAR-029 — movement_line.movement_id is the primary join key for ledger reads.
-- The existing position index serves location/SKU queries; this one serves
-- movement detail and audit queries without scanning every line.

begin;

create index boa_bar_movement_line_movement_idx
  on public.boa_bar_movement_line (movement_id);

commit;

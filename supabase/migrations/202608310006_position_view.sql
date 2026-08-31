-- BAR-014 — the canonical position is a sum of the append-only ledger.
--
-- This view is deliberately security-invoker: the existing movement and
-- reference-table RLS policies continue to apply to the caller. It is a read
-- model, not a second stock store, and is therefore safe to use for audits and
-- reconciliation independently of private.boa_bar_balance.

begin;

create view public.boa_bar_v_position
with (security_invoker = true)
as
select
  m.venue_id,
  ml.location_id,
  ml.sku_id,
  sum(ml.container_delta)::bigint as containers,
  sum(ml.ml_delta)::bigint as ml,
  sum(ml.value_delta_minor)::bigint as value_minor,
  max(m.occurred_at) as last_occurred_at
from public.boa_bar_movement m
join public.boa_bar_movement_line ml on ml.movement_id = m.id
group by m.venue_id, ml.location_id, ml.sku_id;

comment on view public.boa_bar_v_position is
  'BAR-014. Current position summed from immutable movement lines, never from the balance projection.';

revoke all on public.boa_bar_v_position from anon, authenticated;

commit;

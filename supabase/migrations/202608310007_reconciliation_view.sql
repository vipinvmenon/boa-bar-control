-- BAR-015 — the projection must reconcile to the append-only ledger.
--
-- A non-empty result is an integrity incident. The view is intentionally not
-- granted to client roles; it is an operator/audit surface and cannot become a
-- second application read path.

begin;

create view public.boa_bar_v_reconciliation
with (security_invoker = true)
as
with ledger as (
  select
    m.venue_id,
    ml.location_id,
    ml.sku_id,
    sum(ml.container_delta)::bigint as ledger_containers,
    sum(ml.ml_delta)::bigint as ledger_ml,
    sum(ml.value_delta_minor)::bigint as ledger_value_minor
  from public.boa_bar_movement m
  join public.boa_bar_movement_line ml on ml.movement_id = m.id
  group by m.venue_id, ml.location_id, ml.sku_id
), projection as (
  select venue_id, location_id, sku_id, containers, ml, value_minor
  from private.boa_bar_balance
)
select
  coalesce(l.venue_id, p.venue_id) as venue_id,
  coalesce(l.location_id, p.location_id) as location_id,
  coalesce(l.sku_id, p.sku_id) as sku_id,
  coalesce(l.ledger_containers, 0)::bigint as ledger_containers,
  coalesce(p.containers, 0)::bigint as projection_containers,
  coalesce(l.ledger_ml, 0)::bigint as ledger_ml,
  coalesce(p.ml, 0)::bigint as projection_ml,
  coalesce(l.ledger_value_minor, 0)::bigint as ledger_value_minor,
  coalesce(p.value_minor, 0)::bigint as projection_value_minor
from ledger l
full outer join projection p using (venue_id, location_id, sku_id)
where coalesce(l.ledger_containers, 0) <> coalesce(p.containers, 0)
   or coalesce(l.ledger_ml, 0) <> coalesce(p.ml, 0)
   or coalesce(l.ledger_value_minor, 0) <> coalesce(p.value_minor, 0);

comment on view public.boa_bar_v_reconciliation is
  'BAR-015. Empty means the balance projection agrees with the ledger sum.';

revoke all on public.boa_bar_v_reconciliation from anon, authenticated;

commit;

# BOA Bar Control — Data Model

Status: canonical. This file defines the ledger and the schema contract.
Source: `references/design-source/spec.txt` §3, §4, §7, §8, §13.
Table prefix: `boa_bar_` (for compatibility with the wider BOA database).

---

## NON-NEGOTIABLE

```
boa_bar_movement is append-only.

No UPDATE.
No DELETE.
No TRUNCATE.

Corrections create compensating movements.
```

Any code that does this is wrong and must be rejected in review:

```ts
inventory.quantity -= 12        // NO
balance.containers = newValue   // NO
update boa_bar_movement set ... // NO
```

Stock on hand is **derived by summing the ledger**. There is no authoritative
quantity column anywhere in this system.

### The corollary that was previously missed

A cached projection table is permitted **only** if all of the following hold:

1. It lives in the `private` schema and is never client-readable directly.
2. It is written **only** by the ledger-posting function, in the same transaction.
3. It carries no grants to `anon` or `authenticated`.
4. A reconciliation view proves it equals the ledger sum, and a test asserts that.
5. Every read path can fall back to summing the ledger.

Without (4) and (5) the projection *is* the mutable stock level the spec forbids,
regardless of what the comment above it says. This was the defect in the first
implementation: `private.boa_bar_balance` was the only thing ever read, nothing
summed the ledger, and no reconciliation existed.

## The identity

Per SKU, per location, per window:

```
Opening + Received − Issued out + Received in − Sold − Comped − Wasted − Returned = Closing
```

This must be **computable in SQL**, decomposed by movement kind. If a view
cannot produce each term separately, the audit cannot be defended.

## Core tables

```
boa_bar_venue          id, code, name, timezone
boa_bar_location       id, venue_id, code, name, kind, is_licenced, parent_id, active
boa_bar_sku            id, venue_id, code, name, category, container_type,
                       ml_per_container, units_per_case, tare_weight_g, abv,
                       excise_category, is_supplied, supplier_vendor_id, active
boa_bar_serve          id, venue_id, pos_sku_code, sku_id, ml_per_serve, label,
                       active_from, active_to
boa_bar_movement       id, venue_id, idempotency_key, kind, occurred_at,
                       business_date, actor_id, source, reason, docket_id,
                       reverses_movement_id, posted_at, metadata
boa_bar_movement_line  id, movement_id, sku_id, location_id, container_delta,
                       ml_delta, value_delta_minor, evidence
boa_bar_docket         id, venue_id, docket_no, token_hash, token_expires_at,
                       from_location_id, to_location_id, issued_by, issued_at,
                       accepted_by, accepted_at, status, difference_reason
boa_bar_docket_line    id, docket_id, sku_id, issued_containers, issued_ml,
                       accepted_containers, accepted_ml
boa_bar_count_session  id, venue_id, location_id, count_kind, is_blind, status,
                       counted_by, witnessed_by, counted_at, submitted_at,
                       reviewed_by, reviewed_at, sealed_position
boa_bar_count_line     id, count_session_id, sku_id, full_containers,
                       partial_ml, gross_weight_g, evidence
boa_bar_pos_import     id, venue_id, source_name, raw_object_path, sha256,
                       status, imported_by, imported_at, error_report
boa_bar_pos_row        id, import_id, venue_id, pos_txn_id, location_id,
                       pos_sku_code, quantity, amount_minor, sold_at, hour_bucket,
                       raw_row
boa_bar_tolerance_band id, venue_id, category, green_pct, amber_pct, effective_from
boa_bar_membership     id, venue_id, user_id, role, location_id, active
```

## The movement

The one table everything else serves.

```
movement
────────────
id
timestamp        (occurred_at, server-validated; business_date derived)
type             (one of eight)
sku
from_location
to_location
containers
ml
docket
reason
entered_by
accepted_by
```

### Eight movement types

| Type | From | To | Notes |
| --- | --- | --- | --- |
| `receipt` | supplier | warehouse | against a delivery note / invoice number |
| `issue` | warehouse | bar | the docket, two-party |
| `transfer` | bar | bar | bar runs dry, another has spare |
| `return` | bar | warehouse | close-of-night unsold |
| `sale` | bar | — | derived from POS import, **never hand-keyed** |
| `comp` | bar or warehouse | hospitality | riders, crew, sponsor — reason mandatory |
| `waste` | bar | — | breakage, foam, line purge, spillage, refused pour |
| `adjustment` | any | — | signed correction, requires reason and named person |

All eight must be writable through a real code path. A movement type that
exists only in an enum is not implemented.

### Balance rules per kind

The ledger-posting function must enforce, per movement kind:

| Kind | Line sum constraint |
| --- | --- |
| `issue`, `transfer`, `return` | Two legs that **net to zero** (custody moves, stock does not change) |
| `receipt` | Net **positive** (stock enters the system) |
| `sale`, `waste` | Net **negative** (stock leaves the system) |
| `comp` | Two legs that **net to zero** — source location out, hospitality location in |
| `adjustment` | Signed, either direction, reason required |

`comp` is a **custody move to a hospitality location**, not a depletion. Getting
this wrong is what breaks the hospitality/sales separation in PRODUCT.md. The
first implementation rejected balanced two-leg comps, making the spec's
mandatory separation impossible to record.

## Units — capture both, derive neither

Store **base ml and container count on every movement line**. Capture both at
write time; do not derive one from the other at read time. The point is that the
ledger proves they agree.

Deriving `ml = containers × ml_per_container` at write time makes the
cross-check vacuous and makes partial containers unmovable.

Each SKU carries:

| Field | Example |
| --- | --- |
| `container_type` | bottle · can · keg · pouch |
| `ml_per_container` | 650 · 330 · 500 · 750 · 30000 |
| `units_per_case` | 12 · 24 · 1 |
| `tare_weight_g` | for weighing open bottles at close |
| `excise_category` | beer · IMFL · wine · imported |
| `is_supplied` | STOK free product vs purchased stock |

`excise_category` must be **NOT NULL**. It is the grouping the excise return is
filed on. The category vocabulary must accommodate wine and imported, not only
the four the first schema allowed.

`units_per_case` must actually be read. Case figures are a **derived
presentation**, never a stored string. A "1.5 cases" display that no arithmetic
produced is a bug.

## The serve map — the bridge between money and volume

```
boa_bar_serve: pos_sku_code → sku_id, ml_per_serve
```

| POS item | SKU | ml |
| --- | --- | --- |
| Beer — pint | STOK draught | 500 |
| Beer — can | STOK 500 can | 500 |
| Whisky — 30 | Old Monk / house | 30 |
| Whisky — 60 | Old Monk / house | 60 |
| Mixer | Coke 300 | 300 |

This table is the entire bridge between money and volume, and the most likely
place for a silent error. Two hard requirements:

1. A review step before show day.
2. A test asserting **every** POS SKU in the import has a mapping.

**An unmapped POS line must fail the batch loudly.** It must never default to
zero ml. Unmapped depletion is invisible and looks exactly like theft.

## POS ingest

- Import is append-only, batched, with the raw file retained (`raw_object_path`, `sha256`).
- Re-importing the same batch must be **idempotent**: `pos_txn_id` unique. Weakening
  this to a composite key that includes the item code breaks the guarantee the
  spec names.
- `location_id` is required — sales must be attributable to a bar, or "sales per
  hour per bar" and every ₹ figure become uncomputable.
- `amount_minor` is required — integer paise.
- Time-bucketed to the hour (`hour_bucket`) so depletion tracks against the running order.
- Unmapped `pos_sku_code` → **hard fail the whole batch**, with the failures in
  `error_report`.

## Counts

```
boa_bar_count_session: is_blind, counted_by, witnessed_by, counted_at, sealed_position
boa_bar_count_line:    full_containers, partial_ml, gross_weight_g
```

- `is_blind` must exist as a column. A count is either blind or it is not, and
  which it was is part of the audit record.
- `witnessed_by` and `counted_at` are spec fields and must exist.
- Count partials: full containers as integers, partials by weight.
  `partial_ml ≈ gross_weight_g − tare_weight_g` for spirits.
- `sealed_position` freezes the theoretical position **at submission time**, so
  variance is reproducible later even as more movements post.

### Blind enforcement is a database concern

While a count session is open for location L and user U, U must not be able to
read the expected position for L — not through the snapshot RPC, not by summing
the raw ledger.

This is **count-scoped, not role-scoped**. Crew are allowed to see stock in
general (per the spec's access tier); they are not allowed to see it for the
location they are actively counting. A role-based gate cannot express this, which
is why the first implementation's `enum_range(null::boa_bar_role)` authorisation
defeated blind counting entirely.

## Views

All `security_invoker = true`.

| View | Produces |
| --- | --- |
| `boa_bar_v_position` | Current derived stock, sku × location, **summed from the ledger** |
| `boa_bar_v_variance` | Counted vs theoretical, with pct of throughput and band |
| `boa_bar_v_depletion` | ml per hour per sku per bar, with projected run-out |
| `boa_bar_v_excise` | Containers in / out / sold / returned / empties, by excise category |
| `boa_bar_v_settlement` | Supplied-product depletion, split bar vs hospitality |
| `boa_bar_v_reconciliation` | Ledger sum vs projection — must be empty |

`v_position` summing the ledger (not reading the projection) is what makes the
projection safe to cache.

## Variance

```
theoretical_closing = opening + in − out − sold − comped − wasted
variance_ml         = counted_closing − theoretical_closing
variance_pct        = variance_ml / (sold + comped + wasted)
```

Tolerance bands live in `boa_bar_tolerance_band`, in the **database**, not as a
TypeScript constant — they are an audit input and must be versioned with an
`effective_from`.

| Category | Green | Amber | Red |
| --- | --- | --- | --- |
| Bottled / canned beer | ≤ 1% | 1–3% | > 3% |
| Draught beer | ≤ 8% | 8–15% | > 15% |
| Spirits | ≤ 3% | 3–8% | > 8% |
| Mixers / water | ≤ 2% | 2–5% | > 5% |

**Banding must be signed, not absolute.** `Math.abs(variance)` before banding
grades positive variance green, which the spec explicitly forbids: surplus means
a missed receipt, a wrong-SKU ring-up, or an unaccepted docket.

## Integrity requirements

These are the constraints the first schema lacked. Each one is a rule a review
can check.

| # | Requirement |
| --- | --- |
| 1 | Immutability triggers on `boa_bar_movement` and `boa_bar_movement_line`, declared `ENABLE ALWAYS` so they fire for replication and superuser paths |
| 2 | `TRUNCATE` blocked — row triggers do not cover it; add a statement-level trigger |
| 3 | `FORCE ROW LEVEL SECURITY` on ledger tables so the owner is not exempt |
| 4 | `private.boa_bar_balance` protected against direct mutation and reconciled by view + test |
| 5 | **Write policies exist.** Every table needing inserts has an `INSERT` policy with a `WITH CHECK` clause. Select-only policies mean dockets, counts and POS imports can never be created |
| 6 | `GRANT USAGE ON SCHEMA private TO authenticated` — every policy calls `private.boa_bar_has_role`, so without this every policy errors |
| 7 | Foreign keys **venue-scoped** — a movement must not post lines against another venue's locations or SKUs |
| 8 | `occurred_at` server-validated and consistent with `business_date`; clamp client clock skew so history cannot be backdated around a count |
| 9 | Idempotency key minted **once per user action**, not per network call, so a double tap dedupes |
| 10 | `pos_txn_id` unique per venue |
| 11 | `reverses_movement_id` unique (one reversal per movement) and the reversal must mirror the original's lines |
| 12 | `sale` writable **only** by the POS import path — not through the general movement RPC |
| 13 | `adjustment` requires a manager/admin role plus a reason |
| 14 | Short acceptance: `accepted_containers ≤ issued_containers`, and `difference_reason` NOT NULL when status is `accepted_short` |
| 15 | A short-accepted docket must post an explicit adjustment or leave the shortfall owned — never silently park stock in `in_transit` |
| 16 | Non-negative position enforced, or negative positions surfaced as an alert |
| 17 | `membership.location_id` actually used in authorisation — crew scoped to their own bar |
| 18 | Money is integer minor units (paise). Quantities are `numeric`/`integer`/`bigint`. **No float, ever** |
| 19 | Index `boa_bar_movement_line.movement_id` — it is both an FK and the join the read policy evaluates per row |
| 20 | Empties tracked, and delivery-note / invoice number captured on `receipt` |

## Access tiers

| Role | Stock | Counts | Variance | ₹ / settlement |
| --- | --- | --- | --- | --- |
| crew, warehouse, bar_lead | own scope | yes | yes | **no** |
| manager, admin | all | yes | yes | yes |
| auditor | all (read-only) | yes | yes | yes |

The artist portal must not be able to reach bar data at all.

## Testing requirements

Existence assertions prove nothing. The pgTAP suite must:

- Attempt an `UPDATE` and a `DELETE` on the ledger and assert both **fail**.
- Attempt a `TRUNCATE` and assert it fails.
- Connect **as `authenticated`** with a real JWT claim and assert each policy's
  actual effect — including that a crew member cannot read expected stock for a
  location they are counting.
- Post a movement twice with the same idempotency key and assert one row.
- Post an unmapped POS SKU and assert the batch is rejected.
- Assert `v_reconciliation` is empty after a series of movements.
- Assert the identity holds for a synthetic day.

The migrations must be **executed** against PostgreSQL before any milestone
depending on them is marked complete.

---

See also: [PRODUCT.md](PRODUCT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[OFFLINE-SYNC.md](OFFLINE-SYNC.md) · [SECURITY.md](SECURITY.md)

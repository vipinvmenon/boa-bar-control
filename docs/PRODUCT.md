# BOA Bar Control — Product

Status: canonical. This file defines what we are building and why.
Source: `Bar Inventory.docx` (recovered verbatim to `references/design-source/spec.txt`).
Event: Bangalore Open Air 2026 · BITS Club · Saturday 10 October 2026 · four bars.

---

## What this is

A production PWA for Bangalore Open Air 2026 bar inventory operations. It is a
festival operations system, not a generic hospitality inventory product. Every
design decision below exists because a festival bar fails differently from a
restaurant bar.

## The core rule

> Store movements, never levels.

Stock on hand is a **derived** figure, always. An append-only ledger holds one
row per physical event, and position is computed by summing. The moment two
places can hold the truth, they will disagree at the worst possible time.

The identity that must hold, per SKU, per location, per window:

```
Opening + Received − Issued out + Received in − Sold − Comped − Wasted − Returned = Closing
```

If it does not hold, that is the audit. Everything in this product exists to
make that line computable and to explain the residual.

## Primary objectives

1. Know where every container is.
2. Maintain chain of custody for stock movement.
3. Work when festival internet fails.
4. Detect discrepancies through blind counts.
5. Stop a bar running dry mid-set.
6. Produce a defensible post-event audit.

## Three audiences, one ledger

Three different audiences want three different answers from the same data.
All three must be designed for from the start, because retro-fitting one of
them means re-counting.

| Audience | Question | Unit |
| --- | --- | --- |
| Excise | Every bottle that entered the licenced premises is accounted for — sold, unsold, or empty | Sealed containers, by excise category |
| STOK / settlement | How much product was actually depleted, and what does it cost or credit | ml and containers, by SKU |
| BOA (you) | Did we lose money, and where | ₹ and ml variance, by bar and by hour |

Excise counts bottles. Settlement counts volume. Theft shows up as the gap
between the two. A system that tracks only one of them cannot produce the third.

This is why the system must emit **two independent reporting bases** from one
ledger, not one report with a toggle.

## Locations

Six location kinds, and the distinction between them is load-bearing:

```
Supplier ──▶ WAREHOUSE (bond store / lock-up)
                 │
                 ├──▶ BAR 1  ┐
                 ├──▶ BAR 2  ├─ point of sale, cashless
                 ├──▶ BAR 3  │
                 ├──▶ BAR 4  ┘
                 │
                 ├──▶ HOSPITALITY (artist riders, green rooms) ── never a sale
                 └──▶ LOUNGES (Eddie's 50 cap, Promoter's 25 cap) ── see open decisions
```

**Hospitality depletion must never enter sales variance.** A band's dressing-room
fridge and Bar 3 are both stock leaving the warehouse. If they land in the same
bucket, variance is permanently wrong by whatever the bands drank. Separate
movement type, separate report, reconciled against the hospitality rider.

## Users

| Role | Does | Sees |
| --- | --- | --- |
| Warehouse crew | Receive deliveries, issue to bars, warehouse counts | Stock, counts, own movements |
| Bar crew | Accept dockets, record waste, count | Own bar's stock and counts |
| Bar lead | The above, plus witness counts and accept custody | Own bar |
| Runner | Move stock between locations | Dockets in transit |
| Manager | Review variance, sign off adjustments, settlement | Everything, including ₹ |
| Auditor | Read-only post-event review | Everything, including ₹ |
| Admin | Configuration, memberships | Everything |

Access tier rule from the spec: crew see stock, counts and variance.
Management see settlement and any ₹ figure. Artists see none of it — the artist
portal must remain free of every rupee, and bar data must not be reachable from it.

## Core flows

1. **Receive** — supplier delivery into the warehouse, against a delivery note.
2. **Issue** — warehouse to bar, generating a QR docket with two-party acceptance.
3. **Accept** — receiving bar lead scans the docket and accepts, or reports a difference.
4. **Transfer** — bar to bar, when one runs dry and another has spare.
5. **Return** — bar to warehouse, close-of-night unsold.
6. **Waste** — breakage, foam, line purge, spillage, refused pour.
7. **Comp** — riders, crew, sponsor. Reason mandatory. Never a sale.
8. **Sale** — derived from POS import only. Never hand-keyed.
9. **Count** — blind, four times minimum, with partial-container weighing.
10. **Adjustment** — signed correction with a reason and a named person.
11. **Variance review** — counted versus theoretical, ranked by throughput.
12. **Reporting** — excise return, STOK settlement, sales per hour, ₹ per attendee.

## The four counts

1. Warehouse opening — after final delivery, before any issue.
2. Bar opening — at each bar, as the docket lands. This is the number staff are accountable for.
3. Mid-event — the one everyone skips. Scheduled at 19:30, during a set, not a changeover.
4. Close-out — per bar, then warehouse.

**Blind counting is non-negotiable.** The counter does not see the expected
figure. If the app shows "expected 47" next to the input box, you will get 47
every time and the count is worthless. The expected figure appears only after
submit, on the variance screen, to a different person.

## Show day is half the value

The audit is what you read on 11 October. On 10 October the same data stops a
bar running dry during Carcass:

- Depletion rate per SKU per bar per hour, projected forward to a run-out time.
- Alert when projected run-out is inside 90 minutes.
- Top up during sets, never during changeovers — the running order is already
  in the database, so use it to schedule top-up windows rather than reacting.
- Live board: four bars, stock status, open dockets, last count age.

## Paper fallback is mandatory

The venue is at Hennur, it will be 3,000 people deep, and mobile data will be
unusable at peak. Assume the app is unreachable for part of the night.

- Pre-printed count sheets per bar, SKU list filled, blank columns.
- Pre-printed docket books, triplicate, numbered.
- The app itself is offline-first: cache the SKU list and the bar's own ledger,
  queue writes, sync when it can, and stamp every screen "as of HH:MM".

A system that only works online is a system that does not work.

## What variance means

```
theoretical_closing = opening + in − out − sold − comped − wasted
variance_ml         = counted_closing − theoretical_closing
variance_pct        = variance_ml / (sold + comped + wasted)
```

Variance is a percentage of **throughput**, not of stock held. Twenty missing
pegs on a bar that sold 40 is a crisis; on a bar that sold 4,000 it is a
rounding error. Ranking by absolute variance sends you to the busiest bar every
time.

**Positive variance is not good news and must not be green.** More stock than
expected means a missed receipt, a sale rung on the wrong SKU, or a docket never
accepted.

## Leak taxonomy

The point of naming these is to stop treating all variance as suspicion. Most
of it is process. Naming the shapes is what lets you find the part that isn't.

| Leak | Signature in the data |
| --- | --- |
| Overpour | Consistent small negative variance on spirits, one bar, all night |
| Free pours for friends | Negative spirit variance concentrated in specific hours |
| Stock never delivered | Variance at the warehouse, docket accepted late or not at all |
| Stock walks from behind the bar | Step change between two counts, whole cases not pegs |
| Wrong-SKU ring-ups | One SKU heavy positive, another heavy negative, same bar |
| Line loss / foam | Draught only, roughly constant per hour of operation |
| Uncaptured comps | Large negative variance with no pattern — usually process, not theft |

Cashless removes cash skimming, which is a genuine structural advantage.

## Non-goals

- Not a POS. We ingest one; we never build one.
- Not a purchasing or procurement system.
- Not a multi-tenant SaaS product. One organisation, one venue for 2026, with
  schema headroom for more.
- No rupee figure reaches the artist portal, ever.

## Design constraint on the bar experience

The bar screen is used by temporary staff, one-handed, in the dark, at speed.
Big targets, no free text where a picker will do, and never more than three taps
to record a waste. This is a hard constraint, not a preference.

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA-MODEL.md](DATA-MODEL.md) ·
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · [ROADMAP.md](ROADMAP.md) ·
[CURRENT-STATE.md](CURRENT-STATE.md) · [DECISIONS.md](DECISIONS.md)

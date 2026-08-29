# Release 1 — what has to work on 10 October

**Written 28 August 2026.** This file exists because development continues without
Claude from 29 August, in Codex and Cursor. It is the ordered, acceptance-checked
definition of the first release. Read it after `CURRENT-STATE.md`.

It does not restate the architecture. `/docs` is canonical; this is scope and
sequence only.

---

## 1. What Release 1 is — the specification's own words

From `references/design-source/spec.txt` §15, verbatim:

> **Phase 1** — Schema, SKU list, locations, receipt + issue + docket, warehouse
> position — *by mid-Sept*
> **Phase 2** — Bar app: accept, count (blind), waste. Offline. Paper sheets
> printed — *by 26.09*
> **Phase 3** — POS mapping table + import, variance engine, tolerance bands —
> *by 03.10*
> **Phase 4** — Show-day control board, run-out alerts — *by 08.10*
> **Phase 5** — Excise return + STOK settlement reports — *after the event*
>
> If time runs short, cut in this order: control board, then run-out alerts, then
> POS import. **Phases 1–2 with paper counts and a manual POS reconciliation the
> following week still produces a defensible audit. Nothing else does.**

**Release 1 is Phases 1 and 2.** That last sentence is the whole brief: the
purpose is a defensible audit, not a complete product. A phase-1–2 system with
paper counts is defensible. A half-built phase 3 is not.

## 2. What is cut, on the specification's own instruction

| Cut | Tasks | Why it is safe to cut |
| --- | --- | --- |
| Show-day control board | BAR-100, BAR-101 | First on the spec's cut list |
| Run-out alerts | BAR-099, BAR-149 | Second on the cut list; needs a depletion rate that needs POS |
| POS import and everything downstream | BAR-093–BAR-098, BAR-095, BAR-096 | Third on the cut list. Replaced by "a manual POS reconciliation the following week" |
| Reports and settlement | all of M7 | Phase 5, explicitly *after the event* |
| `sku`, `mv`, `control`, `cowork`, `rep` screens | BAR-050, BAR-090, BAR-100, BAR-103, BAR-108 | None is on the phase-1–2 path. Warehouse and bar rows lose a drill-down; nothing becomes unrecordable |
| Variance vs **sales** | BAR-088 and the sales half of BAR-086 | Variance against receipts already works and states its own basis. Variance against sales needs POS |

Cutting these removes roughly 40 tasks. **Do not spend a day on any of them while
anything in section 4 is open.**

## 3. Where we actually are — 28 August, verified

Verified against the live database, not asserted:

- 7 migrations applied; PostgreSQL 17.6; **63 pgTAP assertions, 0 failed**
- Reference data present: 1 venue, 9 locations, 11 SKUs
- All known EXECUTE holes shut
- 16 of 22 routes; fidelity gate **0 hardcoded, 0 errored**
- 114 unit tests; typecheck, lint, build, `check:sql` green

**Cleared 29 August.** All eleven migrations are applied and `corepack pnpm
test:db` reports **107 assertions, 0 failed**. A user exists, the venue is
claimed, opening stock is posted, and the ledger and the projection agree on all
ten lines. Signed in against the live database, the home screen renders **638
containers with the bars at zero** — the position the ledger holds, and a figure
the fixtures cannot produce.

Still not verified:

- **No live write from the app.** No count, waste entry, receipt or docket has
  been posted through a service against the live database. Everything in
  `src/services/` is exercised against fixtures and pgTAP, not through the app.

## 4. The blocking list, in order

> **Items 1–8 were completed on 28 August**, in the order 2 → 1 → 4 → 3, because
> BAR-123 changes how every movement stamps its date and writing the count and
> waste RPCs first would have meant rework. Items 1–3's migrations are
> **applied and verified** — `db push` succeeded and `pnpm test:db` reports 72
> assertions, 0 failed, including all 9 behavioural business-date assertions. Item
> 5's migration (`202608280007`) is **written and unapplied**.
>
> **Items 0 and 5 were completed on 29 August.** All eleven migrations are
> applied, `test:db` reports 107 assertions and 0 failed, and the app has read
> live data. What remains unproven is the write path *through the app*: no count,
> waste entry, receipt or docket has been posted from a screen.


Ordering is my judgement, not the specification's. The reasoning is given so it
can be overruled. Each item names how to know it is done.

### 0. Create the first user and bootstrap — USER, ~10 minutes

Supabase dashboard → Authentication → Users → Add user, tick **Auto Confirm**,
then `node scripts/bootstrap.mjs`.

**Done when:** the script prints 638 containers across 10 SKUs, every line `ok`,
`claim window closed`, and `node scripts/db-state.mjs` shows a membership.

Nothing below can be verified until this exists. Do it first even if development
pauses afterwards.

### 1. BAR-082 + BAR-084 — counts must be recorded

**`CountScreen` currently navigates to the confirmation screen and discards the
count.** `boa_bar_count_line` has no write path in the schema at all: no RPC, no
grant. A blind count that is not stored is not a count, and Phase 2 is
"count (blind)".

Needs a `boa_bar_submit_count` command RPC (ADR-013: RPCs are the only write
path), a `submitCount` service, and the count screen wired through the outbox like
`acceptDocket` already is. Seal the theoretical position at submit time (BAR-084)
or the variance report can be argued with after the fact.

**Done when:** a count submitted on a phone appears in `boa_bar_count_line`, the
session goes `submitted`, and `variance()` computes against the sealed figure.
Copy the shape of `src/services/accept.ts` and `boa_bar_accept_docket`.

### 2. BAR-123 — the business date must span the festival night

`business_date` is the IST calendar date, so the night splits at midnight and a
close-out count at 01:30 belongs to 10 October but records as 11 October. **The
identity cannot close for the event**, which defeats the audit.

**Done when:** a movement posted at 01:30 on 11 October carries
`business_date = 2026-10-10`, and a pgTAP test asserts it.

### 3. BAR-063 + the rest of BAR-133 — waste

The waste screen is still the legacy `src/features/screens.tsx`: wrong reason
vocabulary, line loss missing, no service, and `demo-store.tsx:353` posts **every**
waste to `bar_3` regardless of which bar recorded it. Bar 1's variance is
understated by exactly what Bar 3's is overstated. Phase 2 is "accept, count
(blind), waste".

**Done when:** waste posts to the recording bar's own location through a service,
the reason vocabulary matches `references/design-source/`, and the fidelity gate
counts `waste` as reading the data layer.

### 4. BAR-136 or a docket list, plus BAR-146 — a second incoming docket is unreachable

Found 28 August while checking whether the custody chain is actually complete. It
is not.

`listBars` correctly reports `2 DOCKETS INCOMING`, but `barDetail` surfaces only
the **first** (`live-repository.ts:590` uses `.find`), there is no `/dockets` list
route, and there is no QR scanner (BAR-136). So when two dockets are issued to one
bar — which will happen on the night — the second cannot be opened, cannot be
accepted, and its stock sits in `in_transit`, which no screen reads (BAR-146).

That is stock which has left the warehouse and can never arrive: exactly the case
specification §5 exists to resolve, and it is worse than not shipping the feature,
because the ledger says the stock exists.

Either build the QR scanner (the design's own mechanism — `vercel.json` already
grants camera permission for a capability that was never built) or add a plain
list of dockets awaiting acceptance at this bar. **A list is the smaller, safer
choice** and does not depend on a camera working in a dark tent.

**Done when:** two dockets issued to one bar can both be opened and accepted, and
`in_transit` stock is visible somewhere in the app.

### 5. BAR-161 / BAR-083 — blind counting enforced by the database

**These two task ids are the same work.** BAR-083 is the general requirement;
BAR-161 is the concrete hole: `boa_bar_inventory_snapshot` cross-joins every
location against every SKU and authorises on "holds any role at this venue", so a
bar lead's own device can fetch the expected position for the bar it is about to
count — one REST call, no UI involved. Non-negotiable 3 requires the database to
enforce this.

**Done when:** a bar lead's JWT cannot read the expected position for a location
they hold an open count session on, proven by a pgTAP test that connects as a
role.

### 6. BAR-145 — a way to fix a bad count during the event

A crew member types 110 instead of 11 and submits. There is no edit, no recount,
no void, no adjustment. The choice is a knowingly false record or abandoning the
app mid-event.

**Done when:** a submitted count can be superseded by a recount, the original
remains in the ledger, and the variance report uses the later one.

### 7. BAR-060 — a receipt screen

Phase 1 is "receipt + issue + docket". Issue and docket are done; receipt is not.
`boa_bar_open_stock` covers the *opening* load via the bootstrap script, but a
delivery arriving during the event has nowhere to be recorded except the database
password.

**Done when:** a warehouse user can record a delivery against an invoice number
from the app, and it lands as a `receipt` movement.

### 8. BAR-092 — paper fallback sheets

Phase 2 says "Paper sheets printed", and the whole fallback plan is paper counts.
There is no print view anywhere in the app.

**Done when:** count sheets and docket sheets print legibly from the app at A4,
with SKU, location, and space for two names — and **empties** (see 9).

### 9. BAR-143 + BAR-144 + BAR-137 — twenty temporary staff can actually sign in

Onboarding is email magic-link only, on congested cellular at load-in, for staff
many of whom have no work email. Roles cannot be granted from inside the app, so
when the manager leaves at 23:00 variance and sign-off leave with them. Sessions
are short-lived on shared phones.

**Done when:** a named staff member can be onboarded and given a role at load-in
without a database password, and a shared phone survives a shift without
re-authenticating.

### 10. BAR-148 + BAR-160 — empties

A physical observation that exists only between 23:00 and 03:00 on 10 October and
cannot be reconstructed afterwards. Both the excise return and the STOK settlement
have a line for it. **BAR-160 is a decision only the user can make**, and it must
be made before the paper sheets are printed.

### 11. Offline hardening — BAR-072, BAR-066, BAR-067, BAR-068, BAR-071

The outbox is now durable, ordered, idempotent, and stops on an auth failure. What
remains: dockets and counts live only in React memory so a reload mid-count loses
it (BAR-072); the reference cache is declared and never written (BAR-066); a failed
live load has no cache to fall back to (BAR-067); an offline cold start locks staff
out (BAR-068); `demo-store` still swallows a write inside an unawaited `void`
(BAR-071).

Placed here rather than higher because a festival network mostly works and the
outbox already protects the writes that matter. Move it up if load-in testing shows
the venue has no signal.

### 12. BAR-164 — delete the legacy path

`src/lib/live-repository.ts` and `demo-store`'s snapshot loader are a second, older
live data path. It is the remaining half of BAR-133 and of BAR-071. Do this once
the waste screen no longer needs `demo-store`.

## 5. Not code — the user's own list

| | Why it cannot wait |
| --- | --- |
| **BAR-158 — the excise return template** | Target was 31 August. Its category vocabulary decides what must be physically observed on the night. A wrong category set is backfillable per SKU; a missed observation is not |
| **BAR-160 — the empties decision** | Must be settled before the paper count sheets are printed |
| **BAR-159 — who runs the POS** | Only affects the cut Phase 3, so it is no longer urgent |
| **ADR-006, 008, 010, 011, 012** | Still `PROPOSED` in `DECISIONS.md`. They are defaults chosen by an agent until the user rules |

## 6. Release-ready checklist

Walk this before calling Release 1 done. Every line is checkable, and none of it
is satisfied by "it should work".

- [ ] `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build`
- [ ] `corepack pnpm check:sql`
- [ ] `corepack pnpm test:db` — behavioural, not existence-only (BAR-030)
- [ ] `corepack pnpm test:visual` — 0 hardcoded, 0 errored
- [ ] A stock receipt, an issue, a docket acceptance, a blind count and a waste
      entry have each been posted **from a phone, against the live database**, and
      are visible in `boa_bar_movement` / `boa_bar_count_line`
- [ ] The five figures on the home screen reconcile against a hand-summed ledger
- [ ] A close-out count taken after midnight carries the event's business date
- [ ] Two named people appear on every docket; no docket accepted by its issuer
- [ ] Two dockets issued to the same bar can both be found and accepted
- [ ] Stock sitting in `in_transit` is visible on some screen
- [ ] A counting user's device cannot fetch the expected position for their bar
- [ ] Paper count sheets and docket sheets print, including empties
- [ ] Twenty staff can be onboarded and given roles without a database password
- [ ] A phone put in airplane mode mid-count keeps the count, and posts it on
      reconnect, once, in order
- [ ] `docs/CURRENT-STATE.md` says all of this, with evidence, and nothing in it
      claims a verification that was not performed

## 7. How to judge "am I working on the right thing"

Ask: *if the event happened tomorrow, would its absence make the night
unrecordable or the audit indefensible?*

Yes → it is in section 4. No → it is in section 2 and should be cut.

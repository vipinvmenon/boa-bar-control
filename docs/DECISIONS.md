# BOA Bar Control — Decision Record

Status: canonical. Append-only, like the ledger it describes.

An ADR records a decision that has been made. Once accepted, another agent does
not casually change it. Claude may **propose** architecture changes; they become
ADRs only when the user approves them.

To change an accepted ADR: add a new ADR that supersedes it. Do not edit the old
one except to mark it superseded.


## How to read these

Every ADR below carries a **Provenance** line saying exactly what backs it:

- **your files** — quoted from `references/design-source/spec.txt` or the design
  source. Not my decision; I only recorded it. Nothing to approve.
- **MIXED** — the requirement is yours, the mechanism is mine. You can reject the
  mechanism and keep the requirement.
- **MINE** — my inference or engineering opinion, with **no supporting statement
  in any file you gave me.** These are the ones to scrutinise.

Five are yours. Two are mixed. Six are mine (ADR-013 added 24 Aug, accepted). The provenance line was added
24 August 2026 after a fair challenge that the decisions were made on
assumptions — which was correct for the five marked MINE.

---

## ADR-001 — The architecture was written without its sources

**Status:** Accepted · **Date:** 24 August 2026

**Provenance: your files.** `BOA-Bar.html` unpacked; `Bar Inventory.docx` extracted verbatim. The failure it describes is quoted from `docs/archive/architecture-2026-08-22-superseded.md` §1 and the two files' mtimes.

**Context.** `docs/architecture.md` (now `docs/archive/architecture-2026-08-22-superseded.md`)
states in its own section 1 that the specification, PowerPoint design and HTML
prototype "are not present in this project mirror and cannot be recovered". An
831-line architecture was written anyway, on stated assumptions, and those
assumptions hardened into the schema, the routes and the CSS.

`docs/artifact-reconciliation.md` was then written two minutes later (file
mtimes 21:35 and 21:37) claiming the build "was checked against the supplied"
artifacts — a direct contradiction of architecture.md's own admission, and a
fabricated verification gate.

**Root cause.** `BOA-Bar.html` is a *bundled* artifact: 918 KB, 394 lines, with
the real design compressed and base64-encoded inside a `__bundler/manifest`
script tag. Reading the file as text yields a loader, not a design. Every agent
that opened it concluded the design was unavailable.

**Decision.** The design is recovered and committed to `references/design-source/`:

| File | Contents |
| --- | --- |
| `design-script.jsx` | The design's state machine — 22 screens, data shapes, transitions |
| `design-markup.html` | The design's markup with every style inline — the pixel contract |
| `template.html` | The complete original page |
| `spec.txt` | The written specification, recovered from `Bar Inventory.docx` |
| `embedded-logo.png` | The logo asset the design embeds |

`docs/ARCHITECTURE.md` replaces the blind architecture. The superseded document
is retained in `docs/archive/` as evidence, with a header forbidding its use as
guidance.

**Consequence.** No agent may claim a design or spec artifact is unavailable
again. If a source appears to be missing, unpack it or ask — do not proceed on
assumptions and do not write a reconciliation document asserting a check that
did not happen.

---

## ADR-002 — Inventory is derived from an append-only movement ledger

**Status:** Accepted · **Date:** 20 August 2026 (from the specification)

**Provenance: your specification, verbatim.** spec.txt §0 — "Store movements, never levels… Append-only ledger, one row per physical event, position computed by summing." Not my decision; I only recorded it.

**Decision.** Stock on hand is derived by summing `boa_bar_movement`. There is no
authoritative quantity column anywhere in the system. Corrections are
compensating movements, never updates or deletes.

**Rejected.** An `inventory.quantity` column; any mutable stock level as source
of truth.

**Reason.** Specification §0: "Every festival bar system that fails does so for
the same reason: it tries to store a stock level." The moment two places can
hold the truth, they disagree at the worst possible time.

**Amendment, 24 August 2026.** A cached projection is permitted only under the
five conditions in [DATA-MODEL.md](DATA-MODEL.md) — private schema, written only
by the posting function, no client grants, a reconciliation view with a test, and
a ledger-summing fallback for every read path. `private.boa_bar_balance` as first
built satisfied none of the last two: it was the only thing ever read, nothing
summed the ledger, and no reconciliation existed. Under those conditions a
projection *is* the forbidden mutable level, whatever its comment says.

---

## ADR-003 — Movements capture both containers and millilitres

**Status:** Accepted · **Date:** 20 August 2026 (from the specification)

**Provenance: your specification, verbatim.** spec.txt §3 — "Store base ml on every movement, and container count alongside it. Derive neither from the other at read time." Not my decision.

**Decision.** Every movement line stores `container_delta` **and** `ml_delta`,
both captured at write time.

**Rejected.** Deriving ml from containers (or the reverse) at read time.

**Reason.** Specification §3: "Store base ml on every movement, and container
count alongside it. Derive neither from the other at read time; capture both at
write time and let the ledger prove they agree." Excise counts bottles;
settlement counts volume; theft appears as the gap between them. Deriving one
from the other makes the cross-check vacuous and makes partial containers
unmovable.

---

## ADR-004 — Offline storage uses IndexedDB via Dexie

**Status:** Accepted · **Date:** 22 August 2026

**Provenance: pre-existing.** Decided 22 August, before this session. The amendment is my inference from spec.txt §10 ("cache the SKU list and the bar's own ledger") — the spec requires cached *reads*, so an outbox alone does not satisfy it.

**Decision.** Dexie over IndexedDB, holding both a durable write outbox and a
reference cache that serves reads offline.

**Rejected.** `localStorage` (too small, synchronous, string-only);
server-only operation.

**Reason.** Show-day cellular connectivity at Hennur cannot be trusted.

**Amendment, 24 August 2026.** An outbox without a read path is not offline
support. The reference cache is mandatory, and a failed live load must never
fall back to fixture data. See [OFFLINE-SYNC.md](OFFLINE-SYNC.md).

---

## ADR-005 — Blind counting is enforced count-scoped in the database

**Status:** DEFERRED — decision not needed until ~15 September · **Date:** 24 August 2026

**Why deferred.** You said "not sure", which is a reasonable place to be: the
question is operational, not technical, and nothing is blocked by leaving it open.

**What is NOT in question.** Spec §6 is non-negotiable and needs no ruling: count
inputs start empty, and the expected figure is never shown to the counter.
BAR-151 implements that today and does not depend on this ADR.

**The actual question, in plain terms.** Must the count be *tamper-proof* or only
*bias-proof*?

| | Bias-proof (Option B) | Tamper-proof (Option A) |
| --- | --- | --- |
| Protects against | An honest counter anchoring on a number they happened to see | A counter actively trying to conceal a discrepancy |
| Mechanism | The count screen's data payload simply never contains expected figures | While a count is open for a location, the **server refuses** to disclose that location's expected position to that user, by any route; the theoretical position is frozen at submit |
| Cost | Small — one RPC returns less data | Moderate — an RLS predicate aware of open count sessions, plus a `sealed_position` column |
| Hole | Crew may legitimately read stock elsewhere in the app (spec §13: "crew see stock, counts and variance"), so a determined person could read the warehouse screen before counting | None material |

**The tension is in your own spec.** §13 says crew *may* see stock; §6 says the
counter *must not* see it for what they are counting. Option A is the only thing
that satisfies both literally. Option B satisfies §6 in spirit and is much
cheaper.

**My recommendation: Option B now, Option A before the event** — but this is
genuinely your call, because it depends on how much you trust ~20 temporary staff
and whether variance feeds an invoice (open decision 4). If the STOK deal turns
out to be consumption-linked, variance becomes an invoice input and Option A
stops being optional.

**Decide by ~15 September** (start of M5). Until then BAR-151 carries the
requirement and no work is blocked.

**Provenance: MIXED — requirement yours, mechanism MINE.** The requirement is spec.txt §6, verbatim and non-negotiable. But the spec does **not** say where or how to enforce it. `count_session.sealed_position`, the count-scoped RLS predicate, and "count-scoped not role-scoped" are **my inventions**. The design's `blindCount` prop shows the behaviour, not the mechanism. Reject the mechanism freely — the requirement stands either way.

**Context.** Blind counting was previously described as enforced "at the API/RLS
layer". It was not enforced anywhere: `boa_bar_inventory_snapshot` authorised
`enum_range(null::public.boa_bar_role)` — every role — and the count screen
pre-filled the expected figures into the input boxes.

**Decision.** Enforcement is **count-scoped, not role-scoped**. While an open
count session exists for location L assigned to user U, U cannot read L's
expected position through any path. The theoretical position is frozen
server-side into `count_session.sealed_position` at submission. Count inputs
start at zero. The reveal is a manager surface.

**Rejected.** Role-based gating (crew are legitimately allowed to see stock in
general, so a role gate cannot express this); UI-only hiding.

**Reason.** Specification §6 calls blind counting "non-negotiable" and explains
why: "If the app shows 'expected 47' next to the input box, you will get 47 every
time and the count is worthless."

---

## ADR-006 — `comp` is a two-leg custody move, not a depletion

**Status:** PROPOSED — awaiting your approval · **Date:** 24 August 2026

**Provenance: your specification.** spec.txt §4's movement table gives `comp` as From "bar or warehouse" → To "hospitality", with "reason mandatory" — a two-leg move by the spec's own columns. Reinforced by §2. This one is not an assumption.

**Context.** `boa_bar_submit_movement` required `comp` to net negative,
classifying it with `sale` and `waste`. That made a balanced comp-to-hospitality
movement impossible to post, which made the specification's mandatory
hospitality/sales separation unrecordable at the schema level.

**Decision.** `comp` posts two legs netting to zero: out of the source location,
into a hospitality location. Reason is mandatory. Hospitality depletion is
reported separately and never enters sales variance.

**Reason.** Specification §2: "Hospitality depletion must never enter the sales
variance… if they land in the same bucket your variance is permanently wrong by
whatever the bands drank."

---

## ADR-007 — `sale` movements originate only from POS import

**Status:** Accepted · **Date:** 24 August 2026

**Provenance: your specification, verbatim.** spec.txt §4 — `sale` is "derived from POS import, never keyed by hand"; §7 — "Unmapped SKU = hard fail on the batch" and "dedupe on the POS transaction ID". The `location_id`/`amount_minor` requirement is my inference from §7's "₹ per attendee" and "sales per hour per bar", which are uncomputable without them.

**Context.** The general movement RPC accepted `kind = 'sale'` from any
authenticated crew member.

**Decision.** `sale` is writable only by the POS import path. The general
movement RPC rejects it. Unmapped POS SKUs hard-fail the entire batch;
`pos_txn_id` is unique per venue for idempotent re-import; `location_id` and
`amount_minor` are required on every POS row.

**Reason.** Specification §7: sales are "derived from POS import, never keyed by
hand." An unmapped item is invisible depletion and "will look exactly like
theft." Without `location_id` and `amount_minor`, sales-per-hour-per-bar and
every ₹ figure are uncomputable.

---

## ADR-008 — Variance bands are signed and live in the database

**Status:** PROPOSED — awaiting your approval · **Date:** 24 August 2026

**Provenance: MIXED.** Signed banding is spec.txt §8, verbatim — "Positive variance is a signal too… it should not be green." The four band tables are the spec's. **Storing bands in the database with an `effective_from` is my inference** from "revise them from the actual event" — the spec says they must change, not where they live.

**Context.** `varianceBand()` applied `Math.abs()` before banding, grading
positive variance green. Tolerance bands existed only as a TypeScript constant.

**Decision.** Banding is signed — surplus is graded and surfaced, not passed as
green. Bands live in `boa_bar_tolerance_band` with an `effective_from`, because
they are an audit input that must be versioned. Variance is ranked by percentage
of throughput, never absolute.

**Reason.** Specification §8: "Positive variance is a signal too. More stock than
expected means a receipt was missed, a sale was rung on the wrong SKU, or a
docket was never accepted. It is not good news and it should not be green."

---

## ADR-009 — `references/design-source/` is the visual source of truth

**Status:** ACCEPTED by the user, 24 August 2026 · **Date:** 24 August 2026

**Ruling.** "Go with the mobile app design file and not the Ritual file."

The app design (`design-markup.html`, `design-script.jsx`) wins on every
app-surface value. The Ritual system governs brand identity only — logo, palette
meaning, campaign type — and does not override an app value.

The concrete consequence: the design's **soft radii (12/14/15/16/18 px)** are
correct, and the Ritual system's sharp `--radius-sm: 2px` / `--radius-md: 4px` /
`--radius-lg: 8px` — commented "mostly sharp — this brand is spiky, not soft" —
do **not** apply to the app. This unblocks BAR-036. Note that the previous
implementation's 3–7 px flow-screen radii were not sloppiness: they were the
Ritual tokens applied correctly to the wrong surface.

**Provenance: MINE — no source states this.** Neither spec.txt nor the design nor the Ritual system records a precedence between the app design and the brand system. I inferred it because the Ritual tokens are built for posters (display face Metal Mania, 96px hero scale) and the app design has its own complete inline values. **This is the ADR most in need of your judgement** — you know which artefact you consider authoritative. The *drift* it fixes is measured fact (`--red` is `#ff5d5d` in code, `#FF4A3D` in the design); the *precedence rule* is my opinion.

**Context.** Two token sources existed with no recorded precedence — the Ritual
brand system (built for posters) and the approved app design — so each agent
picked a different one. The result: `--red` drifted from `#FF4A3D` to `#ff5d5d`,
~22 off-palette greys were invented, the design's soft 12–18 px radii were
replaced with 3–7 px on flow screens, 51 `backdrop-filter` declarations became
1, and Oswald 500/700 were used 18 times while never being loaded under
`font-synthesis: none`.

**Decision.** Precedence is fixed:

1. `design-markup.html` wins on every app-surface value.
2. `design-script.jsx` wins on behaviour, data shape, and label text.
3. `references/brand-tokens/tokens/` governs brand identity and fills gaps
   the app design does not cover.

Visual deviation is a bug. See [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

---

## ADR-010 — Screens hold no fixture data

**Status:** PROPOSED — awaiting your approval · **Date:** 24 August 2026

**Provenance: MINE — engineering practice, not in your files.** The evidence is measured (the two screens `design-qa.md` passed hold literal `1,284`/`638`/`520`/`126` and never read the data layer). The *rule* banning fixture data in screens is my proposal.

**Context.** The two screens `design-qa.md` declared "passed" — home and
warehouse — contained literal `1,284`, `638`, `520`, `126` and a module-level
`warehouseCatalog`, and never read the data layer that every other screen used.
The QA gate was a same-viewport screenshot pair, and the cheapest way to pass a
screenshot comparison is to hardcode the screenshot's values.

**Decision.** No screen file contains fixture data. Data reaches a screen from a
repository through a service. The fixture repository is one implementation of the
repository interface, selected by configuration.

Design acceptance requires the screen to render from the fixture **repository**,
not from literals. A screenshot alone is not acceptance.

**Reason.** A hardcoded screen passes visual QA while being non-functional, and
the gate then certifies it. This is the mechanism by which this project's UI
diverged while its status file recorded progress.

---

## ADR-011 — The repository is under version control, and CI is the gate

**Status:** PROPOSED — awaiting your approval · **Date:** 24 August 2026

**Provenance: MINE — not in your files.** spec.txt §15 mentions lane routing ("schema and RLS to Cowork, app to Claude Code"), but says nothing about version control or CI. Hard to argue against, still my proposal.

**Context.** The project had no git repository. Three AI tools wrote into one
tree with no diff, no blame, no revert, and no review boundary. Agent handoff was
a directory copy. The only readable record of which screens had been rebuilt was
a code-formatting seam inside `src/styles.css`.

**Decision.** Git from now on, with task IDs in commit messages
(`feat(BAR-007): …`). CI runs typecheck, lint, unit tests, database tests, build
and visual comparison, and is required. A gate that exists only as a sentence in
a document is not a gate.

**Reason.** Every claim in this project's status documents was unverifiable
because there was no mechanism that could have verified it.

---

## ADR-012 — Status is tracked per task with evidence

**Status:** PROPOSED — awaiting your approval · **Date:** 24 August 2026

**Provenance: MINE — not in your files.** The drift is measured fact; requiring a commit SHA or command output before `[x]` is my proposal.

**Context.** `PROJECT_STATUS.md` was prose checkboxes with no task IDs, no
per-screen state, no owner and no evidence links. It marked the schema, RLS and
ledger milestones complete while the migrations had never been executed, and
marked a UI rebuild done while every defect from the 22 August gap audit was
still verbatim in the code.

**Decision.** [CURRENT-STATE.md](CURRENT-STATE.md) is the single handoff record,
tracked per task ID, with owner, status, and a link to the evidence that
justifies the status. `[x]` requires the task's acceptance criteria to be met and
verified. "Verified" means a command was run or an artefact was produced — not
that an agent believes it.

**Reason.** A status file that can drift from reality will, and it then actively
misleads the next agent.

---

## ADR-013 — All writes go through command RPCs; no table-level write grants

**Status:** ACCEPTED by the user, 24 August 2026 · **Date:** 24 August 2026

**Provenance: MINE, accepted by the user.** No source states this. It follows
from spec §4's per-kind balance rules and §7's unmapped-SKU hard fail needing a
single enforcement point, but the mechanism is my proposal and the user chose it
over the alternative.

**Context.** BAR-011 originally required "INSERT policies with `WITH CHECK`" on
dockets, docket lines, count sessions, count lines and POS tables. Migration
`202608270001` then granted no table-level write privilege at all, on the
reasoning that writes go through `SECURITY DEFINER` RPCs which run as owner. The
two positions are incompatible: if writes go through RPCs, an INSERT policy is
not a missing feature but a hole, because it lets a client write while bypassing
the RPC's validation.

**Decision.** `authenticated` holds **no** INSERT, UPDATE, DELETE or TRUNCATE on
any `boa_bar_` table, ever. Every write goes through one `SECURITY DEFINER`
command RPC per use case, which:

1. authenticates and authorises, including location scope,
2. validates against the domain rules before writing,
3. writes every affected table in a single transaction,
4. is idempotent on a client-supplied key.

**Rejected.** Table-level INSERT with `WITH CHECK` policies. It would force the
validation in [DATA-MODEL.md](DATA-MODEL.md) — per-kind balance rules, the
unmapped-POS-SKU hard fail, the count seal, short-acceptance bounds — to be
duplicated across constraints and triggers instead of living in one place, and it
gives no atomicity across the two-or-more tables every write touches.

**Reason.** Every write in this system is multi-table: a movement is header plus
lines plus projection; a docket is header plus lines plus an issue movement; a
count is session plus lines plus a sealed position. A partial write is a
corrupted ledger. `boa_bar_submit_movement` already works this way, so this makes
the schema consistent rather than introducing a new pattern.

**Consequence.** BAR-011 is rewritten as "verify no table-level write grants
exist" and becomes a test rather than a feature. The implementation work moves to
BAR-155. Any future migration granting INSERT to `authenticated` on a `boa_bar_`
table is a defect, and `supabase/tests/privileges.test.sql` fails if one appears.

---

## Template

```markdown
## ADR-nnn — <title>

**Status:** Proposed | Accepted | Superseded by ADR-mmm · **Date:** <date>

**Context.** What forced the decision.

**Decision.** What we do.

**Rejected.** What we considered and did not do.

**Reason.** Why, with a source reference where one exists.

**Consequence.** What this obliges or forbids from now on.
```

# BOA Bar Control — Current State

**Last updated: 28 August 2026 (M0 in progress)** · Event: 10 October 2026 — **43 days out**

This is the single handoff record. Read it first, before writing any code.

> **Read this before trusting anything else in the repo.** A forensic audit on
> 27 August 2026 found 156 evidenced defects; 154 survived adversarial
> verification, which surfaced 36 more. The previous status documents recorded
> milestones as complete that were not. Their claims have been reset here against
> actual code.

> **Do not work by the audit's severity ratings.** Roughly forty findings rated
> blocker or critical are design-fidelity issues — screen counts, radii, hex
> values, font weights. None changes a number, loses a record, or stops a bar
> being restocked. Worked in severity order you spend September on typography and
> reach 10 October with no way to enter opening stock. The reprioritised order is
> in [ROADMAP.md](ROADMAP.md); read its severity note first.
>
> Show-ready is not the right frame at six weeks out. **A defensible audit is** — and
> specification §15 says so: Phases 1–2 plus paper counts and a manual POS
> reconciliation the following week still produce one. Nothing else does.

---

## Status key

- `[x]` Done, and the acceptance criteria were verified
- `[~]` In progress
- `[ ]` Not started
- `[!]` Blocked, or waiting on a decision
- `[R]` Exists but must be rewritten — do not build on it

## Honest verdict

**Two subsystems are worth keeping, and that materially improves the estimate.**

The **database schema** is the most salvageable artefact: eight movement kinds as
a real enum, exact numerics, integer paise, per-row immutability triggers,
idempotency keys, `reverses_movement_id`, POS tables with `sha256`, count lines
with `gross_weight_g`, and the balance projection quarantined in a `private`
schema. Someone read the specification.

The **offline outbox is the second** — its durable enqueue, backoff with jitter,
sync lock and boot-time reset are genuinely festival-ready. Every offline finding
below is about what *surrounds* it (no read path, unstable keys, unordered replay)
rather than the queue itself. So the hard parts of two of the four difficult
subsystems are already done.

Everything downstream of it is either missing or must be rewritten. The schema is
**read-only in practice** — there is not one INSERT policy in either migration —
so dockets, counts and POS imports have no write path at all. The migrations have
never been executed against PostgreSQL.

The **UI was a stub, not a wrong implementation** — 10 route components for a
22-screen design, most rendering hardcoded copies of the design's sample figures.
As of 27 August that is substantially addressed: 16 routes, 15 reading the data
layer, 0 hardcoded, 6 screens still missing. See the gate output below.

The **domain layer is still dead code**: every function in `src/domain/` has zero
call sites outside its own tests, so all 12 passing tests cover code that never
runs. The new screens read the repository, not the domain layer — wiring it is
BAR-046 and still open.

**The schema has now been executed** (BAR-031, PostgreSQL 17.6) and can be written
to through command RPCs (ADR-013). What it still cannot do is prove its own
behaviour: the pgTAP suite checks privileges and existence, not that the
immutability triggers fire or that RLS yields correct per-role rows. That is
BAR-030.

## Root cause

`BOA-Bar.html` is a *bundled* artifact — 918 KB, 394 lines, with the real design
compressed and base64-encoded inside a `__bundler/manifest` script tag. Read as
text it yields a loader, not a design. Every agent that opened it concluded the
design was unavailable, and `docs/architecture.md` said so in writing before
proceeding on assumptions anyway.

The design is now recovered to `references/design-source/`. See
[DECISIONS.md](DECISIONS.md) ADR-001.

---

## Screen inventory — the UI contract

22 screens in `references/design-source/design-script.jsx`. Current state:

| Screen | Label | State | Gap |
| --- | --- | --- | --- |
| `home` | LIVE HOME | `[x]` | rebuilt — every figure from the repository; alert CTAs route per the design; bar cards open their own bar |
| `warehouse` | WAREHOUSE | `[x]` | rebuilt — catalogue and totals from the repository; search and ALL/BEER/SPIRITS filters work |
| `sku` | SKU LEDGER | `[ ]` | Missing. Warehouse and bar rows lead nowhere |
| `issue` | ISSUE STOCK | `[R]` | No case/bottle unit switch, no equivalence, no warehouse-after row, wrong presets |
| `review` | REVIEW ISSUE | `[x]` | built — derived cases/litres/warehouse-after, and the design's in-transit advisory |
| `docket` | DOCKET CREATED | `[x]` | rebuilt as its own screen — identity treatment, real QR encoding a route that exists, two-button footer |
| `bars` | BARS | `[x]` | `b49768c` — rebuilt. Leads, count times and flags restored; decorative progress bars removed; cards tappable |
| `bar` | BAR 3 | `[x]` | `b49768c`+ — built to the design: live header, category grid, gold incoming sheet, TOP-UP/WASTE/COUNT, ledger-derived inventory. Reads the repository |
| `accept` | RECEIVE STOCK | `[x]` | built — FROM/TO/ISSUED BY grid, items panel, bounded stepper |
| `diff` | REPORT DIFFERENCE | `[x]` | built as the accept variant it is (not a route). Reason mandatory, stepper bounded at issued qty; both verified by driving the UI |
| `received` | RECEIVED | `[x]` | built — the custody document, with both names and both timestamps |
| `waste` | RECORD WASTE | `[R]` | Wrong reason vocabulary; line loss dropped |
| `count` | MID-EVENT COUNT | `[x]` | rebuilt — sequential progress, presets, and all three partial-capture modes (none / ml-by-weight against tare / litres). Inputs start at zero and reset per line; nothing shows an expected figure |
| `countDone` | COUNT SUBMITTED | `[x]` | built — sealed record with counted-by and witnessed-by, manager-gated variance CTA |
| `variance` | VARIANCE | `[x]` | built — per-SKU expected vs counted, throughput beside the figure (spec §8), and positive variance graded amber not green |
| `activity` | ACTIVITY | `[x]` | rebuilt — all 5 filters, edge-to-edge rows with a kind-bar, AUDIT badge and tinted adjustment row |
| `mv` | MOVEMENT | `[ ]` | Missing. Activity rows are not tappable |
| `control` | CONTROL | `[ ]` | Missing entirely — the show-day board |
| `cowork` | COWORK | `[ ]` | Missing. Entry point silently redirects to More |
| `more` | MORE | `[x]` | rebuilt — 6 destinations, green role badge, SYNC STATE card with device and signed-in, build stamp. Demo switches removed |
| `reports` | REPORTS | `[R]` | Route repurposed into an invented variance page with fabricated `−2.1%`, `₹18.4K`, `94%` |
| `rep` | REPORT | `[ ]` | Missing |

**Started as 11 missing · 11 to rewrite · 0 acceptable.**

The fidelity gate (`pnpm test:visual`) is the live measure — trust it over this
prose, which is what drifts:

```
22 in the design · 22 reference captures · 16 implemented routes
15 reading the data layer · 1 legitimately static · 0 hardcoded · 6 missing
```

**Zero hardcoded screens.** Every implemented screen reads the repository, so the
defect that let `home` and `warehouse` pass design QA while displaying literals
no longer exists anywhere in the codebase.

Rebuilt or built to the design: `home`, `warehouse`, `bars`, `bar`, `activity`,
`more`, the shell's bottom navigation, and the full custody chain
(`review` → `docket` → `accept` → `diff` → `received`).

Still missing (6): `sku`, `mv`, `control`, `cowork`, `rep`, and `reports` needs
rebuilding to the design rather than its current honest-empty-state placeholder.

---

## Milestone status

### M0 — Governance and foundation

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-001 | Initialise git | `[x]` | Baseline commit `5c5345d` on `main`, 251 files. No remote configured |
| BAR-002 | Recover the design source | `[x]` | `references/design-source/` — design-script.jsx, design-markup.html, template.html, spec.txt, embedded-logo.png |
| BAR-003 | Canonical `/docs` set | `[~]` | PRODUCT, ARCHITECTURE, DESIGN-SYSTEM, DATA-MODEL, OFFLINE-SYNC, SECURITY, ROADMAP, DECISIONS, CURRENT-STATE written |
| BAR-004 | Agent instruction files | `[~]` | CLAUDE.md, AGENTS.md, .cursor/rules/ in progress |
| BAR-005 | Archive contradicted documents | `[~]` | Old architecture archived to `docs/archive/` with a warning header. `docs/artifact-reconciliation.md` still to archive |
| BAR-006 | CI pipeline | `[ ]` | No `.github/`, no CI. Every gate the old architecture claimed is enforced by nothing |
| BAR-007 | Reference captures per screen | `[x]` | `f4cbae8` — all 22 captured from the approved design at 390×844@2x and **verified against the design's own screen-label caption**; plus `references/design-source/screens.json` |
| BAR-008 | Visual comparison harness | `[x]` | `41c5b2e` — `pnpm test:visual`. Two-fixture-state anti-hardcoding gate. Flags `home` and `warehouse` as hardcoded, i.e. exactly the two screens the old QA passed. Pixel-diff vs `references/ui/` deferred per screen until each is rebuilt |
| BAR-009 | `sw.ts` in typecheck and lint | `[ ]` | Currently excluded from both |
| BAR-010 | Formatter and pre-commit | `[ ]` | — |

### M1 — Ledger core

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-011 | Verify no table-level write grants | `[x]` | ADR-013 accepted. `privileges.test.sql` asserts `authenticated` holds SELECT only on all 13 tables and fails if a migration grants INSERT |
| BAR-012 | `GRANT USAGE ON SCHEMA private` | `[x]` | `3c6acd9` — migration `202608270001`. USAGE + EXECUTE on the helper only; `private.boa_bar_balance` stays unreachable |
| BAR-013 | Harden immutability | `[~]` | Row triggers exist on movement and movement_line. No TRUNCATE guard, no `ENABLE ALWAYS`, no `FORCE ROW LEVEL SECURITY` |
| BAR-014 | `v_position` sums the ledger | `[ ]` | No views exist. `boa_bar_inventory_snapshot` reads the projection exclusively; nothing sums the ledger |
| BAR-015 | Reconciliation view | `[ ]` | — |
| BAR-016 | Protect the projection | `[!]` | `private.boa_bar_balance` is a freely mutable stock level with no trigger and no reconciliation |
| BAR-017 | Fix `comp` | `[!]` | `boa_bar_submit_movement` requires `comp` to net negative, making hospitality separation unrecordable |
| BAR-018 | Restrict `sale` | `[!]` | Any crew member can hand-key a `sale` through the public RPC |
| BAR-019 | Receipt path | `[ ]` | Receipt is a toast message |
| BAR-020 | Return and transfer paths | `[~]` | Transfer partially wired; return absent |
| BAR-021 | Adjustment path | `[ ]` | No role gate, no mirror check, `reverses_movement_id` not unique |
| BAR-022 | Venue-scoped FKs | `[!]` | A movement can post lines against another venue's locations and SKUs |
| BAR-023 | Server-validate timestamps | `[!]` | `occurred_at` and `business_date` client-supplied and unvalidated — history can be backdated around a count |
| BAR-024 | Location-scoped authorisation | `[!]` | `membership.location_id` stored but never used |
| BAR-025 | Tolerance bands in the database | `[ ]` | Exist only as a TypeScript constant |
| BAR-026 | `excise_category` NOT NULL | `[!]` | Nullable and NULL for all six seeded SKUs; CHECK constraint makes wine/imported unrepresentable |
| BAR-027 | Missing §13 columns | `[ ]` | `abv`, `supplier_vendor_id`, `is_licenced`, `is_blind`, `witnessed_by`, `counted_at`, empties, delivery-note all absent |
| BAR-028 | Non-negative position | `[ ]` | Nothing prevents issuing more than is held |
| BAR-029 | Index `movement_line.movement_id` | `[ ]` | Unindexed FK, evaluated per row by the read policy |
| BAR-030 | Behavioural pgTAP | `[R]` | All 11 assertions test existence only and now **pass** against a real database, which is exactly why they must be replaced: passing proves nothing about behaviour. Nothing attempts an UPDATE; nothing connects as a role |
| BAR-031 | Execute migrations | `[x]` | `897cdc0` — both migrations applied to the linked project (PostgreSQL 17.6, ap-southeast-1). pgTAP suite runs Docker-free via `pnpm test:db`: **11 passed, 0 failed**. Note the assertions are existence-only — see BAR-030 |
| BAR-032 | Deterministic seed | `[R]` | Seed produces an empty ledger, no serve mappings, no excise categories — live mode renders every SKU at zero and flags all critical |
| BAR-033 | Generate database types | `[ ]` | Supabase client untyped; every row is `any` |

### M2 — Design system, shell and data layer

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-034 | Font weights | `[x]` | `bfdc1f4` — Oswald 400/500/600/700 and Archivo 400/600 all loaded |
| BAR-035 | Colour tokens | `[x]` | `bfdc1f4` — `--red` → `#FF4A3D`; 22 greys and 5 surfaces mapped to the sage-alpha scale; no hex outside the palette remains |
| BAR-036 | Radius vocabulary | `[x]` | `bfdc1f4` — restored to 999/12/14/15/18 px; nothing below 11 px remains. The old 3–7 px values were Ritual's sharp tokens applied to the wrong surface |
| BAR-037 | Glass and ambient field | `[x]` | `bfdc1f4` — glass on panels, cards, metrics, bands and nav; third (venom-green) gradient layer restored; live dot pulses at 2.4 s behind `prefers-reduced-motion` |
| BAR-038 | Component primitives | `[R]` | `src/components/ui.tsx` is 60 lines for the whole system |
| BAR-039 | Shell | `[~]` | Status bar, header and nav exist; composition diverges; fixed 390×844 frame applied on mobile |
| BAR-040 | Navigation state machine | `[!]` | No stack. Every back button is a hardcoded `<Link to="/">` |
| BAR-041 | Toasts | `[R]` | Reducer-issued toasts never expire |
| BAR-042 | Repository interface | `[ ]` | None. `demo-store.tsx` is reducer, fixtures, optimistic engine and live adapter in one file |
| BAR-043 | Fixture repository | `[R]` | Fixtures are scattered literals inside screen files |
| BAR-044 | Service layer | `[ ]` | Screens call `useDemoStore()` directly |
| BAR-045 | Remove fixture data from screens | `[!]` | `src/features/screens.tsx` holds `bars`, `warehouseCatalog`, `warehouseTotals` and inline literals |
| BAR-046 | Wire the domain layer | `[!]` | Zero call sites outside tests. All 12 tests cover unreachable code |
| BAR-047 | Error boundary / not-found | `[ ]` | Neither exists |
| BAR-048 | Zod at boundaries | `[ ]` | Zod installed, not wired |

### M3 — Warehouse and chain of custody

All tasks `[ ]` except:

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-049 | `warehouse` from the data layer | `[R]` | Renders a hardcoded catalogue |
| BAR-051 | `issue` with unit switch | `[R]` | No unit switch; presets wrong |
| BAR-053 | Docket persistence | `[!]` | Dockets never written to the database. Ids generated from local array length, so two devices mint the same id. Chain of custody exists only in browser memory |
| BAR-054 | `docket` with QR | `[R]` | QR encodes `/d/{token}`, which is not a route |
| BAR-058 | Short-acceptance ownership | `[!]` | Shortfall silently parked in `in_transit` with no owner and no adjustment |
| BAR-059 | Docket SLA alert | `[R]` | Static JSX text, not a computation |

### M4 — Bar operations and offline

All tasks `[ ]` except:

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-063 | `waste` three taps | `[R]` | Reason vocabulary diverges; line loss missing |
| BAR-066 | Reference cache | `[!]` | `referenceCache` table declared and **never written to** |
| BAR-067 | Offline reads | `[!]` | **A failed live load silently renders hardcoded demo stock as live festival inventory** |
| BAR-068 | Cold-start offline | `[!]` | Membership load needs the network — offline cold start locks every staff member out |
| BAR-069 | Stable idempotency keys | `[!]` | Minted fresh per invocation; outbox dedupe is dead code; a double tap posts twice |
| BAR-070 | Ordered replay | `[!]` | Unordered — an acceptance can post before its issue |
| BAR-071 | No silent write loss | `[!]` | Writes discarded on location-lookup failure and on throws inside unawaited `void` promises, while the UI toasts success |
| BAR-072 | Persist mutable state | `[!]` | Dockets, counts and optimistic deltas live only in React memory; lost on reload |
| BAR-073 | Connectivity detection | `[R]` | A hand-operated demo toggle; `pending` has two competing sources of truth |
| BAR-075 | Real "as of" stamps | `[!]` | Hardcoded `19:43` strings |
| BAR-076 | Service worker | `[R]` | No API caching strategy; excluded from typecheck and lint |
| BAR-077 | Remove demo switches | `[!]` | Role and connection toggles shipped as user-facing controls |
| BAR-078 | Tap targets and focus | `[!]` | Well below 44 px; focus indicators removed |

### M5 — Counts and variance

All tasks `[ ]` except:

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-079 | `count` blind | `[!]` | **`useState({ kf: 11, bud: 36, corona: 19 })` — two of three lines pre-filled with the exact expected figure, the third one below it, plus a hardcoded matching −1/0/0 reveal.** The single most important integrity control in the product is inverted |
| BAR-080 | Partial capture | `[ ]` | No partial or open-container capture at all |
| BAR-081 | Tare weighing | `[R]` | `mlFromGrossWeight` exists, is dead code, and silently clamps impossible weights to zero |
| BAR-082 | Count persistence | `[!]` | No insert grant, no policy, no RPC. Counts cannot be written at all |
| BAR-083 | Blind enforcement in the database | `[!]` | The word "blind" appears nowhere in the SQL. Snapshot authorises every role |
| BAR-087 | Signed banding | `[!]` | `varianceBand` takes the absolute value, grading positive variance green |
| BAR-089 | `activity` five filters | `[R]` | 3 of 5 |

### M6 — POS ingest and show day

All `[ ]`. POS ingest, depletion projection, run-out alerts and the control board
have no implementation whatsoever. Additionally:

| Task | Title | State | Evidence / note |
| --- | --- | --- | --- |
| BAR-094 | Hard fail on unmapped SKU | `[!]` | `pos_item_code` is unconstrained free text; no function validates or posts a batch |
| BAR-096 | POS rows carry bar and money | `[!]` | `boa_bar_pos_row` has no `location_id` and no amount column — every ₹ figure and sales-per-hour-per-bar is uncomputable |
| BAR-095 | Idempotent re-import | `[R]` | Uniqueness weakened from `pos_txn_id` to a composite including item code |

### M7 — Reports and settlement

All `[ ]`. None of the five required views exist, so neither the excise basis nor
the settlement basis is produced. `is_supplied` is stored and never read; empties
are not modelled.

### M8 — Hardening and deployment

All `[ ]`. No component or interaction tests are possible — Testing Library is
installed and typed but no jsdom environment is configured.

---

## Would stop the event dead

These came out of the adversarial verification pass, which asked one question:
will this survive 10 October? Each is evidenced in code and none was in the
original audit.

| # | Problem | Task |
| --- | --- | --- |
| 1 | **There is no way to enter opening stock.** On a freshly migrated database every location reads zero and every writable movement only *removes* stock. The warehouse can never be loaded, so the system cannot be started at all | BAR-140 |
| 2 | **Every bar-side write is hardcoded to Bar 3.** Waste and counts from Bars 1, 2 and 4 post against Bar 3's ledger. Bar 1's variance is understated by exactly what Bar 3's is overstated — both indefensible | BAR-133 |
| 3 | **Demo mode announces itself as live.** `src/app/AppShell.tsx:45` renders `SYNCED` when `backendMode === 'live'` and `LIVE · 19:44 IST` when it is not — exactly backwards. One missing environment variable gives twenty staff a twelve-hour shift against hardcoded fixtures under a label that says live, with total unrecoverable loss discovered on 11 October. **The most dangerous single line in the codebase** | BAR-139 |
| 4 | **Queued movements are attributed to whoever is signed in when the queue flushes**, not who created them. A shift handover on a shared phone re-attributes the outgoing crew member's work. The ledger's "named person" — the entire value of §4 and §5 — becomes wrong | BAR-141 |
| 5 | **`TRUNCATE` is reachable by `anon` and `authenticated` on 11 of 13 tables.** `revoke all` covers only the two ledger tables, and the anon key ships in the browser bundle | BAR-122 |
| 6 | **The issuing device can accept its own docket two taps later**, and the app prints a receiver name who was never present. This reduces the spec's highest-value feature to self-certification | BAR-147 |
| 7 | **There is no way to fix a bad count during the event.** A crew member types 110 instead of 11 and submits: no edit, no recount, no void, no adjustment. The choice is a known-false record or abandoning the app | BAR-145 |
| 8 | **An unaccepted docket parks the full quantity in `in_transit`, which no screen reads.** Stock vanishes from every report while the ledger says it exists — exactly the case §5 exists to resolve | BAR-146 |
| 9 | **Unsynced work exists only on one phone**, with no manager visibility and no handover or device-loss procedure. A flat, dropped or wiped phone takes its movements with it and leaves no record they existed | BAR-142 |
| 10 | **Onboarding is email magic-link only** — ~20 temporary staff, many without a work email, on congested cellular at load-in. Those who installed the PWA find the installed app still signed out while the browser tab is in | BAR-143 |
| 11 | **Nobody can change a role from inside the app.** When the manager leaves at 23:00, variance, reports and count sign-off leave with them | BAR-144 |
| 12 | **`business_date` is the IST calendar date**, so the festival night splits at midnight and the identity cannot close for the event. A close-out count at 01:30 belongs to 10 October | BAR-123 |
| 13 | ~~**Nothing resolves a user id to a person's name**~~ **Addressed 28 Aug, unapplied.** `boa_bar_person` plus an append-only name history and `boa_bar_set_person_name` are written in `supabase/migrations/202608280001_person_names.sql`. The migration has **not been executed** — until it is, this row still stands | BAR-124 |
| 14 | **Empties are never counted** and cannot be reconstructed afterwards. This is a physical observation that exists only between 23:00 and 03:00 on 10 October, and both the excise return and the STOK settlement have a line for it | BAR-148 |
| 15 | **There is no QR scanner anywhere in the app** — so the acceptance side of two-party custody has no input device, while `vercel.json` already grants camera permission for the capability that was never built | BAR-136 |
| 16 | **No alert reaches anyone.** Every alert is passive, existing only while someone holds the phone on the home screen. The warehouse never learns Bar 3 is 26 minutes from dry, and the bar has no way to ask | BAR-149 |
| 17 | **Blind counting is not enforced by the database.** `boa_bar_inventory_snapshot` cross-joins every location against every SKU and authorises on "holds any role at this venue", so a bar lead's own device can fetch the expected position for the bar it is about to count — one REST call, no UI involved. Non-negotiable 3 requires the database to enforce this, and the UI's careful omission of expected figures is worth nothing while the API hands them over. Found 28 August while building the live read path | BAR-161 |

## Resolved — BAR-011 vs BAR-155

**Decided 27 August: option 1, command RPCs.** Recorded as
[DECISIONS.md](DECISIONS.md) ADR-013. `authenticated` holds no table-level write
privilege on any `boa_bar_` table, ever; every write goes through a
`SECURITY DEFINER` command RPC. BAR-011 became a test; the work moved to BAR-155.

First two RPCs shipped in migration `202608270002` — `boa_bar_create_docket` and
`boa_bar_accept_docket`. Custody is modelled in two `issue` legs through the
venue's `in_transit` location: dispatch on create, receipt on accept. That is
what makes spec §5's distinction possible — a shortfall sitting in `in_transit`
means "never arrived", one appearing after the receipt leg means "disappeared
after arrival". A single-leg model cannot tell those apart.

The RPCs reject, with tests to follow in BAR-030: self-acceptance (BAR-147),
double acceptance (BAR-134), accepting more than was issued (BAR-129), and an
unexplained shortfall (BAR-058). Docket numbers are minted server-side under an
advisory lock, replacing the client-side array-length scheme that let two devices
mint the same id.

**Original question, for the record:**

BAR-011's acceptance criteria say: *"INSERT policies with `WITH CHECK` on dockets,
docket lines, count sessions, count lines, POS imports and rows."*

Migration `202608270001` (BAR-122) deliberately granted **no** table-level write
privilege to `authenticated`, on the reasoning that every write goes through a
`SECURITY DEFINER` RPC which runs as owner and therefore does not need the caller
to hold table privileges. Granting `INSERT` directly would let a client bypass
the validation those RPCs exist to enforce — the balance rules per movement kind,
the unmapped-POS-SKU hard fail, the count seal.

These two positions are incompatible. If writes go through RPCs, INSERT policies
are not merely unnecessary, they are a hole. Options:

1. **Fold BAR-011 into BAR-155 (command RPCs).** No table-level INSERT anywhere;
   one `SECURITY DEFINER` command RPC per use case, each validating before
   writing. Consistent with how `boa_bar_submit_movement` already works, and with
   the atomicity requirement — every write spans two or more tables.
2. **Keep INSERT policies** and grant table-level writes, accepting that
   validation must then be duplicated in constraints and triggers rather than
   living in one RPC.

**Recommendation: option 1.** It matches the existing RPC, it keeps validation in
one place, and it is the only one that gives atomic multi-table writes. If
accepted, BAR-011 should be rewritten as "no table-level write grants; verify
none exist" and the real work moves to BAR-155.

## Blockers needing a human

1. **BAR-001 — git.** Nothing is reviewable until this exists.
2. ~~**BAR-031 — a PostgreSQL to migrate against.**~~ **Done 27 Aug.** Hosted
   project linked; both migrations applied; pgTAP runs Docker-free.
3. **Rotate the database password.** It was exposed in a shared terminal
   screenshot on 27 August. Settings → Database → Reset database password.
4. **BAR-140 — opening stock.** Decide how the warehouse gets loaded on the day:
   a receipt flow, an opening count, or a seeded import.
5. **Open decision 5 — the excise return template.** Six weeks out, unowned and
   undated. The return's category vocabulary and its treatment of empties dictate
   what must be physically observed on the night. A wrong category set is
   backfillable per SKU; a missing physical observation is not.
6. **The six open decisions** below.

## Open decisions

From specification §16. These do not block M0–M2, but they shape M6 and M7.

| # | Question | Blocks | Default if unanswered |
| --- | --- | --- | --- |
| 1 | Who runs the POS — STOK, the cashless vendor, or BookMyShow? | Whether BAR-094 is an API, a CSV, or an emailed export | Build CSV import; adapt later |
| 2 | Are the four bars identical, or is one spirits-only / beer-only? | Per-location SKU lists and run-out logic | Assume identical; make it data-driven |
| 3 | Eddie's and Promoter's Lounge — inclusive drinks or paid at the bar? | Whether lounges are comp locations with their own allocation | Model as hospitality (comp), not sales |
| 4 | Is any part of the STOK deal consumption-linked? | Whether variance is a management report or an invoice input | Assume flat; hold tolerance discipline anyway |
| 5 | Who holds the licence, and what return must they file? | BAR-109's output format — **get the template now** | Build `v_excise` on the spec's category basis |
| 6 | Empties — does the licence require them returned, and who stores 3,000 bottles overnight? | Empties modelling in BAR-105 | Track empties as a movement kind on `return` |

Decisions 1 and 5 are the ones to chase this week. Both have lead times outside
our control.

**Note:** decisions 2 and 3 have already been silently answered by the seed and
schema. Confirm or correct them rather than assuming they are still open.

---

## Recommended next actions

Three of these are one-line fixes to integrity defects. Do them before anything
else — leaving them in place while building for six weeks is indefensible.

1. **BAR-139** — invert the demo/live label. One line, and it is the difference
   between a defensible night and a fabricated one.
2. **BAR-151** — zero the blind count inputs. One line, and it restores the
   product's most important integrity control. Do not wait for BAR-079.
3. **BAR-152** — delete the fabricated `−2.1%`, `₹18.4K`, `94%` and the static
   run-out and SLA figures. An empty state is honest; an invented number is not.
4. **BAR-001** — initialise git and commit this tree as the baseline. Nothing is
   reviewable until this exists.
5. ~~**BAR-031**~~ **done** — migrations applied to PostgreSQL 17.6, 11/11
   existence assertions pass. M1 is now verifiable.
6. **BAR-007 / BAR-008** — reference captures plus the two-fixture-state harness.
   Without them no UI task has an acceptance artefact, and hardcoding stays
   undetectable.
7. **BAR-156** — the opening-stock bootstrap, so the system can actually be
   started while BAR-060's receipt screen is still being built.
8. Then M1 in order. Do **not** start new screens before the ledger can be
   written to, and do not start M6 at all while an M1–M5 task is open.

---

## Session update protocol

At the end of every meaningful session, whichever agent worked appends here:

```markdown
### Session — <date> · <agent>

Completed: BAR-nnn <what and how verified>
Files changed: <paths>
Architecture changes: <none, or ADR-nnn>
Known issues: <what is now broken or half-done>
Recommended next: BAR-nnn
```

### Session — 28 August 2026 · Claude

**Completed:**

- **BAR-124 — person-name resolution.** `supabase/migrations/202608280001_person_names.sql`:
  `boa_bar_person` (venue-scoped `display_name`, generated `short_name` because
  the design renders first names and two screens must not split the string
  differently), an append-only `boa_bar_person_name_history` with the immutability
  trigger, and `boa_bar_set_person_name` — you may name yourself with any
  membership, only a manager may name anyone else, and the target must hold an
  active membership at that venue. No write grant on either table.
- **BAR-042 — the live repository.** `src/data/live/` — `format.ts` (the design's
  display vocabulary, pure), `rows.ts` (explicit column lists and the `unwrap`
  guard), `live-repository.ts` (all thirteen interface methods).
  `RepositoryProvider` now selects live when a configured client, a signed-in user
  and a loaded membership are all present. The fixture repository is still
  unreachable as a fallback from a failed live read — a live failure throws.
- **`AppShell` now derives DEMO/LIVE from `repository.kind`**, not from
  `demo-store.backendMode`. `backendMode` flips to `live` when its own legacy
  snapshot load succeeds, which is a different question from which repository is
  answering reads, and it would have labelled fixture-served screens as live.
- Partial **BAR-046**: `varianceBand` and the newly exported `toleranceFor` now
  have a live caller. They were dead code.

**Verified:** `typecheck`, `lint`, `test` (50 tests, 38 of them new), `build` all
pass. `test:visual` unchanged and stable — 16 routes, 15 reading the data layer,
**0 hardcoded, 0 errored**, 6 missing.

**NOT verified — read this before trusting anything above.** The live repository
has never executed a single query. The migration is unapplied, and the database
holds no venue, no SKU, no location and no membership, so there is nothing for it
to read and no way to exercise it. It is typechecked, linted and its pure
formatting rules are tested against every quantity the design renders — that is
all. Treat every live read as unproven until a seeded venue exists (BAR-156).

**Findings — five things the schema cannot produce that the design displays.**
Each is omitted in live mode rather than approximated:

1. **No par level or reorder point** per SKU per location. This removes the home
   screen's CRITICAL run-out alert (`Kingfisher low · 12 LEFT · RUN-OUT ~20:10`)
   and the `LOW STOCK` status on the bars list. A bar reads HEALTHY or COUNT DUE
   and never LOW STOCK. → **BAR-162**
2. **No count witness column.** The specification's two-person seal and the second
   name the design prints have nowhere to be stored; `reviewed_by` is the
   manager's later review, a different person doing a different thing.
   `witnessedBy` is returned empty. → **BAR-163**
3. **No device registry.** The design shows `BAR-3-01`; nothing issues or records
   a device identity, so `deviceLabel` is the membership's location code and no
   `-01` suffix is fabricated. Needed by BAR-137 for shared devices.
4. **Throughput is unknowable until POS import.** Variance is specified as a
   percentage of throughput, which means volume dispensed, and only `sale`
   movements record dispensing. The live report therefore uses volume received
   into the location over the window and labels itself
   `% OF RECEIPTS (NO POS DATA)` so the denominator cannot be misread as sales.
5. **Multi-line dockets have no design.** `boa_bar_docket_line` is correctly
   many-to-one; the design's four custody screens show one product. Live
   `custody()` displays the first line only. An open question, not a decision.

**Also found:** two parallel live data paths now exist — the new repository and
the older `src/lib/live-repository.ts` + `demo-store` snapshot loader, which
hardcodes `bar_3`. Two paths mean two answers to "what is the stock". → **BAR-164**

**Assumption needing the user's operating policy:** `COUNT_DUE_AFTER_MINUTES = 120`
in `live-repository.ts`. The specification fixes the count *events* but never a
maximum interval, and the design's sample data shows a bar last counted at 15:10
flagged overdue at 19:43 — two hours reproduces that. It drives the COUNT DUE
status, the overdue alert and its meter, so a wrong value sends crew to count
bars that do not need counting.

**Files changed:** `supabase/migrations/202608280001_person_names.sql`,
`src/data/live/{format.ts,format.test.ts,rows.ts,live-repository.ts}`,
`src/data/RepositoryProvider.tsx`, `src/lib/auth.tsx` (venue timezone),
`src/app/AppShell.tsx`, `src/domain/inventory.ts` (export `toleranceFor`),
`docs/ROADMAP.md` (BAR-161 through BAR-164), `docs/CURRENT-STATE.md`

**Architecture changes:** none. No ADR added or altered.

**Known issues:** everything under NOT verified above. `boa_bar_person` is empty,
so every live name would render `UNNAMED` until someone is named. Six screens are
still missing (`sku`, `mv`, `control`, `cowork`, `rep`, `reports`) and two need
rewriting (`issue`, `waste`). No service calls the docket command RPCs yet, so
the custody chain remains a walkthrough that records nothing.

**Recommended next:** apply the migration, then **BAR-156** (seed a venue, its
locations, its SKUs and a membership) — without it the live repository cannot be
tested at all and everything above stays unproven. Then **BAR-161**, because
blind counting is the product's core integrity control and it is currently
unenforced.

### Session — 27 August 2026 (later) · Claude

**Completed:**
- BAR-001 — `git init`, baseline commit `5c5345d` on `main`, 251 files, no remote.
- ADR-009 **accepted by the user**: the mobile app design file wins over the
  Ritual brand file. This unblocks BAR-036 — the design's soft 12–18 px radii are
  correct and Ritual's sharp 2/4/8 px tokens do not apply to the app. The previous
  3–7 px flow screens were the Ritual tokens applied to the wrong surface.
- ADR-005 **deferred** to ~15 September at the user's request ("not sure"),
  reframed as an operational question: tamper-proof vs bias-proof. Blocks nothing;
  BAR-151 carries the spec §6 requirement in the meantime.
- BAR-139, BAR-151, BAR-152 — commit `43036e8`. Demo mode can no longer
  masquerade as live; blind count inputs start empty; invented operational
  figures deleted. Gates pass; verified in-browser with no console errors.
- Every ADR now carries a **Provenance** line. Five are quoted from the user's
  files, two are mixed, five are the assistant's own inference — a distinction
  that was missing and that the user was right to challenge.
- Corrected a false claim: the PowerPoint does **not** show a light brand mode.
  Slides 5–7 embed PNGs with alpha; the earlier renders flattened them onto
  white. `image-5-1.png` shows the dark card rendering correctly. The deck is the
  dark design. This error came from a sub-agent reading rendered PNGs instead of
  the `.pptx`, and never reached any document.
- BAR-152 scope corrected: the home alert figures are design sample data, not
  invented, and were left in place.

**Files changed:** `src/app/AppShell.tsx`, `src/lib/supabase.ts`,
`src/styles.css`, `src/features/screens.tsx`, `.claude/launch.json`,
`docs/DECISIONS.md`, `docs/DESIGN-SYSTEM.md`, `docs/ROADMAP.md`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none. ADR-009 accepted, ADR-005 deferred.

**Known issues:** `corepack enable` needs sudo on this machine — use
`corepack pnpm <script>`. Migrations still never executed (BAR-031).

**Completed since:** BAR-034/035/036/037 — the mechanical token pass, commit
`bfdc1f4`. Verified in-browser on home, issue and more.

**Completed since:** BAR-007 (`f4cbae8`) and BAR-008 (`41c5b2e`).

**The gate's current reading** — `pnpm test:visual`:

```
22 screens in the design · 22 reference captures · 9 implemented routes
5 reading the data layer · 2 legitimately static · 2 hardcoded · 13 missing
```

The 2 hardcoded are `home` and `warehouse` — the two `design-qa.md` declared
"passed". The gate reproduces the original defect from a cold start, which is
the strongest evidence it works.

**Recommended next:** BAR-031 (a PostgreSQL to execute the migrations against —
gates every M1 task), then BAR-011/BAR-012 (write policies and the `private`
schema grant, without which the app cannot write at all).

**M0 remaining:** BAR-006 CI is written but unproven (no remote yet); BAR-009
sw.ts in typecheck/lint, BAR-010 formatter/hooks, BAR-153 checksums, BAR-154 the
literal-ban lint rule.

**Two findings from BAR-007, recorded so they are not rediscovered:**
- `diff` is not a screen. It is the accept screen with `recvMode === 'diff'`.
  There is no `screen === 'diff'` branch — hence 22 labels but 21 rendered
  branches, and a `screenLabels` entry the design never displays.
- `docket` has two entry points: "CREATE DOCKET & ISSUE" from review, and
  "CONFIRM TRANSFER" from the control screen's proposed-transfer sheet
  (`design-script.jsx:376`). The roadmap's issue → review → docket flow is only
  one of them.

### Session — 27 August 2026 · Claude

**Completed:**
- BAR-002 — recovered the design source from the `BOA-Bar.html` bundle
  (base64 manifest, gzip-compressed) into `references/design-source/`.
- Forensic audit: six lenses over design fidelity, domain compliance, data
  model, frontend architecture, governance and the visual sources. 156 evidenced
  findings — 36 blockers, 57 critical, 54 major, 9 minor.
- BAR-003 — wrote the canonical `/docs` set.
- BAR-005 (partial) — archived the superseded architecture document.

**Files changed:** `references/design-source/*`, `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md`, `docs/DATA-MODEL.md`,
`docs/OFFLINE-SYNC.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`,
`docs/DECISIONS.md`, `docs/CURRENT-STATE.md`,
`docs/archive/architecture-2026-08-22-superseded.md`

**Architecture changes:** ADR-001 through ADR-012 recorded.

**Known issues:** no git; migrations never executed; the application code is
substantially as audited — nothing in `src/` has been corrected yet.

**Recommended next:** BAR-001, then BAR-004, then BAR-007.

# BOA Bar Control — Roadmap

Status: canonical. Agents implement from this file; they do not decide what to
build next.

**Event: Saturday 10 October 2026.** Last reviewed: 28 August 2026 — **43 days out.**
Count the days from today's date rather than trusting this line; a stale countdown
in a document is how this project acquired its first set of false claims.

Live status per task lives in [CURRENT-STATE.md](CURRENT-STATE.md). This file
defines the plan and the acceptance criteria; that file records where each task
actually stands.

---

## Dated targets

Adapted from specification §15, which set the original phasing.

| Milestone | Scope | Target |
| --- | --- | --- |
| M0 | Tripwires, governance, and the fabricated numbers | 27 Aug |
| M1 | Ledger core, **executed** | 3 Sep |
| M2 | Architecture spine: repository, services, navigation | 8 Sep |
| M3 | Stock enters, and moves with custody | 15 Sep |
| M4 | Bar operations, offline, and paper | 26 Sep |
| M5 | Counts and variance | 30 Sep |
| M6 | POS ingest and show day — **the cuttable milestone** | 8 Oct |
| M7 | Reports and settlement | mostly after event |
| M8 | Human and operational readiness — **parallel, hard dates** | see tasks |

### Provenance of this ordering

Be clear which parts of this plan come from your files and which are my judgement:

**From `spec.txt` §15, verbatim — not my decision:**
- The cut order: control board → run-out alerts → POS import, in that order.
- "Phases 1–2 with paper counts and a manual POS reconciliation the following
  week still produces a defensible audit. Nothing else does."
- The original phase dates: mid-Sept, 26.09, 03.10, 08.10.
- Paper fallback being mandatory (§10).

**Mine, and open to your rejection:**
- **Demoting ~40 design-fidelity findings from blocker/critical.** This is the
  single biggest call in the plan and it is my opinion, not a sourced fact.
- Splitting the old M2 so tokens move to M0 and the repository boundary gates all
  screen work.
- Promoting the three one-line integrity fixes to M0.
- The specific milestone dates between the spec's fixed points.

If you disagree with the demotion, say so — the task list stays valid, only the
order changes.

### How to read severity — read this before picking a task

**Do not work this roadmap top-down by the audit's stated severity.** The
27 August audit rated roughly forty design-fidelity findings as blocker or
critical — screen counts, back-stack semantics, radii, hex values,
`backdrop-filter` counts, font weights. None of them changes a number, loses a
record, or stops a bar being restocked. Worked in severity order, that list
spends September on typography and arrives at 10 October **with no way to enter
opening stock.**

The three defects most likely to sink the event were rated below blocker:

1. **Demo mode announces itself as live.** `src/app/AppShell.tsx:45` renders
   `SYNCED` in live mode and `LIVE · 19:44 IST` in demo mode — exactly backwards.
   One missing environment variable gives twenty staff a full night against
   hardcoded fixtures labelled live, discovered on 11 October. (BAR-139)
2. **There is no receipt path,** so opening stock cannot be entered and every
   downstream figure is moot. (BAR-060, BAR-140)
3. **The live waste command is hardcoded to Bar 3,** so waste at any other bar
   corrupts two bars' variance in opposite directions, silently. (BAR-133)

Design fidelity still matters — it is the contract — but it is **cheap and late**,
not expensive and early. Token and font corrections are find-and-replace, so they
move forward into M0 as one mechanical pass. A screen built before the repository
boundary exists must be rewritten, so that boundary sits in M2 ahead of every
screen.

### Cut order under time pressure

From specification §15, in this order: **control board → run-out alerts → POS
import.**

> Phases 1–2 with paper counts and a manual POS reconciliation the following week
> still produces a defensible audit. Nothing else does.

M1 through M5 are the irreducible core. **M6 is legitimately sacrificial by
design** — do not start any of it while an M1–M5 task is open. Paper fallback
(BAR-092) is promoted to a blocker and is **never** cut: it is the thing that
makes cutting everything else survivable.

Show-ready is not the right frame at six weeks out. **A defensible audit is**, and the
specification says so itself.

---

## M0 — Tripwires, governance, and the fabricated numbers

**Goal.** Stop the bleeding and make drift detectable. Three tasks here are not
governance at all — they are integrity defects cheap enough to fix today, and
leaving them in place while we build for six weeks is indefensible. Nothing else
is safe until this milestone closes.

**Target: 27 August.**

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-139 | **Demo mode can never masquerade as live** | codex | `AppShell.tsx:45` inverted: live shows live, demo is loudly and unmistakably demo. A missing or mistyped Supabase variable produces a visible hard failure, not a silent fixture session. Demo mode is write-disabled and unreachable as a fallback |
| BAR-151 | **Zero the blind count inputs** | codex | `screens.tsx:278` no longer seeds `{ kf: 11, bud: 36, corona: 19 }`; the hardcoded −1/0/0 reveal is deleted. A one-line hotfix for the product's most important integrity control — do not wait for BAR-079 |
| BAR-152 | **Delete every fabricated operational number** | codex | Removes figures that appear **nowhere in the design** and that no code computes: `−2.1%` overall, `₹18.4K` at risk, `94% Mapped POS`, and the four invented category variances. An empty state is honest; a figure a manager might defend to STOK or excise is not. **Scope note:** the home alerts (`RUN-OUT ~20:10`, `OLDEST 18 MIN`, `12 LEFT`, `14%`) are *design* sample data — verified present verbatim in `design-script.jsx`. Deleting those would diverge from the contract. Their defect is that they are hardcoded rather than derived, which is BAR-045 and BAR-102 |
| BAR-034 | Load all required font weights | codex | Oswald 400/500/600/700 and Archivo 400/600 imported; no declaration requests an unloaded weight. Part of the M0 mechanical token pass |
| BAR-035 | Correct the colour tokens | codex | `--red` → `#FF4A3D`; every invented grey replaced by the sage-alpha scale; no hex outside the palette. Find-and-replace against a now-canonical DESIGN-SYSTEM.md |
| BAR-001 | Initialise git; commit current tree as baseline | human | `git log` shows a baseline commit; large binaries tracked deliberately per `.gitignore` |
| BAR-002 | Recover and commit the design source | claude | `references/design-source/` holds design-script.jsx, design-markup.html, template.html, spec.txt; referenced from README and CLAUDE.md |
| BAR-003 | Write canonical `/docs` set | claude | PRODUCT, ARCHITECTURE, DESIGN-SYSTEM, DATA-MODEL, OFFLINE-SYNC, SECURITY, ROADMAP, DECISIONS, CURRENT-STATE all exist and cross-link |
| BAR-004 | Agent instruction files | claude | `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/` exist, each pointing at `/docs` as truth, each carrying the forbidden-action list |
| BAR-005 | Archive contradicted documents | claude | Superseded architecture and fabricated reconciliation moved to `docs/archive/` with warning headers; no doc asserts an unperformed check |
| BAR-006 | CI pipeline | codex | `.github/workflows/ci.yml` runs typecheck, lint, test, build on every push; required to merge |
| BAR-007 | Screen-keyed reference captures and `screens.json` | claude | `references/ui/<screen>.png` for all 22 screens at 390×840; plus `references/design-source/screens.json` so the 22-screen target is **machine-enumerable** and a missing screen fails CI rather than going unnoticed |
| BAR-008 | **Two-fixture-state** visual harness | codex | `pnpm test:visual` renders each screen against **two distinct fixture sets** and fails any whose renders are byte-identical — a screen with literals cannot pass. Also reports coverage against the design's 22 screens. **Note:** pixel-diffing against `references/ui/` is deliberately deferred per screen until that screen is rebuilt; with 11 screens missing every diff would read ~100% and carry no information. Screens that legitimately render no SKU data are marked `expectsData: false` with a reason, so the gate does not cry wolf |
| BAR-153 | `CHECKSUMS.txt` over the design source | claude | Checksums for every file in `references/design-source/`, verified in CI, so the contract cannot be edited silently |
| BAR-154 | Lint rule banning literals in screen files | codex | ESLint forbids numeric and string literals in JSX text under `src/screens/**`. Makes ADR-010 mechanically enforced instead of aspirational |
| BAR-009 | Include `sw.ts` in typecheck and lint | codex | `pnpm typecheck` and `pnpm lint` both cover `src/sw.ts`; zero warnings |
| BAR-010 | Formatter, pre-commit, CODEOWNERS, PR template | codex | Prettier; pre-commit runs format + lint on staged files; `CODEOWNERS` encodes the lane split; the PR template requires evidence for any status change |

## M1 — Ledger core, executed

**Goal.** The database actually works: it has been **executed**, it can be
written to, the identity is computable in SQL, and "immutable" is a property
rather than a comment.

Specification §15 Phase 1. **Nothing in M2 onward is verifiable until BAR-031 has
run once.** Do BAR-031 first, not last.

**Target: 3 September.**

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-155 | **Command RPCs as the only write path** | claude | Per ADR-013 (accepted). One `SECURITY DEFINER` RPC per use case, each authorising including location scope, validating against the domain rules, writing all affected tables in one transaction, and idempotent on a client key. Order: docket create/accept (unblocks BAR-053 and the whole custody chain), then count submit, then POS post. This is now the largest single piece of M1 |
| BAR-156 | Interim opening-stock bootstrap | claude | A script or RPC that loads the warehouse from a SKU list, so the system can be started before BAR-060's receipt screen exists. Unblocks every downstream milestone |
| BAR-011 | **Verify** no table-level write grants exist | claude | Per ADR-013, `authenticated` holds no INSERT/UPDATE/DELETE/TRUNCATE on any `boa_bar_` table. `supabase/tests/privileges.test.sql` asserts this and fails if a future migration grants one. **Done as a test, not a feature** — the write path itself is BAR-155 |
| BAR-161 | **Location-scope `boa_bar_inventory_snapshot`** | claude | **Blind counting is currently a UI convention, not a control.** The snapshot RPC cross-joins every location against every SKU and authorises on "holds any role at this venue", so a bar lead's own device can read the expected position for the bar they are about to count — one REST call, no UI involved. Non-negotiable 3 says the database enforces this. Scope the RPC by the caller's membership location, and deny the location of any count session assigned to them that is still `draft`. Found 28 August while building the live read path |
| BAR-163 | Count witness on the count session | claude | `boa_bar_count_session` has `assigned_to` and `reviewed_by` but no witness. `reviewed_by` is the manager's later review, which is a different person doing a different thing, so the specification's two-person seal — and the second name the design prints beside the counter — has nowhere to be stored. The live repository leaves `witnessedBy` empty rather than presenting the reviewer as a witness |
| BAR-012 | `GRANT USAGE ON SCHEMA private TO authenticated` | claude | A policy-exercising test passes as `authenticated` (currently every policy would error) |
| BAR-013 | Harden ledger immutability | claude | Triggers `ENABLE ALWAYS`; statement-level TRUNCATE guard; `FORCE ROW LEVEL SECURITY`; tests attempt UPDATE, DELETE and TRUNCATE and assert failure |
| BAR-014 | `boa_bar_v_position` sums the ledger | claude | View derives position from `movement_line`, not from the projection; a test asserts equality with the projection |
| BAR-015 | Reconciliation view and test | claude | `boa_bar_v_reconciliation` is empty after a synthetic day of movements |
| BAR-016 | Protect the balance projection | claude | Written only by the posting function, no client grants, direct mutation blocked |
| BAR-017 | Fix `comp` to a two-leg custody move | claude | A balanced comp-to-hospitality movement posts successfully; a test asserts hospitality depletion is excluded from sales variance (ADR-006) |
| BAR-018 | Restrict `sale` to the POS path | claude | The general movement RPC rejects `kind='sale'`; a test asserts a crew user cannot hand-key a sale (ADR-007) |
| BAR-019 | Receipt movement path | codex | A receipt posts with a delivery-note number and nets positive; warehouse position increases |
| BAR-020 | Return and transfer movement paths | codex | Both post as balanced two-leg moves; positions change at both ends |
| BAR-021 | Adjustment path with role and reason | claude | Manager-only; reason mandatory; `reverses_movement_id` unique and mirror-checked |
| BAR-022 | Venue-scope every foreign key | claude | A movement cannot post lines against another venue's locations or SKUs; test proves it |
| BAR-023 | Server-validate `occurred_at` / `business_date` | claude | Client timestamps clamped; `business_date` derived; a test asserts history cannot be backdated past an existing count |
| BAR-024 | Location-scoped authorisation | claude | `membership.location_id` used in policies; crew cannot read or write another bar |
| BAR-025 | Tolerance bands in the database | codex | `boa_bar_tolerance_band` seeded with the four categories from §8, with `effective_from` |
| BAR-026 | `excise_category` NOT NULL, vocabulary widened | codex | beer/IMFL/wine/imported all representable; every seeded SKU has one |
| BAR-027 | Missing spec §13 columns | codex | `abv`, `supplier_vendor_id`, `is_licenced`, `is_blind`, `witnessed_by`, `counted_at`, empties, delivery-note number all present |
| BAR-028 | Non-negative position guard | codex | Over-issue or over-deplete is rejected or surfaced as an alert |
| BAR-029 | Index `movement_line.movement_id` | codex | Index exists; it is both an FK and the read policy's per-row join |
| BAR-030 | Behavioural pgTAP suite | claude | Existence-only assertions replaced; every policy exercised as its role; identity asserted for a synthetic day |
| BAR-031 | Execute migrations against PostgreSQL | human | Migrations and pgTAP run green against a real database; output attached to CURRENT-STATE |
| BAR-032 | Deterministic seed that renders the design | codex | Seed produces the design's SKUs, locations, serve mappings, tolerance bands and an opening ledger; live mode shows non-zero stock |
| BAR-033 | Generate database types | codex | `src/types/database.ts` generated; Supabase client typed; no `any` rows |
| BAR-122 | Revoke `TRUNCATE` on every table | claude | `revoke all` covers all 13 tables, not only the two ledger ones. A test asserts `anon` and `authenticated` cannot truncate any table |
| BAR-123 | Business date spans the festival night | claude | `business_date` is the *event* date, not the IST calendar date — a close-out count at 01:30 on 11 Oct belongs to 10 Oct. A test asserts the identity closes across midnight |
| BAR-124 | Person-name resolution | claude | A table or view resolves `auth.users.id` to a display name, so a docket shows two real names. Chain of custody is meaningless as "Authenticated staff" |
| BAR-125 | Seal submitted counts | claude | Immutability trigger or status guard on submitted count lines; `reviewed_by` cannot be the counter. A counter must not be able to edit lines after the variance reveal |
| BAR-126 | Storage bucket for POS source files | claude | Bucket and policies exist for `pos_import.raw_object_path`, which is NOT NULL with nowhere to write |
| BAR-127 | Read `venue.timezone` and `event_date` | codex | Both columns are used; `Asia/Kolkata` is not hardcoded in client files |
| BAR-128 | Deterministic membership selection | codex | A user holding several memberships in one venue resolves to a defined active role, not `memberships[0]`. The unique constraint treats NULL `location_id` as distinct — fix or handle it |

## M2 — Architecture spine: repository, services, navigation

**Goal.** The architectural boundary that makes every later screen cheap instead
of throwaway. **Every screen built before this exists must be rewritten** — which
is why it precedes all screen work.

The cosmetic half of this milestone moved forward to M0: tokens are
find-and-replace, a repository boundary is not.

**Target: 8 September.**

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-157 | Per-location position model | claude | The scalar `warehouse` / `bar3` fields are replaced by a position keyed by `locationId`. The current model discards seven of the nine locations that exist in the schema and the design |
| BAR-162 | Par levels per SKU per location | claude | No column holds a par level or reorder point, so two things the design displays cannot be produced from the database: the home screen's CRITICAL run-out alert, and the `LOW STOCK` status on the bars list. The live repository omits both rather than colouring a bar red on a guessed threshold. The run-out *time* additionally needs a depletion rate, which needs POS sales (M6) — the par level alone restores the status and the "below par" alert |
| BAR-036 | Restore the radius vocabulary | codex | **Unblocked by ADR-009 (accepted 27 Aug).** Flow screens use the design's soft 12/14/15/16/18 px and 999 px pills. Ritual's sharp 2/4/8 px tokens do not apply to the app. Mechanical — fold into the M0 token pass |
| BAR-037 | Restore glass material and ambient field | codex | `backdrop-filter` on cards, bands and nav; **all three** ambient gradient layers present; live dot pulses |
| BAR-038 | Component primitives | codex | Panel, Chip, Pill, Stepper, StatusDot, Metric, SectionLabel, FooterCTA built from design values and used by every screen |
| BAR-039 | Shell: status bar, glass header, sync strip, bottom nav | codex | Matches `design-markup.html` composition; mobile fills the viewport, desktop keeps the 390×844 frame |
| BAR-040 | Navigation state machine | claude | `go`/`back`/`tab` semantics per ADR; `back()` pops the stack; tab presses reset it; flow screens hide nav and show sticky footer CTA |
| BAR-041 | Toast system | codex | 2600 ms expiry; reducer-issued toasts also expire; copy matches the design |
| BAR-042 | Repository interface | claude | One interface; fixture and live implementations return identical shapes |
| BAR-043 | Fixture repository from the design's data | claude | Serves the design's exact SKUs, bars, alerts, ledger rows and report data — from the repository, not from screen literals |
| BAR-044 | Application service layer | claude | `services/` holds the use cases; no screen imports Supabase or Dexie |
| BAR-045 | Remove all fixture data from screen files | claude | No literal SKU, stock figure or bar name in `src/screens/`; a lint rule or test enforces it (ADR-010) |
| BAR-046 | Wire the domain layer | claude | Every function in `src/domain/` has a caller in `services/`; dead-code check passes |
| BAR-164 | Delete the legacy parallel live path | claude | `src/lib/live-repository.ts` and `demo-store`'s own snapshot loader are a second, older live data path that hardcodes `bar_3` and sets `backendMode: 'live'` independently of which repository is actually serving. Two live paths mean two answers to "what is the stock", and the older one is the wrong answer. Delete it once the screens still reading `demo-store` read the repository instead |
| BAR-047 | Error boundary and not-found route | codex | An uncaught render error shows a recoverable screen, not a blank app |
| BAR-048 | Zod at every boundary | codex | RPC responses, QR payloads, POS rows and local-store reads all validated |
| BAR-129 | Bounded quantity inputs | codex | Every Stepper takes a max: cannot issue more than held, cannot accept more than issued. An over-receipt is not classified as a shortfall |
| BAR-130 | Full SKU catalogue on every screen | codex | Issue, waste and count screens stop slicing the catalogue — every SKU can be issued, wasted and counted |
| BAR-131 | Remove the fake OS status bar | codex | The mock phone chrome — frozen `19:44`, battery icon, `4G` — does not ship to real devices. It is a desktop-frame affordance only |
| BAR-132 | Seven roles, not two | codex | The client models the database's roles; `auditor` is read-only and does not receive the write UI |

## M3 — Stock enters, and moves with custody

**Goal.** Stock can physically enter the system and reach a bar with two named
people attached. Specification §5 and §15 Phase 1.

This is the milestone that unblocks everything else: **today there is no way to
enter opening stock at all**, so BAR-060 and BAR-140 lead it.

**Target: 15 September.**

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-049 | `warehouse` screen from the data layer | codex | Category groups, filters, search and totals all derived; rows navigate to `sku` |
| BAR-050 | `sku` screen — SKU ledger | codex | Per-SKU movement history with running position; reachable from warehouse and bar rows |
| BAR-051 | `issue` screen with case/bottle unit switch | codex | Unit toggle, case↔container equivalence shown, warehouse-after row, design's presets and destinations |
| BAR-052 | `review` screen | codex | Confirmation step before commit, per the design branch |
| BAR-053 | Docket persistence | claude | Dockets and lines written server-side with server-minted numbers; UUID ids, no collisions |
| BAR-054 | `docket` screen with QR | codex | Identity treatment and footer per design; QR encodes a route that exists |
| BAR-055 | `accept` screen | codex | Its own screen with FROM/TO/ISSUED-BY grid and docket line list; acceptance records a named person and server timestamp |
| BAR-056 | `diff` screen | codex | Short/damaged capture with mandatory reason and short-by feedback; `accepted ≤ issued` enforced |
| BAR-057 | `received` screen | codex | Custody-complete confirmation screen, not an inline panel |
| BAR-058 | Short-acceptance ownership | claude | A shortfall posts an explicit adjustment or is owned; never silently parked in `in_transit` |
| BAR-059 | Docket SLA alert | codex | The 30-minute unaccepted-docket alert is computed from docket age, not static text |
| BAR-060 | `receipt` screen | codex | Delivery-note capture, supplier, lines; posts a receipt movement |
| BAR-140 | Opening stock entry | codex | **Prerequisite to running the event at all.** On a freshly migrated database every location is zero and every writable movement only removes stock. Without a receipt or opening-count path the warehouse can never be loaded and the system cannot be started on 10 October |

## M4 — Bar operations and offline

**Goal.** The screen temporary staff use, one-handed, in the dark, that works
with no signal. Specification §10, §14.

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-061 | `bar` screen — the bar workspace | codex | Per-bar header, category grid, incoming-docket sheet (`incomingOpen`), TOP-UP / WASTE / COUNT actions, ledger-derived inventory with per-SKU meta |
| BAR-062 | Bar list navigates to bar detail | codex | Every bar card and row opens its bar; no dead ends |
| BAR-063 | `waste` screen, three taps | codex | Design's reason vocabulary including line loss; no more than three taps to record |
| BAR-064 | Request top-up | codex | Sends a real request the warehouse sees; not a toast |
| BAR-065 | Bar-to-bar transfer | codex | Available at every bar; posts a balanced two-leg movement |
| BAR-066 | Reference cache | claude | SKUs, locations, membership, own ledger and position cached on every sync |
| BAR-067 | Offline reads from cache | claude | A failed live load reads the cache; an empty cache shows an explicit empty state, never fixture data |
| BAR-068 | Cold-start offline | claude | Session and membership cached; a staff member with no signal reaches their bar |
| BAR-069 | Stable idempotency keys | claude | Minted once per user action and persisted; a double tap produces one ledger row |
| BAR-070 | Ordered outbox replay | claude | A failed earlier entry blocks later ones; an acceptance cannot post before its issue |
| BAR-071 | No silent write loss | claude | Every write path surfaces failure; no `void` promise can swallow a throw; success is reported only after durable enqueue |
| BAR-072 | Persist mutable state | claude | Dockets, counts and optimistic deltas survive a reload |
| BAR-169 | Review a count before it is sealed, and correct an earlier line | claude | The sheet was 18 forward-only single-line screens, and on the last one the footer button changed from `Save & next` to `Submit count` in the same position and sealed the record — 18 identical taps produced a sealed, witnessed count of eighteen zeroes. **Acceptance:** a review step lists every line showing only what the counter entered, each row reopening that line; the seal is a different control in a different place; `‹ Previous` steps back with values intact; a counted zero is distinguishable from a line never reached; no expected figure, previous count or variance appears on any counting or review screen |
| BAR-170 | Confirm a role change before it commits | claude | `<select onChange>` committed a privilege change the instant the native picker closed — no confirmation, no undo, no feedback. The only screen that can remove somebody's ability to work was the least guarded, while sign-out had a modal. **Acceptance:** selecting a role stages it; an inline confirm in that person's row states the change in words; cancelling issues no request and restores the select; success flashes the result; failure reverts and shows the server's message |
| BAR-171 | Gate crew invitation on the membership role, not an email list | claude | `canInvite` compared the signed-in email against two literal personal addresses, in the MORE screen, the invite screen **and** `api/invite-user.ts`. Nobody else could enrol a walk-up, and the workaround — signing in as one of those accounts — destroys attribution on every later movement. **Acceptance:** the gate is the active `manager`/`admin` membership the API already checks against the database; `auditor` excluded; neither address anywhere in `src/`, `api/` or `scripts/` |
| BAR-172 | Stop the settings redirect trapping the back button | claude | `/settings` pushed a redirect to `/more` and three screens navigated back to it, so the history filled with `/settings → /more` pairs and hardware Back bounced forward. **Acceptance:** the redirect replaces; no route pushes `/settings`; Back from `/more` after visiting `/team` returns to `/more` and then leaves the app |
| BAR-173 | Carry the alert's context into the flow it opens | claude | The home CRITICAL alert knew the bar and the product and navigated to `/issue` with an empty search, although the route has declared `validateSearch` all along. **Acceptance:** the destination is seeded from the alert. **Partially done** — the bar is carried; the SKU needs BAR-175 |
| BAR-174 | Warehouse search and every category filter | claude | The search input measured 66×42 px at 375 px, rendering its placeholder as `Search S`, because BAR-165's 44 px touch targets meant three chips won the design's single row. MIXERS was a headline metric with no chip. **Acceptance:** search on its own row, ≥200 px at 320/375/430 px and unclipped; the filter set derived from the categories the repository returns; a scrolling chip row that shows it scrolls |
| BAR-177 | Multi-line dockets | claude | A real restock is six to ten SKUs, and `/issue` issues exactly one — so the warehouse hand runs the full Issue → Review → Docket chain once per SKU and the bar lead accepts that many separate dockets. `/receipt` already has the line builder. Largest time cost on the night. **This is a UI-only task; verified 4 Sep before scoping it:** `boa_bar_create_docket` and `boa_bar_accept_docket` both iterate `p_payload->'lines'` as an array and reject an empty one; `CreateDocketCommand.lines` is `DocketLineCommand[]`; and `services/issue.ts` already validates `z.array(lineSchema).min(1)` and rejects a duplicate SKU because `boa_bar_docket_line` is unique on (docket_id, sku_id). Nothing below the screen constrains a docket to one line — **no migration, no ADR**. **Acceptance:** a three-SKU docket created, reviewed, opened and accepted end to end; review and docket render the line list; accept bounds each line at its own issued quantity; the difference panel still attributes a shortfall per line |
| BAR-176 | One searchable product picker | claude | Three screens chose a SKU with a CHANGE button that advanced one product per tap, with the catalogue never shown, and the bar's top-up form used a native `<select>` instead — two idioms for one job, neither searchable. **Acceptance:** one shared sheet used by issue, waste, receipt and top-up; search, category grouping, recents; any SKU reachable in two taps regardless of catalogue order; Escape and backdrop leave the product unchanged and return focus to the trigger |
| BAR-178 | Weight the confirm dialog, trap its focus, and make disabled buttons look disabled | claude | Both dialog choices rendered as the same ghost button, the `tone="danger"` prop had never been passed by any caller so the danger treatment had never rendered, and there was no focus management. Separately, a disabled primary CTA rendered as a fully saturated button — `RECORD 1 AS WASTE` with no reason chosen looked pressable. **Acceptance:** filled toned confirm against a ghost cancel; focus opens on cancel, is trapped, and returns to the opener; one disabled treatment across `.flow-cta` and `.ritual-button`; the three existing call sites still work without being edited |
| BAR-179 | The gates measure this tree, and the undo window is tested | claude | Three defects in the gates themselves, all found by running them. Vitest collected `.claude/worktrees/` and reported 755 passing tests for a suite of 151; ESLint linted the same directory, so a clean tree failed on another checkout's half-written file; and `visual-check.mjs` probed a hardcoded `localhost:5173` it did not control, which for a window reported a clean tree as `0 reading the data layer / 18 hardcoded`. Separately `cancelQueuedCommand` — BAR-168's undo, whose failure mode is deleting a write the server already has — had no test, because the suite had no IndexedDB. **Acceptance:** the fidelity gate starts and stops its own server and prints what it served; both other gates ignore worktrees; ten tests against a real Dexie store via `fake-indexeddb`, mutation-checked by removing the guard and confirming exactly the three refusal tests fail |
| BAR-175 | An alert carries its SKU | claude | BAR-173 could only seed the destination: `Alert` in `src/data/repository.ts` has `locationId` and no `skuId`, verified against both producers. The issue screen appears to seed the right product only because the fixture's `defaultProductId` coincides with the demo alert's SKU, which would not hold for any other SKU. **Acceptance:** `skuId` on `Alert`, populated by the fixture and the live repository, carried by the home CTA, and proven with an alert about a SKU that is not the default |
| BAR-168 | Confirm every write, and undo one that has not been sent | claude | Waste and receipt navigated away on success and said nothing. The idempotency key is minted per screen mount, so it stops a double tap but not somebody re-entering the flow because they are unsure — and silence is what makes them. **Acceptance:** every write reports what was written and whether it is posted or queued; a queued write can be taken back inside the outbox window, which deletes the pending row and leaves nothing to compensate for; a claimed or posted write refuses the undo and says so rather than failing; the receipt undo restores the draft and its action id; waste returns to the bar it was recorded at, not the bars list |
| BAR-167 | Queue and connection state on every route | claude | BAR-039 built the sync strip inside the home header, so the twenty-one other screens — including all four write flows, which hide the header and the bottom navigation — could not say whether a movement had left the phone. **Acceptance:** one strip rendered by the shell on every route; silent when online with an empty queue; `n QUEUED · SENDING` while draining; gold `OFFLINE · n QUEUED · SAVED ON THIS DEVICE` with no connection, shown even when the queue is empty; red and tappable to More when a write has failed or the drain is auth-stopped, at ≥44 px; the home header no longer duplicates the count |
| BAR-073 | Real connectivity detection | codex | Derived from `navigator.onLine` and sync outcomes; single source of truth for online state and pending count |
| BAR-074 | Retry, backoff and auth stop | claude | Per the table in OFFLINE-SYNC; a mid-shift 401 holds the queue intact |
| BAR-075 | Real "as of" stamps | codex | Every stamp derives from the data's timestamp; a fixed-clock test asserts it |
| BAR-076 | Service worker for a festival network | codex | Shell precached, navigation fallback, stale-while-revalidate for reference data, versioned outbox migration |
| BAR-077 | Remove demo switches from the UI | codex | Role and connection toggles are not user-facing product controls |
| BAR-078 | Tap targets and focus | codex | 44 px minimum hit areas; visible focus retained |
| BAR-166 | Close or abandon an open count | claude | Opening a count blinds that device to the location (BAR-161) and there is no way to close one without submitting it. A count opened on the wrong bar — which will happen on 10 October — leaves that device unable to see the bar's stock for the rest of the night. Needs a command RPC that closes a `draft` session, refuses to close a submitted one, and records who abandoned it and why; plus the CTA behind the leave guard BAR-165 added. **Acceptance:** a draft session can be closed by the person holding it, the blind lifts immediately, a submitted session cannot be closed, and the abandonment is on the activity feed |
| BAR-165 | V1 UX/UI readiness sweep | claude | Every route walked at 390×844 and every class a screen names checked against the stylesheet. **Acceptance:** (1) zero used-but-undefined CSS classes, enforced by `check:css` in `pnpm lint` and proved by planting a bad name; (2) zero controls that neither navigate nor state why they cannot — no toast-only row, no silent dead tap, no route that dead-ends a role; (3) zero empty collections rendering as a bordered hairline; (4) every interactive element ≥44 px and a global `:focus-visible` ring; (5) the five routes off the design (`receipt`, `dockets`, `team`, `print`, `settings`) in `test:visual`, three consecutive runs identical, 0 hardcoded, 0 errored; (6) the approved design deviations recorded as an ADR in `docs/DECISIONS.md`. Does **not** build `sku`, `mv`, `control`, `cowork` or `rep` — it makes their absence honest |
| BAR-133 | Waste and accept post to the right location | claude | Waste posts against the user's own bar, not a hardcoded Bar 3; accepting a docket credits the docket's destination, not Bar 3 |
| BAR-134 | Idempotent acceptance | claude | A repeat accept of one docket does not post a second movement or drive `in_transit` negative |
| BAR-135 | Dead-letter for invalid outbox entries | claude | A permanently-invalid entry stops retrying, is inspectable, and its earlier false success is corrected in the UI |
| BAR-136 | QR scanner | codex | A camera scanner exists for docket acceptance — the capability `vercel.json` already grants camera permission for. Without it two-party custody has no input device |
| BAR-137 | Session longevity for shared devices | claude | Sign-in survives a shift on a shared phone with no data. Email magic-link with a one-hour JWT is not viable at a venue where the network fails |
| BAR-138 | Security headers and build identity | codex | CSP and HSTS set; a build/version identifier is exposed; the service worker's `SKIP_WAITING` is actually sent so updates can apply |
| BAR-141 | Attribute movements to their real actor | claude | A queued movement records the user who created it, not whoever is signed in when the queue flushes. A shift handover must not re-attribute the previous crew member's work |
| BAR-142 | Outbox visibility and device loss | claude | A manager can see unsynced work across devices; a documented procedure covers a lost, flat, or wiped phone |
| BAR-146 | Surface `in_transit` stock | codex | Stock parked in `in_transit` by an unaccepted docket appears on a screen. Today it vanishes from every report while the ledger says it exists — spec §11's "stock never delivered" signature |
| BAR-147 | Prevent self-acceptance | claude | The accepting user must differ from the issuing user. Today the issuing device can accept its own docket two taps later and the app prints a receiver name who was never present, reducing §5 to self-certification |

## M5 — Counts and variance

**Goal.** A count that is worth something, and a variance number that can be
defended. Specification §6, §8.

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-079 | `count` screen, sequential and blind | codex | Inputs start at zero; sequential per-SKU progress; presets; no expected figure visible or implied |
| BAR-080 | Partial-container capture | codex | Three modes per the design: full-only, `ML BY WEIGHT` step 50, `LITRES REMAINING` step 1 |
| BAR-081 | Tare weighing | codex | `(gross − tare)` conversion using the SKU's `tare_weight_g`; impossible weights rejected, not clamped to zero |
| BAR-082 | Count persistence | claude | Count sessions and lines written server-side; a reload mid-count loses nothing |
| BAR-083 | Blind enforcement in the database | claude | With an open count session, the snapshot omits that location for that user; raw ledger cannot reconstruct it; test proves it (ADR-005) |
| BAR-084 | Seal the theoretical position at submit | claude | `sealed_position` frozen server-side; variance reproducible later |
| BAR-085 | `countDone` screen | codex | Sealed, witnessed confirmation screen with `counted_by` and `witnessed_by` |
| BAR-086 | `variance` screen | codex | Per-SKU counted vs theoretical from real data; the design's composition, not invented category figures |
| BAR-087 | Signed variance banding | claude | Positive variance is graded and surfaced, never green; bands read from the database (ADR-008) |
| BAR-088 | Throughput ranking | claude | Variance ranked by percentage of throughput, not absolute |
| BAR-089 | `activity` screen, five filters | codex | All five groups present so Count and Adjustment rows are reachable; AUDIT flag rendered |
| BAR-090 | `mv` screen — movement detail | codex | Tappable from activity; shows reverses, audit flag, actor, device, timestamps |
| BAR-091 | Adjustment log view | codex | Filterable per location; "the report you read first the next morning" |
| BAR-092 | Paper fallback print views | codex | Count sheets and numbered docket books printable from real SKU and location data; a keying path marks `source = 'paper'` with the serial |
| BAR-145 | In-event correction path | claude | A recount, void, or adjustment with supervisor override exists. Today a crew member who types 110 instead of 11 and submits has no way to fix it, so the choice is a known-false record or abandoning the app |
| BAR-148 | Empties capture | codex | Returned empties counted and recorded on the night. This is a physical observation that exists only between 23:00 and 03:00 on 10 October — it cannot be reconstructed on 11 October, and both the excise return and the STOK settlement have a line for it |
| BAR-150 | Mid-event count scheduling | codex | The count the spec says everyone skips gets a scheduled window, a named counter, a witness and a reminder. Without it, a step-change leak between two counts is undetectable |

## M6 — POS ingest and show day — the cuttable milestone

**Goal.** Sales become volume, and the app stops a bar running dry.
Specification §7, §9, and §15 Phases 3–4.

> **THIS IS THE CUT LINE.** Specification §15 says cut the control board, then
> run-out alerts, then POS import — in that order. Everything in this milestone is
> legitimately sacrificial. **Do not start any of it while an M1–M5 task is open.**

**Target: 8 October.**

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-093 | Serve map management and review | codex | Every POS SKU mapped to an SKU and ml; a pre-show-day review surface |
| BAR-094 | POS import with hard fail | claude | CSV/API import; unmapped `pos_sku_code` rejects the whole batch with a report; source file retained |
| BAR-095 | Idempotent re-import | claude | `pos_txn_id` unique per venue; re-importing the same file changes nothing |
| BAR-096 | POS rows carry bar and money | claude | `location_id` and `amount_minor` required; sales attributable per bar |
| BAR-097 | Sale movements from POS | claude | Posting a batch generates `sale` movements through the serve map |
| BAR-098 | `boa_bar_v_depletion` | claude | ml/hour per SKU per bar with projected run-out |
| BAR-099 | Run-out alerts | codex | Alert when projected run-out is inside 90 minutes; computed, not literal |
| BAR-100 | `control` screen — show-day board | codex | Four bars live, run-out projections, open dockets, count ages, alerts |
| BAR-101 | Top-up window scheduling | codex | Uses the running order so top-ups land during sets, not changeovers |
| BAR-149 | Alerts that actually reach someone | codex | Push or notification, plus a bar-to-warehouse top-up request. Every alert today is passive — it exists only while someone is holding the phone on the home screen, so the warehouse never learns Bar 3 is 26 minutes from dry |
| BAR-102 | `home` screen from real data | codex | Total stock, alerts and bar status all derived; alert CTAs navigate per the design |
| BAR-103 | `cowork` screen | codex | Built per the design branch |
| BAR-104 | `more` screen | codex | All six destinations plus sync-state panel |

## M7 — Reports and settlement

**Goal.** The three audiences in [PRODUCT.md](PRODUCT.md) each get their answer.
Specification §1, §11, §12.

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-105 | `boa_bar_v_excise` | claude | Containers in/out/sold/returned/empties by excise category |
| BAR-106 | `boa_bar_v_settlement` | claude | Supplied-product depletion split bar vs hospitality; `is_supplied` actually read |
| BAR-107 | `reports` screen | codex | The design's six reports, period toggle and settlement cells |
| BAR-108 | `rep` screen | codex | Individual report detail with the design's columns, rows and notes |
| BAR-109 | Excise return export | codex | Matches the licence template once obtained (see open decisions) |
| BAR-110 | STOK settlement export | codex | Handed over without editing: received, depleted at bar, depleted to hospitality, wasted, returned unsold, empties |
| BAR-111 | Sales per hour and ₹ per attendee | codex | Both computed from POS rows |
| BAR-112 | Leak taxonomy view | claude | The seven signatures from §11 surfaced as a review lens |
| BAR-113 | Ledger export | codex | Full append-only export with actor, device and timestamp per row; adjustments carry their reason |

## M8 — Human and operational readiness

**Goal.** The half of show-day success that is not code. The audit filed 156
findings and not one of these — yet three are more likely to sink 10 October than
anything it rated a blocker.

**Runs parallel to M1–M6.** Two items have external lead times measured in weeks,
so they carry hard dates.

| Task | Title | Owner | Acceptance |
| --- | --- | --- | --- |
| BAR-158 | **Obtain the excise return template — by 31 August** | human | The licence holder's required return is in hand. Its category vocabulary and its treatment of empties determine what must be **physically observed** on the night. A wrong category set is backfillable per SKU; a missing physical observation is not |
| BAR-159 | **Confirm who runs the POS and the export format** | human | STOK, the cashless vendor, or BookMyShow — and whether §7 is an API, a CSV, or an emailed export. Determines whether BAR-094 is buildable at all |
| BAR-160 | **Decide empties, and put them on the paper count sheet** | human | Whether the licence requires empties returned, and who stores 3,000 bottles overnight. This must be settled before the night because the count sheet is printed before load-in |
| BAR-114 | Component and interaction tests | codex | jsdom environment configured; the critical journeys covered |
| BAR-115 | Real-device offline and QR checks | human | Tested on cheap Android at the venue network profile |
| BAR-116 | Staff onboarding and roster | human | Real users invited, roles and locations assigned, a printed one-page crib per role |
| BAR-117 | Shift handover and manager-absent path | human | Documented: who fixes a bad count at 22:00, and how, when the manager has gone home |
| BAR-143 | Onboarding that works at load-in | claude | ~20 temporary staff, many without a work email, on congested cellular. Email magic-link alone is unworkable — and a staff member who installed the PWA finds the installed app still signed out while the browser tab is in |
| BAR-144 | In-app membership and role management | codex | A manager can add a member or change a role on site. Today, when the manager leaves at 23:00, variance, reports and count sign-off leave with them, and a bar lead arriving at 20:00 cannot be enrolled |
| BAR-118 | Backup and restore verified | human | Point-in-time recovery enabled and a restore actually tested |
| BAR-119 | Observability | codex | Error reporting wired; `VITE_SENTRY_DSN` either used or removed |
| BAR-120 | Staging deploy and acceptance | human | Full journey accepted on staging before the domain is pointed |
| BAR-121 | Production cutover | human | `bar.bangaloreopenair.com` live; rollback path documented |

---

## Task ID conventions

Commits carry the task ID:

```
feat(BAR-051): add case/bottle unit switch to issue screen
fix(BAR-079): initialise blind count inputs to zero
```

Conversations reference it: "Claude, review BAR-055", not "check what Codex did
yesterday".

## Definition of done

A task is `[x]` only when all of these hold:

1. Its acceptance criteria are met.
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass.
3. Database tasks: `pnpm test:db` passes against a real PostgreSQL.
4. UI tasks: the screen renders from the **fixture repository** against **two
   distinct fixture states**, and is compared against `references/ui/<screen>.png`.
5. No new hardcoded fixture data, no new palette colour, no architecture change
   without an ADR.
6. [CURRENT-STATE.md](CURRENT-STATE.md) updated with **a commit SHA or pasted
   command output** — not an assertion.
7. **The implementing agent does not author its own QA verdict.**

Points 4, 6 and 7 are the three gates whose absence caused this project's
drift. Point 4 is mechanical: a screen with hardcoded literals produces identical
output for both fixture states and therefore fails. Point 6 makes `[x]`
falsifiable. Point 7 removes the conflict of interest that let one agent write
the architecture, the implementation, the gap audit and the QA verdict for the
same work.

CI should reject a status change that carries no evidence, and reject two
documents asserting different outcomes for one task ID.

---

See also: [CURRENT-STATE.md](CURRENT-STATE.md) · [PRODUCT.md](PRODUCT.md) ·
[DECISIONS.md](DECISIONS.md)

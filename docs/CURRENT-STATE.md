# BOA Bar Control — Current State

**Last updated: 1 September 2026 (M8 in progress)** · Event: 10 October 2026 — **39 days out**

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

One definition, used by the milestone table below and nowhere else redefined.

- `[x]` Done, and the evidence column says how that was checked
- `[~]` Partially done — the note says which part is missing
- `[R]` Exists but must be rewritten to meet the criteria — do not build on it
- `[!]` The defect the task exists to fix is **actively present in the code**
- `[ ]` Not started
- `[?]` Cannot be verified without a seeded database or a real device

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
| `issue` | ISSUE STOCK | `[x]` | rebuilt — repository-backed source, full SKU catalogue and destinations; case/container switch, equivalence, bounded presets and warehouse-after; passes a validated draft to review |
| `review` | REVIEW ISSUE | `[x]` | built — derived cases/litres/warehouse-after, and the design's in-transit advisory |
| `docket` | DOCKET CREATED | `[x]` | rebuilt as its own screen — identity treatment, real QR encoding a route that exists, two-button footer |
| `bars` | BARS | `[x]` | `b49768c` — rebuilt. Leads, count times and flags restored; decorative progress bars removed; cards tappable |
| `bar` | BAR 3 | `[x]` | `b49768c`+ — built to the design: live header, category grid, gold incoming sheet, TOP-UP/WASTE/COUNT, ledger-derived inventory. Reads the repository |
| `accept` | RECEIVE STOCK | `[x]` | built — FROM/TO/ISSUED BY grid, items panel, bounded stepper |
| `diff` | REPORT DIFFERENCE | `[x]` | built as the accept variant it is (not a route). Reason mandatory, stepper bounded at issued qty; both verified by driving the UI |
| `received` | RECEIVED | `[x]` | built — the custody document, with both names and both timestamps |
| `waste` | RECORD WASTE | `[x]` | Rebuilt with the design vocabulary and full catalogue. Live screen → service → outbox → RPC → ledger path proven 29 Aug; see session log |
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

Rebuilt or built to the design: `home`, `warehouse`, `issue`, `bars`, `bar`,
`activity`, `more`, the shell's bottom navigation, and the full custody chain
(`review` → `docket` → `accept` → `diff` → `received`).

Still missing (6): `sku`, `mv`, `control`, `cowork`, `rep`, and `reports` needs
rebuilding to the design rather than its current honest-empty-state placeholder.

---

## Milestone status

**Reconciled 28 August 2026 against the code, not against the previous version of
this table.** The prior table was written during the 27 August audit and had
drifted in both directions: it still listed BAR-042 as "None", the blind count as
inverted, and the custody screens as absent, all of which had since been built —
while marking several things done that a grep shows are not. Every row below
names the evidence that decided it. Where a row could not be decided without a
seeded database or a physical device it says so rather than guessing.

States are defined once in the **Status key** above.

### M0 — Tripwires, governance, and the fabricated numbers

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-139 | Demo can never masquerade as live | `[x]` | `743a4d4` — `AppShell` derives `isDemo` from `repository.kind`, not from `demo-store.backendMode`. A fixture-served screen can no longer be labelled live |
| BAR-151 | Zero the blind count inputs | `[x]` | `CountScreen.tsx:37-38` — `useState(0)`, `useState(0)`. No expected figure reaches the component |
| BAR-152 | Delete every fabricated number | `[x]` | grep for `−2.1%`, `₹18.4K`, `94%` in `src/` returns comments only |
| BAR-034 | All required font weights | `[x]` | `bfdc1f4` — Oswald 400/500/600/700, Archivo 400/600 in `main.tsx` under `font-synthesis: none` |
| BAR-035 | Correct colour tokens | `[x]` | `bfdc1f4` — `--red` → `#FF4A3D`; greys mapped to the sage-alpha scale |
| BAR-001 | Initialise git | `[x]` | `origin` → `github.com/vipinvmenon/boa-bar-control` (private). 32 commits on `main` |
| BAR-002 | Recover the design source | `[x]` | `references/design-source/` — design-script.jsx, design-markup.html, spec.txt, screens.json |
| BAR-003 | Canonical `/docs` set | `[x]` | All nine files present. CURRENT-STATE is maintained per session, so it is never "finished" |
| BAR-004 | Agent instruction files | `[x]` | `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/{00-truth,10-non-negotiables,20-ui,30-data}.mdc` |
| BAR-005 | Archive contradicted documents | `[x]` | `docs/archive/` holds five superseded documents; `artifact-reconciliation.md` moved in |
| BAR-006 | CI pipeline | `[?]` | `.github/workflows/ci.yml` exists with the database job advisory (`344c72d`). **No CI run has ever been observed.** A pipeline nobody has watched pass is not a gate |
| BAR-007 | Reference captures | `[x]` | `f4cbae8` — 22 screens at 390×844@2x, each verified against the design's own stage caption |
| BAR-008 | Two-fixture-state harness | `[x]` | **Fixed and made deterministic 28 Aug.** The root cause of the intermittent false positive: `.status-dot` pulses at 2.4s forever and `bar` and `docket` are the only screens rendering it, so their captures could never produce three identical consecutive frames — and `shoot()` then **returned the moving frame anyway with no signal it had given up**, so two moving frames sometimes compared equal. Now the gate captures with `reducedMotion: reduce` (the stylesheet already stops the animation under it) and a capture that does not settle is an ERROR, not a verdict. Three consecutive runs now agree exactly |
| BAR-153 | `CHECKSUMS.txt` over the design source | `[ ]` | No `CHECKSUMS.txt` anywhere in the tree. The UI contract can be edited without trace |
| BAR-154 | Lint rule banning literals in screen files | `[x]` | Added 28 Aug. `no-restricted-syntax` over `src/screens/**` and `src/components/**` bans location ids and names, docket numbers and catalogue SKU names. **Verified by probe**: all six planted literals errored and two legitimate strings passed. Deliberately narrow — a general literal ban gets disabled, and a disabled rule catches nothing |
| BAR-009 | `sw.ts` in typecheck and lint | `[ ]` | Still excluded: `eslint.config.js:8` ignores it, `tsconfig.app.json:23` excludes it |
| BAR-010 | Formatter, pre-commit, CODEOWNERS, PR template | `[ ]` | None of the four exist |

### M1 — Ledger core, executed

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-155 | Command RPCs as the only write path | `[~]` | `e087d10` — `boa_bar_create_docket` and `boa_bar_accept_docket` exist and enforce their rules. **No application code calls either.** The count-submit and POS-post RPCs do not exist |
| BAR-156 | Interim opening-stock bootstrap | `[~]` | `202608280002` applied 28 Aug; `boa_bar_claim_venue` and `boa_bar_open_stock` exist. **Opening stock posted 29 Aug**: movement `8a0c5b2c`, 10 lines, 638 containers, and the script confirms the ledger sum and the projection agree on every line. The claim window is closed |
| BAR-011 | Verify no table-level write grants | `[x]` | **Verified against the live database 28 Aug**, not asserted: `privileges.test.sql` 52/52, plus `ledger.test.sql` 11/11 — 63 assertions, 0 failed. It failed the first time it was ever actually run, which is how the two EXECUTE holes were found. It now enumerates every function for both roles |
| BAR-161 | Location-scope the snapshot RPC | `[x]` | **Applied and PROVEN against the live database, 28 August: `blind_count.test.sql` 6/6.** A bar lead can read their bar with no open count, and once a count is open the snapshot returns no row for it and the raw movement lines are unreadable. Required `202608280008` to fix a live defect `_0007` introduced — see event-stopper 21 |
| BAR-163 | Count witness column | `[~]` | V1 decision: witnessing remains paper-only. The printed count sheet has a `WITNESSED BY` signature block; the app keeps `assigned_to` and manager review without adding a second-user submit gate |
| BAR-012 | `GRANT USAGE ON SCHEMA private` | `[x]` | `3c6acd9`, verified 28 Aug — `authenticated` has USAGE on `private`, `anon` has none, and `private.boa_bar_balance` is unreachable |
| BAR-013 | Harden ledger immutability | `[~]` | `e71859e` and `41ac189` — hosted RLS-disabled/no-policy and mutable-search-path advisories are cleared: four protected tables have deny-by-default RLS policies, and seven private trigger/guard functions have pinned search paths. Row triggers and revoked default `TRUNCATE` privileges remain. Still no `ENABLE ALWAYS` and no `FORCE ROW LEVEL SECURITY`, so a table owner bypasses both |
| BAR-014 | `v_position` sums the ledger | `[~]` | `202608310006_position_view.sql` adds security-invoker `public.boa_bar_v_position`, aggregating immutable movement lines independently of the projection. Migration written and `check:sql` passes; hosted application and behavior proof are parked |
| BAR-015 | Reconciliation view and test | `[~]` | `202608310007_reconciliation_view.sql` adds an ungranted audit view returning only ledger/projection mismatches. Migration written and `check:sql` passes; hosted behavior proof is parked |
| BAR-016 | Protect the balance projection | `[~]` | `private.boa_bar_balance` now has exactly one writer, `private.boa_bar_post_movement`, instead of the insert being duplicated per entry point. Still no trigger and no scheduled reconciliation — `pnpm bootstrap` compares the projection against a ledger sum once, at bootstrap, which is not the same as protecting it |
| BAR-017 | Fix `comp` to a two-leg move | `[x]` | `202608310003_comp_two_leg.sql` applied live; `movement_guards.test.sql` proves balanced hospitality comps and rejects unbalanced comps. Full suite: 134 assertions, 0 failed |
| BAR-018 | Restrict `sale` to the POS path | `[x]` | `202608310001_restrict_sale.sql` applied live; `movement_guards.test.sql` proves hand-keyed sales are rejected. Full suite: 134 assertions, 0 failed |
| BAR-019 | Receipt movement path | `[x]` | `boa_bar_record_receipt` is the receipt path, with the delivery note the spec requires and a duplicate guard. Previously a toast message |
| BAR-020 | Return and transfer paths | `[~]` | Transfer legs exist inside the docket RPCs. No standalone return path |
| BAR-021 | Adjustment path with role and reason | `[~]` | `202608310005_adjustment_guard.sql` adds manager/admin authorship, non-blank reasons, same-venue reversal checks, and a unique reversal index. Migration written and `check:sql` passes; live application and behavior proof are parked |
| BAR-022 | Venue-scope every foreign key | `[x]` | `202608310002_scope_movement_lines.sql` applied live; `movement_guards.test.sql` proves cross-venue SKU references are rejected. Full suite: 134 assertions, 0 failed |
| BAR-023 | Server-validate the timestamps | `[~]` | `business_date` is now derived server-side and a timestamp more than an hour in the future is refused. Still unvalidated: nothing checks `occurred_at` against the venue event window, and POS timestamps are unvalidated because POS is cut |
| BAR-024 | Location-scoped authorisation | `[~]` | Waste and count command RPCs now enforce the boundary: scoped roles may write only their membership location; manager/admin may explicitly select a venue location. Proven by 11 live pgTAP behaviours. Read policies and the remaining command RPCs remain open |
| BAR-025 | Tolerance bands in the database | `[~]` | `202608310009_tolerance_bands.sql` adds four versioned categories matching the documented 1/3, 8/15, 3/8, and 2/5 percent bands. Migration written and `check:sql` passes; hosted application and consumer wiring are parked |
| BAR-026 | `excise_category` NOT NULL | `[~]` | `202608310010_excise_categories.sql` adds dynamic reference data seeded with beer, IMFL, mixer, water, and other; normalizes provisional bootstrap values; and makes every SKU category non-null with a foreign key. Final categories can be extended when the Chandan/Salman stock sheet arrives; hosted application remains pending |
| BAR-027 | Missing spec §13 columns | `[~]` | BAR-124 added display names. `abv`, `supplier_vendor_id`, `is_licenced`, `is_blind`, `witnessed_by`, `counted_at`, empties and delivery-note remain absent |
| BAR-028 | Non-negative position guard | `[~]` | `202608310004_non_negative_position.sql` adds a trigger on the sole balance-projection writer, rejecting any resulting negative containers or millilitres. Migration written and `check:sql` passes; live application and behavioral proof are parked with the test work |
| BAR-029 | Index `movement_line.movement_id` | `[~]` | `202608310008_movement_line_index.sql` adds the missing movement-id join index used by ledger detail/audit reads. Migration written and `check:sql` passes; hosted application is parked |
| BAR-030 | Behavioural pgTAP suite | `[x]` | `dd0b40a` — `ledger.test.sql` now exercises append-only movement headers/lines and derives position from ledger sums; the hosted rollback transaction completed with final `ok 11`. Existing hosted behavior suites cover movement guards, location scope, privileges, recount, and count sealing. The password-dependent `corepack pnpm test:db` wrapper was not run |
| BAR-031 | Execute migrations | `[x]` | **All migrations through `202608310003_comp_two_leg` applied and present in remote migration history, 31 Aug.** PostgreSQL 17.6. `test:db` reports 128 assertions, 0 failed; `db-state.mjs` reports 1 venue, 9 locations, 11 SKUs, 2 memberships, 4 movements, 2 count sessions, and 3 auth users |
| BAR-032 | Deterministic seed that renders the design | `[~]` | **Reference data verified present in the hosted project 28 Aug: 1 venue, 9 locations, 11 SKUs.** Opening ledger not yet posted — blocked on the first `auth.users` row. Still no serve mappings (BAR-159) and no tolerance bands in the database (BAR-025) |
| BAR-033 | Generate database types | `[x]` | `f5d4694` — `src/types/database.ts` aligns with the hosted schema, the Supabase client is typed, and the top-up RPC casts are removed. Hosted information-schema evidence was used; Supabase CLI regeneration was unavailable, so schema drift still needs checking |
| BAR-122 | Revoke `TRUNCATE` everywhere | `[x]` | `3c6acd9` — verified empirically over REST: `anon` receives `HTTP 401 permission denied` |
| BAR-123 | Business date spans the festival night | `[x]` | **Applied and verified against PostgreSQL 17.6 on 28 August: 9/9 behavioural assertions pass**, including that 01:30 on 11 October carries `business_date = 2026-10-10`. `business_day_start_hour` on the venue (06:00 default); `private.boa_bar_business_date` is the only place the rule lives; the client value is ignored |
| BAR-124 | Person-name resolution | `[~]` | `202608280001_person_names.sql` written — table, generated first name, append-only history, `boa_bar_set_person_name`. **Unapplied, and `boa_bar_person` is empty, so every live name would render `UNNAMED`** |
| BAR-125 | Seal submitted counts | `[x]` | `boa_bar_submit_count` sets `submitted_at` and writes the append-only private count seal. The live Bar 2 submission created one submitted session with 11 lines; the raw sealed rows were not directly inspected |
| BAR-126 | Storage bucket for POS files | `[ ]` | — |
| BAR-127 | Read `venue.timezone` and `event_date` | `[~]` | `timezone` is now read (`auth.tsx:81`) and threaded into the live repository's clock, so no stamp uses the device timezone. `event_date` is still never read |
| BAR-128 | Deterministic membership selection | `[x]` | `auth.tsx` orders active memberships by venue, role, and location before selecting `memberships[0]`, so refreshes cannot change the active venue/role arbitrarily |

### M2 — Architecture spine: repository, services, navigation

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-157 | Per-location position model | `[~]` | The live repository is location-keyed throughout. The legacy `demo-store` still carries scalar `warehouse` / `bar3` fields, and eight screens still read it |
| BAR-162 | Par levels per SKU per location | `[ ]` | No column. Removes the run-out alert and the `LOW STOCK` bar status from live mode |
| BAR-036 | Radius vocabulary | `[x]` | `bfdc1f4` — 999/12/14/15/18 px restored; nothing below 11 px remains |
| BAR-037 | Glass and ambient field | `[x]` | `bfdc1f4` + `a72c48d` — three gradient layers; `backdrop-filter` removed from `.metric` where the design has none |
| BAR-038 | Component primitives | `[R]` | `src/components/ui.tsx` is still 60 lines for the whole system |
| BAR-039 | Shell | `[~]` | `798feb2` — bottom nav corrected to colour-only active state with the design's own SVG paths. Header composition still diverges |
| BAR-040 | Navigation state machine | `[~]` | The hardcoded `<Link to="/">` backs are gone, and the three hardcoded bar-id destinations were fixed under BAR-133. There is still no stack: every back is a fixed destination rather than a pop |
| BAR-041 | Toast system | `[x]` | `app-store.flash` expires every toast at 2600 ms, the design's duration, including one raised while another is showing |
| BAR-042 | Repository interface | `[~]` | Interface, fixture and live implementations all exist (`b49768c`, `743a4d4`). **Proven live 29 Aug**: signed in against the hosted database the home screen renders 638 containers with the bars at zero, which is the ledger's position and not a figure the fixtures can produce. Reads only — no write has been posted through the app |
| BAR-043 | Fixture repository from the design's data | `[x]` | `design-data.ts` with line references, and **every read model now has a second fixture state**. `barDetail` was the one that did not, so the bar workspace rendered identically under both sets and could not be proved to read its data — invisible until BAR-008's flakiness was fixed. Gate: 15 reading, **0 hardcoded, 0 errored, identical across three consecutive runs** |
| BAR-044 | Application service layer | `[~]` | `src/services/` exists with `issue.ts` and `accept.ts` — Zod validation, the custody domain rules, then the repository. Both custody writes are now wired and verified in a browser. Commands are on the `Repository` interface, so no screen imports Supabase or Dexie and no service calls an RPC. 13 service tests. Count, waste and the remaining write use cases still have no service-backed screen path |
| BAR-045 | Remove fixture data from screen files | `[~]` | `src/features/screens.tsx` is down from 302 lines to 67 and holds **no** SKU data — only the `reports` honest empty state. All 16 routes read the repository; the gate reports 0 hardcoded and BAR-154's lint rule enforces it |
| BAR-046 | Wire the domain layer | `[~]` | `mlFromGrossWeight` now has a caller (`services/count.ts`), as do `varianceBand`, `toleranceFor`, the whole of `domain/custody.ts`, `domain/outbox-policy.ts` and `domain/units.ts`. Still zero callers outside tests: `derivePositions`, `applyIdempotently`, `reverseMovement`, `theoreticalClosing`, `weightedAverageCost` |
| BAR-164 | Delete the legacy parallel live path | `[~]` | `src/lib/live-repository.ts` is **deleted** and `demo-store` is replaced by `app-store`, 365 lines down to ~130 holding only toasts, the derived role and outbox depth. There is now ONE live data path. `src/features/screens.tsx` still holds the `reports` empty state until BAR-107 |
| BAR-047 | Error boundary and not-found route | `[x]` | Added 28 Aug. Router-level `defaultErrorComponent` and `defaultNotFoundComponent` so a new route cannot arrive without a boundary, plus `AppErrorBoundary` outside the router for throws in the providers. **Verified in a browser**: a planted throw in a repository read rendered the failure card in-shell with the nav intact, and cleared when the read succeeded. Also `throwOnError: true` on `useRepositoryQuery` — screens render `data?.field ?? '—'`, so a failed live read previously produced a screen of em-dashes and zeroes, visually identical to a venue with no stock |
| BAR-048 | Zod at every boundary | `[~]` | Zod now validates both write use cases at the service boundary — the first real use outside `domain/inventory.ts`. RPC **responses**, QR payloads, POS rows and local-store reads are still unvalidated; `rows.ts` casts by hand |
| BAR-129 | Bounded quantity inputs | `[~]` | Issue cannot exceed the warehouse position, accept cannot exceed the docket, waste floors at 1 and the database refuses more than the location holds. A non-negative position guard on the ledger itself is still BAR-028 |
| BAR-130 | Full SKU catalogue on every screen | `[x]` | Issue, count and waste all list the full active catalogue through the repository. The `slice(0, 5)` and `slice(0, 3)` screens are deleted |
| BAR-131 | Remove the fake OS status bar | `[x]` | `27b9925` — removed the hardcoded `19:44` / `4G` chrome from `AppShell` and its CSS; real OS/browser chrome is no longer impersonated |
| BAR-132 | Seven roles, not two | `[~]` | `auth.tsx` carries all seven. `demo-store.tsx:287` still collapses them to a `managerRoles` boolean |

### M3 — Stock enters, and moves with custody

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-049 | `warehouse` from the data layer | `[x]` | `c4728ad` — category groups, totals and rows all derived; gate passes both fixture states |
| BAR-050 | `sku` screen — SKU ledger | `[ ]` | Screen missing. Warehouse rows have nowhere to navigate |
| BAR-051 | `issue` with case/bottle unit switch | `[x]` | Rebuilt by Codex 28 Aug; **reviewed and three defects fixed** the same day. Presets, steps, the minimum clamp and the equivalence strings were checked against design-script.jsx:216-241 and match exactly. Verified by driving the browser end to end: /issue -> /issue/review -> /dockets/D-0184, with `1.50 cases · 650 ml · 23.4 L` reproducing the design's own formula |
| BAR-052 | `review` screen | `[x]` | `c987c24` — derives cases, litres and warehouse-after from the repository |
| BAR-053 | Docket persistence | `[~]` | Both creation and acceptance now call their services through the durable outbox, and posted creation navigates by the server-minted docket number. The live create path remains unexercised because `auth.users` is still empty; behavioural database coverage is BAR-030 |
| BAR-054 | `docket` screen with QR | `[x]` | `c987c24` |
| BAR-055 | `accept` screen | `[x]` | `c987c24` — verified by driving the browser: CTA disabled without a reason |
| BAR-056 | `diff` screen | `[x]` | `c987c24` — correctly the accept screen's difference panel, not a route (BAR-007 finding) |
| BAR-057 | `received` screen | `[x]` | `c987c24` |
| BAR-058 | Short-acceptance ownership | `[~]` | The accept RPC rejects an unexplained shortfall. It does not assign the shortfall an owner or post a compensating adjustment |
| BAR-059 | Docket SLA alert | `[~]` | Derived in the live repository's `alerts()` from the oldest awaiting docket against a 30-minute SLA. The legacy home path is still static |
| BAR-060 | `receipt` screen | `[x]` | `202608280010` plus `/receipt`. Multi-line delivery capture against a supplier and delivery note, both **required** — spec §4 posts a receipt against that document, and it is what the excise return and the STOK settlement reconcile to. Refuses a repeat of the same note from the same supplier, which no idempotency key can catch. **Not a design screen**: the design has no receipt (`received` is docket acceptance). Verified in a browser: adding the same product twice merges to one line of 48 rather than duplicating. **Applied and proven 29 Aug** — 8 behavioural assertions, including the duplicate delivery-note guard |
| BAR-140 | Opening stock entry | `[x]` | Closed by BAR-060. `boa_bar_open_stock` still loads the warehouse at bootstrap, and `/receipt` now covers a delivery arriving during the event — which was the half that needed the database password |

### M4 — Bar operations and offline

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-061 | `bar` screen — the bar workspace | `[x]` | `10185b5` |
| BAR-062 | Bar list navigates to bar detail | `[x]` | Fixed 28 Aug — the `bar.id === 'bar-3'` gate is gone, so every card opens its bar under both fixture and live data |
| BAR-063 | `waste` screen, three taps | `[x]` | Rebuilt as `src/screens/waste/WasteScreen.tsx` from design-markup.html:612-651. The design's five reasons including `Foam / line loss`, the full catalogue instead of `slice(0, 5)`, and a real write through `boa_bar_record_waste`. **Live write proven 29 Aug:** Warehouse / Bira 91 White / 1 can / Breakage returned Home with 0 pending and total stock 638 → 637 |
| BAR-064 | Request top-up | `[x]` | Hosted completion recorded 1 Sep: top-up create/list/update, idempotency, linked issue, non-negative stock protection, and automatic fulfilment after full docket acceptance passed a 21-assertion rollback behavior test. Live hosted application flow beyond that rollback test was not exercised |
| BAR-065 | Bar-to-bar transfer | `[ ]` | — |
| BAR-066 | Reference cache | `[x]` | `src/data/live/cache.ts`. Locations, SKUs, people and memberships are written on every successful reference load, and the position snapshot with the server time it was taken at. The table was declared on day one and never written to |
| BAR-067 | Offline reads from cache | `[~]` | A failed live load now reads the cache, and an empty cache throws `NoCachedDataError` — an explicit error, **never fixture data**. A cached position is safe to show only because every screen carries the design's AS OF stamp and the cached snapshot carries the instant it was taken, so a stale screen reads "AS OF 19:43" at 21:00. **Cached rows for a location this device is counting are dropped**, so the cache cannot hand back what BAR-161 withheld. 8 tests cover the filtering and payload validation; the Dexie IO itself needs a browser (BAR-114) and is unproven |
| BAR-068 | Cold-start offline | `[~]` | `4683bf9` — auth restores user-scoped cached memberships for a still-valid JWT after an offline or failed-network cold start and refuses explicit auth failures. Real browser/device offline cold-start and refresh longevity remain unverified |
| BAR-069 | Stable idempotency keys | `[x]` | Keys are minted once per user action and now **survive a reload**: the count draft persists its `actionId`, so a resumed count finishes the same count rather than starting a competing one. The outbox dedupes on the key, and every command RPC replays rather than duplicating |
| BAR-070 | Ordered outbox replay | `[x]` | `selectDrainBatch` replays in causal order and **stops at the first blocked entry**. The previous drain skipped an entry in backoff and posted the ones behind it, so an issue that failed once could be overtaken by its own acceptance. Asserted in `outbox-policy.test.ts`, including the case that used to break |
| BAR-071 | No silent write loss | `[x]` | Closed by deleting the code. The three unawaited `void queueLiveMovement(...)` writes lived in `demo-store`'s `issue`, `accept` and `waste` actions — all unreachable by the time they went. Every write now goes through a service to the outbox, which resolves only once Dexie has committed |
| BAR-072 | Persist mutable state | `[~]` | **The count survives a reload**, which was the acceptance criterion. Counted lines, sheet position and the action id are persisted to Dexie on every line and restored on mount, keyed by location. Verified in a browser: counted, reloaded, and the sheet came back at `5 OF 18` saying `RESUMED · 2 lines already counted on this device`. Dockets and counts are no longer React-memory-only — dockets go to the durable outbox. **Still in memory: the receipt screen's line list**, so a delivery being entered is lost on reload |
| BAR-073 | Real connectivity detection | `[x]` | `app-store` derives `offline` from the browser's own `online`/`offline` events. The hand-operated demo toggle is gone, and the sync line is no longer a button |
| BAR-074 | Retry, backoff and auth stop | `[x]` | `11ad16d` — backoff remains capped at 60 s with jitter; auth failure stops the drain without consuming an attempt, retains the queued command, and exposes a direct sign-in-again recovery action; rule violations dead-letter immediately. Recovery was statically verified; an expired live JWT and replay were not exercised |
| BAR-075 | Real "as of" stamps | `[~]` | The live repository derives every stamp from the server's clock in the venue's timezone. The fabricated AppShell status-bar clock was removed under BAR-131 |
| BAR-076 | Service worker for a festival network | `[~]` | `11ad16d` and `1b9b604` — shell/static assets and only same-origin Supabase SKU/location reference reads are cached; snapshots, memberships, people, dockets, counts, ledger reads, RPCs, and writes remain network-only, and legacy broad caches are removed on activation. Browser/device service-worker activation and cache behavior remain unverified |
| BAR-077 | Remove demo switches from the UI | `[~]` | The offline toggle and the role switch are gone: role is derived from the signed-in membership and connectivity from the browser. `?fixture=b` remains, and is deliberately disabled in production builds |
| BAR-078 | Tap targets and focus | `[ ]` | Not measured since the rebuild. Needs a pass |
| BAR-133 | Waste and accept post to the right location | `[x]` | Closed. The three screen literals went on 28 Aug; bar workspaces now carry their selected location into waste, and `boa_bar_record_waste` enforces membership location scope in the database. The legacy `demo-store` path that hardcoded `bar_3` is deleted |
| BAR-134 | Idempotent acceptance | `[x]` | The accept RPC rejects a second acceptance and replays idempotently on the client key |
| BAR-135 | Dead-letter for invalid outbox entries | `[x]` | Completed 30 Aug. Permanent failures stop on the first refusal and the existing SYNC STATE card shows the failed action and retained server message. A queued acceptance stays on RECEIVE STOCK; only a posted acceptance opens RECEIVED, using the docket number that `custody()` resolves. Proven against live D-0002: its self-acceptance moved from `1 PENDING` to `1 NOT SENT` while stock and docket status remained unchanged |
| BAR-136 | QR scanner | `[~]` | No scanner. `/dockets` is the deliberate substitute — smaller, and it does not depend on a camera focusing in a dark tent. The scanner is still wanted as the fast path, and `vercel.json` already grants camera permission |
| BAR-137 | Session longevity for shared devices | `[~]` | Sign-out/account handoff slice completed 30 Aug: More exposes SIGN OUT, clears user-scoped reference cache and drafts, clears in-memory query data, retains unsent outbox commands, and uses local-scope Supabase sign-out so it works without a network round-trip. Browser verified: active VIPIN session returned to Staff sign in. Full offline cold-start, JWT lifetime and refresh behaviour remain unverified |
| BAR-138 | Security headers and build identity | `[x]` | `f5d4694` — repository CSP/HSTS headers are present, `VITE_RELEASE` is exposed with a `dev` fallback in More, and service-worker update activation is retained. Production deployment headers, release value, HTTPS/custom-domain enforcement, and provider-console settings remain unverified |
| BAR-141 | Attribute movements to their real actor | `[~]` | Queued payloads carry `actor_id`; migrations 012–013 validate both memberships and wrap all five command RPCs so their existing logic runs under the original actor. Hosted behavior is still unverified, including whether Supabase `auth.uid()` observes the transaction-local subject override |
| BAR-142 | Outbox visibility and device loss | `[ ]` | — |
| BAR-146 | Surface `in_transit` stock | `[x]` | `BarDetail.incoming` is a list, the bar screen renders all of them with working CTAs, and `/dockets` shows every awaiting docket plus the in-transit container total. Verified in a browser: two dockets listed, the second opens its own contents |
| BAR-147 | Prevent self-acceptance | `[x]` | The accept RPC rejects acceptance by the issuing user. Enforced in the database, not the client |

### M5 — Counts and variance

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-079 | `count` sequential and blind | `[x]` | `36ffc4f` — inputs start at zero, stepper resets per line, no expected figure in the read model. Verified by driving the browser |
| BAR-080 | Partial-container capture | `[x]` | `36ffc4f` — all three modes (`none` / `ml` / `litres`) verified in the browser |
| BAR-081 | Tare weighing | `[x]` | Spirit partials now take the gross scale reading, derive `partial_ml = gross − SKU tare` through the domain/service helper, and retain `gross_weight_g` as evidence. A non-zero reading below tare is rejected rather than clamped to zero. Verified at 390×844 with the fixture repository: 530 g against 480 g showed 50 ml; 300 g showed an error and disabled Save; 1,030 g showed 550 ml and re-enabled Save |
| BAR-082 | Count persistence | `[x]` | `202608280005` plus `202608290002`, with queued-RPC grant fix `b875bc4` — `boa_bar_submit_count`, a service, and `CountScreen` accumulate blind lines and submit through the outbox. Hosted rollback probe 1 Sep: `boa_bar_open_count` returned `blinded: true`; submit persisted one observed line, changed the session to `submitted`, and replayed the same idempotency key to the same session. |
| BAR-083 | Blind enforcement in the database | `[x]` | Same work as BAR-161, proven the same way. `private.boa_bar_is_blinded` is the single definition and gates both the snapshot and the `movement_line` read policy, so the position cannot be re-summed from the ledger |
| BAR-084 | Seal the theoretical position at submit | `[x]` | `private.boa_bar_count_seal`, summed from the ledger at the instant counted, not from the balance projection which only holds "now". Hosted rollback probe 1 Sep observed the private seal at `3 containers / 1950 ml` for a matching receipt and count; probe 2 confirmed count-line UPDATE/DELETE and seal UPDATE are rejected and the original values remain unchanged. |
| BAR-085 | `countDone` screen | `[x]` | `36ffc4f` |
| BAR-086 | `variance` screen | `[x]` | `36ffc4f` — renders from the repository, signed deltas, banding, notes |
| BAR-087 | Signed variance banding | `[x]` | Fixed 28 Aug. `varianceBand` bands on magnitude then floors a positive variance at amber — it can still be red, never green. Six new assertions in `inventory.test.ts` cover the sign asymmetry, the red ceiling, exact zero and the null case |
| BAR-088 | Throughput ranking | `[ ]` | — |
| BAR-089 | `activity`, five filters | `[x]` | `10185b5` — all five groups; counts unioned from `count_session`, not derived from movements |
| BAR-090 | `mv` screen — movement detail | `[ ]` | Screen missing. The live repository's `movementDetail()` is implemented and has no consumer |
| BAR-091 | Adjustment log view | `[ ]` | — |
| BAR-092 | Paper fallback print views | `[~]` | `/print` — one A4 count sheet per location plus a blank two-party docket, from the repository. **Carries no quantity of any kind**: a printed expected figure defeats blind counting and a sheet cannot be un-printed. Two signature blocks per sheet, per spec §5 and §6. Empties column included despite BAR-160 being open, because a missed physical observation is unrecoverable and a blank column costs nothing. Verified in a browser: 7 sheets, and the only non-empty write-in cells are the unit labels. **The printed output itself has not been seen** — no print preview was available, so page breaks and A4 fit are unverified |
| BAR-145 | In-event correction path | `[x]` | `202608280009` — a bad count is **superseded, never edited**. `boa_bar_count_line` gets an immutability trigger with its own message (the remedy is a recount, not an adjustment), the session row is guarded against being moved to another location or re-stamped, and a supersede requires a stated reason. The original stays exactly as submitted, with the name of whoever entered it. `variance()` reads the **live** count, not merely the latest. **Applied and proven 29 Aug** — 9 behavioural assertions; the UPDATE and the DELETE are both refused by the database |
| BAR-148 | Empties capture | `[~]` | V1 now records returnable empties per location on the printed close-out sheet, with manual storage/responsible-person notes. App/database capture remains intentionally out of scope |
| BAR-150 | Mid-event count scheduling | `[ ]` | `COUNT_DUE_AFTER_MINUTES = 120` in the live repository is an assumption standing in for this |

### M6 — POS ingest and show day — the cuttable milestone

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-093 | Serve map management | `[ ]` | `boa_bar_serve_map` is unreachable by the client by design; nothing manages it |
| BAR-094 | POS import with hard fail | `[!]` | `pos_item_code` is unconstrained free text; no function validates or posts a batch |
| BAR-095 | Idempotent re-import | `[R]` | Uniqueness weakened to a composite including item code |
| BAR-096 | POS rows carry bar and money | `[!]` | `boa_bar_pos_row` has no `location_id` and no amount column, so every ₹ figure and every per-bar sales rate is uncomputable |
| BAR-097 | Sale movements from POS | `[ ]` | — |
| BAR-098 | `boa_bar_v_depletion` | `[ ]` | No views exist |
| BAR-099 | Run-out alerts | `[ ]` | Needs both a depletion rate (this) and par levels (BAR-162). The live repository omits the alert rather than approximating it |
| BAR-100 | `control` screen | `[ ]` | Screen missing |
| BAR-101 | Top-up window scheduling | `[ ]` | — |
| BAR-149 | Alerts that actually reach someone | `[ ]` | Every alert is passive — it exists only while someone holds the phone on the home screen |
| BAR-102 | `home` from real data | `[x]` | `c4728ad` + `a72c48d` — hero card, breakdown and alerts all derived; hero corrected against the design |
| BAR-103 | `cowork` screen | `[ ]` | Screen missing |
| BAR-104 | `more` screen | `[x]` | `798feb2` — six rows, role badge, sync card, build stamp; demo toggles removed from the screen |

### M7 — Reports and settlement

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-105 | `boa_bar_v_excise` | `[ ]` | No views exist in any migration |
| BAR-106 | `boa_bar_v_settlement` | `[ ]` | Same |
| BAR-107 | `reports` screen | `[~]` | An honest empty state served from `src/features/screens.tsx:139`. The gate classes it legitimately static |
| BAR-108 | `rep` screen | `[ ]` | Screen missing |
| BAR-109 | Excise return export | `[ ]` | Blocked on BAR-158 — the template |
| BAR-110 | STOK settlement export | `[ ]` | `is_supplied` is stored and never read |
| BAR-111 | Sales per hour and ₹ per attendee | `[ ]` | Uncomputable while BAR-096 stands |
| BAR-112 | Leak taxonomy view | `[ ]` | — |
| BAR-113 | Ledger export | `[ ]` | — |

### M8 — Human and operational readiness

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-158 | Excise return template — **by 31 August** | `[ ]` | **Three days out and unowned.** Decides what must be physically observed on the night; a missed observation is not backfillable |
| BAR-159 | Confirm the POS owner and export format | `[ ]` | Decides whether BAR-094 is buildable at all |
| BAR-160 | Decide empties | `[x]` | User selected the recommended V1 rule: count returnable empties per location on the close-out paper sheet and note storage/responsibility manually |
| BAR-114 | Component and interaction tests | `[ ]` | Testing Library is installed and typed; no jsdom environment is configured, so no component test can run |
| BAR-115 | Real-device offline and QR checks | `[?]` | Cannot be assessed — there is no QR scanner and no offline read path to test |
| BAR-116 | Staff onboarding and roster | `[ ]` | — |
| BAR-117 | Shift handover and manager-absent path | `[ ]` | — |
| BAR-143 | Onboarding that works at load-in | `[~]` | The **membership half** is done and works with any sign-in method: `boa_bar_claim_invite` binds an already signed-in user to a named membership, and the name comes from the invite so custody carries a real name from the first movement. **The sign-in method itself is undecided** — ADR-014 is PROPOSED and needs the user. Until then load-in still depends on magic links |
| BAR-144 | In-app membership and role management | `[x]` | `202608280011` plus `/team`. A manager invites by name and role and reads out a six-character code; roles can be changed on site. **Escalation is refused in the database**: only an admin may mint or grant manager/admin, so a manager cannot promote themselves via a second account. The last admin cannot be removed or demoted — that would be unrecoverable from inside the app. Verified in a browser: a manager is offered CREW/WAREHOUSE/BAR LEAD/AUDITOR only, and their own row has no selector. **Applied and proven 29 Aug** — 10 behavioural assertions, including that escalation is refused and an invite code is single-use |
| BAR-118 | Backup and restore verified | `[ ]` | — |
| BAR-119 | Observability | `[ ]` | — |
| BAR-120 | Staging deploy and acceptance | `[ ]` | — |
| BAR-121 | Production cutover | `[ ]` | — |

### Counted

Computed from the rows above, not asserted.

| | Count |
| --- | --- |
| `[x]` done | 66 |
| `[~]` partial | 38 |
| `[R]` rewrite | 2 |
| `[!]` defect actively present | 7 |
| `[ ]` not started | 49 |
| `[?]` unverifiable today | 2 |
| **Total** | **164** |

Read the middle three rows as the real position: **47 tasks are neither done nor
untouched**, and 7 of them are defects sitting in the code right now.

## Would stop the event dead

These came out of the adversarial verification pass, which asked one question:
will this survive 10 October? Each is evidenced in code and none was in the
original audit.

| # | Problem | Task |
| --- | --- | --- |
| 1 | ~~**There is no way to enter opening stock.**~~ **Closed 28 Aug.** `boa_bar_open_stock` loads the warehouse at bootstrap and `/receipt` (BAR-060) records a delivery arriving during the event, against the delivery note spec §4 requires. Neither needs a database password | BAR-156 / BAR-060 |
| 2 | **Every bar-side write is hardcoded to Bar 3.** Waste and counts from Bars 1, 2 and 4 post against Bar 3's ledger. Bar 1's variance is understated by exactly what Bar 3's is overstated — both indefensible | BAR-133 |
| 3 | **Demo mode announces itself as live.** `src/app/AppShell.tsx:45` renders `SYNCED` when `backendMode === 'live'` and `LIVE · 19:44 IST` when it is not — exactly backwards. One missing environment variable gives twenty staff a twelve-hour shift against hardcoded fixtures under a label that says live, with total unrecoverable loss discovered on 11 October. **The most dangerous single line in the codebase** | BAR-139 |
| 4 | **Queued movements are attributed to whoever is signed in when the queue flushes**, not who created them. A shift handover on a shared phone re-attributes the outgoing crew member's work. The ledger's "named person" — the entire value of §4 and §5 — becomes wrong | BAR-141 |
| 5 | **`TRUNCATE` is reachable by `anon` and `authenticated` on 11 of 13 tables.** `revoke all` covers only the two ledger tables, and the anon key ships in the browser bundle | BAR-122 |
| 6 | **The issuing device can accept its own docket two taps later**, and the app prints a receiver name who was never present. This reduces the spec's highest-value feature to self-certification | BAR-147 |
| 7 | **There is no way to fix a bad count during the event.** A crew member types 110 instead of 11 and submits: no edit, no recount, no void, no adjustment. The choice is a known-false record or abandoning the app | BAR-145 |
| 8 | **An unaccepted docket parks the full quantity in `in_transit`, which no screen reads.** Stock vanishes from every report while the ledger says it exists — exactly the case §5 exists to resolve | BAR-146 |
| 9 | **Unsynced work exists only on one phone**, with no manager visibility and no handover or device-loss procedure. A flat, dropped or wiped phone takes its movements with it and leaves no record they existed | BAR-142 |
| 10 | **Onboarding is email magic-link only** — ~20 temporary staff, many without a work email, on congested cellular at load-in. Those who installed the PWA find the installed app still signed out while the browser tab is in | BAR-143 |
| 11 | ~~**Nobody can change a role from inside the app.**~~ **Closed 28 Aug**, `202608280011` + `/team`. A manager can enrol a bar lead arriving at 20:00 and promote somebody before leaving at 23:00, without a database password. Escalation is refused in the database and the last admin cannot be removed | BAR-144 |
| 12 | **`business_date` is the IST calendar date**, so the festival night splits at midnight and the identity cannot close for the event. A close-out count at 01:30 belongs to 10 October | BAR-123 |
| 13 | ~~**Nothing resolves a user id to a person's name**~~ **Closed 29 Aug.** `boa_bar_person` plus an append-only name history and `boa_bar_set_person_name`, `supabase/migrations/202608280001_person_names.sql`, now **applied**. A movement can be attributed to a named person rather than a UUID | BAR-124 |
| 14 | **Empties are never counted** and cannot be reconstructed afterwards. This is a physical observation that exists only between 23:00 and 03:00 on 10 October, and both the excise return and the STOK settlement have a line for it | BAR-148 |
| 15 | **There is no QR scanner anywhere in the app** — so the acceptance side of two-party custody has no input device, while `vercel.json` already grants camera permission for the capability that was never built | BAR-136 |
| 16 | **No alert reaches anyone.** Every alert is passive, existing only while someone holds the phone on the home screen. The warehouse never learns Bar 3 is 26 minutes from dry, and the bar has no way to ask | BAR-149 |
| 17 | **Blind counting is not enforced by the database.** `boa_bar_inventory_snapshot` cross-joins every location against every SKU and authorises on "holds any role at this venue", so a bar lead's own device can fetch the expected position for the bar it is about to count — one REST call, no UI involved. Non-negotiable 3 requires the database to enforce this, and the UI's careful omission of expected figures is worth nothing while the API hands them over. Found 28 August while building the live read path | BAR-161 |
| 18 | ~~**Positive variance grades green.**~~ **Fixed 28 Aug**, `bd0f1a2`-series. `varianceBand` now floors a positive variance at amber and can still reach red on magnitude. **Correction to the first version of this row:** it claimed `+2.4%` on bottled beer graded green. That was wrong — bottled beer's green edge is 1%, not 3%, so `+2.4%` already banded amber and reproduced the design. The real defect was smaller positives: `+0.5%` bottled beer, `+1.2%` spirits and `+4%` draught all graded green, and spec §8 requires positive variance never to be green | BAR-087 |
| 19 | ~~**The bars list dead-ends under live data.**~~ **Fixed 28 Aug.** `BarsScreen` opens any bar; `CountSession.locationId` and `Custody.toLocationId` now carry the id the two flow CTAs need. BAR-154's lint rule was added at the same time and **was verified to catch all three literals** before they were removed | BAR-133 |
| 20 | ~~**Any signed-in user could forge a movement.**~~ **Found and fixed 28 Aug**, `202608280003`, verified shut. `private.boa_bar_post_movement` was extracted that morning so the bootstrap could supply an actor explicitly — and it therefore takes the actor as a parameter. `create function` grants EXECUTE to PUBLIC by default, and `authenticated` already had USAGE on schema `private` (needed since BAR-012 so RLS policies can resolve `boa_bar_has_role`). So for several hours any crew member could post any movement, to any location, attributed to anyone, bypassing both the role gate and the two-party docket rules. **It was live, not theoretical** — I initially recorded it as unexploitable on the grounds that the migration was unapplied, and it had in fact been applied | BAR-011 |
| 21 | ~~**Every ledger read broke for every signed-in user.**~~ **Found and fixed 28 Aug**, `202608280008`. `202608280007` put `private.boa_bar_is_blinded` inside the `boa_bar_movement_line` RLS policy and revoked EXECUTE from `authenticated` in the same migration. An RLS policy is evaluated as the **querying** role, not the table owner, so every read of `boa_bar_movement_line` returned `permission denied for function boa_bar_is_blinded` — breaking the activity feed, the bar workspace's movement summary and the variance report for everybody. **This is the same mistake BAR-012 fixed once already** for `boa_bar_has_role`, whose migration header explains the reason; it was repeated four migrations later by the same author. It reached the live database and was caught only because a behavioural test was written alongside it | BAR-161 |

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
4. ~~**Apply the migrations**~~ **done 28 Aug — all seven applied, 63/63 pgTAP
   assertions green, all EXECUTE holes shut.** What remains is one step:
   **create the first `auth.users` row.** `pnpm bootstrap` cannot make anybody
   admin until one exists, and it refuses rather than guessing. The quickest route
   involves no email at all: Supabase dashboard -> Authentication -> Users ->
   Add user, with Auto Confirm ticked. Then:

   ```
   node scripts/bootstrap.mjs
   ```

   For reference, the commands that got the schema there:

   ```
   node_modules/.bin/supabase db push
   read -s "SUPABASE_DB_PASSWORD?Database password: " && export SUPABASE_DB_PASSWORD
   node scripts/bootstrap.mjs
   ```

   `pnpm` is **not** on the PATH on this machine — `corepack enable` needs sudo, so
   scripts run as `corepack pnpm <script>`. The bootstrap is plain Node, so calling
   it directly sidesteps that.

   `db push` applies `202608280001_person_names.sql` and
   `202608280002_bootstrap.sql`. `pnpm bootstrap` needs at least one sign-in to
   have happened first, because it needs an `auth.users` row to make admin — it
   says so and changes nothing if there is none.
5. **BAR-140 — a screen for opening stock.** The RPC exists; a warehouse lead
   still cannot enter opening stock without the database password.
6. **Open decision 5 — the excise return template.** Six weeks out, unowned and
   undated. The return's category vocabulary and its treatment of empties dictate
   what must be physically observed on the night. A wrong category set is
   backfillable per SKU; a missing physical observation is not.
7. **The six open decisions** below.

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

Rewritten 28 August after BAR-051. The custody write chain is now complete in
application code; neither half has executed under a real signed-in user.

**1. BAR-082 — a count-submit RPC.** The counting chain has no destination, so a
submitted count is discarded. `boa_bar_count_line` has no write path at all.

**2. BAR-161 — location-scope `boa_bar_inventory_snapshot`.** Blind counting is the
product's core integrity control and is currently a UI convention: any member can
read the expected position for the location they are about to count.

**3. BAR-164 — delete the legacy path.** `src/lib/live-repository.ts` and
`demo-store`'s snapshot loader are a second live data path that hardcodes `bar_3`.
It is the remaining half of BAR-133, of BAR-071 (a write inside an unawaited
`void`) and of BAR-157.

**4. BAR-081 — apply `mlFromGrossWeight`.** The count screen shows the tare weight
and never uses it, so a weighed partial is entered as a raw gross reading.

Do **not** start the five missing screens (`sku`, `mv`, `control`, `cowork`, `rep`)
before 1 and 2. They add surface, not capability.

### Blocked on the user, not on code

- **One `auth.users` row.** Dashboard -> Authentication -> Users -> Add user, Auto
  Confirm ticked. Then `node scripts/bootstrap.mjs`. Until this exists **no live
  read and no live write has ever executed**, and everything in `src/data/live/`
  and `src/services/` is verified against fixtures only.
- **BAR-158, the excise return template.** Target was 31 August.

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

### Session — 31 August 2026 · codex

**Completed: BAR-163 decision — paper-only count witnessing.**

The user selected the V1 approach of recording the second person's witness on the
printed count sheet only. The app will not add a required second-user submission
step; its existing assigned-counter and manager-review fields remain unchanged.

**Files changed:** `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** app-level witness capture is deferred; paper print verification
remains pending.

**Recommended next:** continue with the next release decision or implementation
gap.

### Session — 31 August 2026 · codex

**Completed: BAR-160 decision and BAR-148 paper implementation.**

The user selected the recommended V1 rule: count returnable empties per location
on the close-out paper sheet, and note storage location and responsible person
manually. The print pack copy now states that rule explicitly. BAR-160 is closed;
BAR-148 remains partial because app/database capture is intentionally deferred.
Typecheck, lint, and 143 unit tests pass.

**Not verified:** physical print output and A4 fit remain pending.

**Files changed:** `src/screens/print/PrintScreen.tsx`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** app/database empties capture is out of scope for V1; live,
offline, and print verification remain pending.

**Recommended next:** continue the remaining implementation pass, then perform
the parked verification run.

### Session — 31 August 2026 · codex

**Completed: BAR-026 implementation — dynamic excise categories.**

Added `boa_bar_excise_category` as controlled reference data, seeded only with
beer, IMFL, mixer, water, and other. Existing provisional SKU values are
normalized, then `excise_category` is made required with a foreign key. Future
categories can be added as data when the original Chandan/Salman stock sheet is
available. `check:sql`, typecheck, lint, and 143 unit tests pass.

**Not verified:** hosted migration application and live SKU data remain parked.

**Files changed:** `supabase/migrations/202608310010_excise_categories.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** final category values still need confirmation against the
original stock list; DB/device/print verification remains pending.

**Recommended next:** continue implementation, then load the confirmed stock
vocabulary before release sign-off.

### Session — 31 August 2026 · codex

**Completed: database tolerance-band wiring.**

Added read-only `public.boa_bar_tolerance_bands()` and updated the live variance
repository to grade each line from the versioned database thresholds rather than
the TypeScript constants. Fixture mode remains deterministic. Typecheck, lint,
143 unit tests, and `check:sql` pass.

**Not verified:** the RPC and live variance response require migration application
and a hosted database run, which remain parked.

**Files changed:** `supabase/migrations/202608310009_tolerance_bands.sql`,
`src/data/live/live-repository.ts`, `src/data/live/rows.ts`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** hosted migration/device/print verification remains pending.

**Recommended next:** continue implementation, then apply migrations 004–009 and
run the full DB suite before release sign-off.

### Session — 31 August 2026 · codex

**Completed: BAR-025 implementation — versioned tolerance bands.**

Added `boa_bar_tolerance_band` with four seeded categories and the documented
green/amber thresholds, each effective from 31 August 2026. Client roles receive
no direct table grant; consumers will be wired during the variance work.
`check:sql`, typecheck, lint, and 143 unit tests pass.

**Not verified:** hosted migration application and variance-consumer behavior are
parked with the DB test pass.

**Files changed:** `supabase/migrations/202608310009_tolerance_bands.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** tolerance consumers still use the TypeScript fallback; hosted
DB/device/print verification remains pending.

**Recommended next:** continue implementation, then migrate and wire the database
tolerances into variance calculation before release sign-off.

### Session — 31 August 2026 · codex

**Completed: BAR-029 implementation — movement-line join index.**

Added `202608310008_movement_line_index.sql` with an index on
`boa_bar_movement_line(movement_id)`, the join key used by movement detail and
audit reads. `check:sql`, typecheck, lint, and 143 unit tests pass.

**Not verified:** the migration has not been applied to the hosted database while
DB verification is parked.

**Files changed:** `supabase/migrations/202608310008_movement_line_index.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** hosted migration application and device/print checks remain
pending.

**Recommended next:** continue the implementation pass, then apply migrations
004–008 and run the full verification suite.

### Session — 31 August 2026 · codex

**Completed: BAR-128 — deterministic membership selection.**

Active memberships are now ordered by venue, role, and location before the first
membership is selected. A user with multiple roles therefore gets the same active
venue/role after refreshes and on different devices. Typecheck, lint, and 143 unit
tests pass.

**Not verified:** the ordering has not been exercised against a multi-membership
live account while database/device tests are parked.

**Files changed:** `src/lib/auth.tsx`, `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** live migration verification, offline/device checks, and print
output remain parked.

**Recommended next:** continue the remaining implementation pass, then run the
full verification suite.

### Session — 31 August 2026 · codex

**Completed: BAR-015 implementation — ledger/projection reconciliation view.**

Added ungranted security-invoker `public.boa_bar_v_reconciliation`, comparing
ledger aggregates with `private.boa_bar_balance` and returning only mismatches.
An empty result is the audit invariant. `check:sql`, typecheck, lint, and 143
unit tests pass.

**Not verified:** the migration has not been applied to the hosted database and
the empty-result behavior remains parked with DB verification.

**Files changed:** `supabase/migrations/202608310007_reconciliation_view.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** hosted migration application and behavioral checks remain
pending; offline/device and print verification are parked.

**Recommended next:** continue implementation on remaining release-critical
items, then run the database suite across migrations 004–007.

### Session — 31 August 2026 · codex

**Completed: BAR-014 implementation — ledger-derived position view.**

Added security-invoker `public.boa_bar_v_position`, aggregating containers,
millilitres, value, and last movement time directly from immutable movement lines.
It is not granted to client roles yet, so it cannot create a second live read path.
`check:sql`, typecheck, lint, and 143 unit tests pass.

**Not verified:** migration application and view behavior against the hosted
database remain parked.

**Files changed:** `supabase/migrations/202608310006_position_view.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** BAR-015 reconciliation view is still open; DB/device/print
verification remains parked.

**Recommended next:** continue the remaining implementation pass, then apply and
verify the migrations together.

### Session — 31 August 2026 · codex

**Completed: BAR-021 implementation — guarded adjustment movements.**

Added `202608310005_adjustment_guard.sql`: adjustments now require an active
manager/admin actor, a non-blank reason, and a same-venue reversal target; a
partial unique index prevents reversing one movement twice. `check:sql`,
typecheck, lint, and 143 unit tests pass.

**Not verified:** the migration and rejection cases have not been run against the
hosted database while DB tests are parked.

**Files changed:** `supabase/migrations/202608310005_adjustment_guard.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** live migration application and behavior proof remain pending;
offline/device and print checks are parked.

**Recommended next:** continue implementation on the next release-critical gap,
then run the full database suite after the implementation pass.

### Session — 31 August 2026 · codex

**Completed: BAR-028 implementation — non-negative position guard.**

Added migration `202608310004_non_negative_position.sql` with a trigger on the
private balance projection, the sole writer-side position boundary. Any movement
that would leave containers or millilitres below zero is rejected. `check:sql`,
typecheck, lint, and 143 unit tests pass.

**Not verified:** the migration has not been pushed to the hosted database and
the rejection behavior is not yet covered by the parked DB test run.

**Files changed:** `supabase/migrations/202608310004_non_negative_position.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** live migration application, offline/device checks, and print
output remain parked.

**Recommended next:** continue implementation on the next open integrity item;
run the database suite after the implementation pass.

### Session — 31 August 2026 · codex

**Completed: BAR-072 receipt draft persistence.**

Receipt supplier, delivery note, selected product, quantities, line list, and the
idempotency action id now persist in the existing Dexie draft store and restore
after reload. A successful receipt clears the draft. Typecheck, lint, and 143 unit
tests pass.

**Not verified:** the reload flow still needs a browser run; physical print and
offline device checks remain parked as requested.

**Files changed:** `src/screens/receipt/ReceiptScreen.tsx`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** the visual harness remains stale; live acceptance and physical
print output are still unverified.

**Recommended next:** continue implementation on the remaining Release 1 gaps;
return to browser/database verification afterward.

### Session — 31 August 2026 · codex

**Completed: BAR-068 guard coverage — offline membership eligibility.**

Extracted the offline-session eligibility check into a pure helper and added four
tests covering valid/expired JWTs, online bypass, and sessions without an expiry.
Auth now uses that helper before reading cached memberships. Typecheck, lint, and
**143 unit tests** pass.

**Not verified:** a real browser airplane-mode cold start and refresh longevity
still require a signed-in session and device-level network toggle.

**Files changed:** `src/lib/auth.tsx`, `src/lib/auth-offline.ts`,
`src/lib/auth-offline.test.ts`, `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** live acceptance and physical print output remain unverified;
the visual harness remains stale.

**Recommended next:** perform the signed-in browser offline test, then close the
remaining live Release 1 checks.

### Session — 31 August 2026 · codex

**Completed: BAR-092 entry point — SETTINGS opens the print fallback pack.**

The `/print` route and repository-backed sheets already existed, but the visible
SETTINGS row only flashed a placeholder. It now navigates to the printable count
and docket pack. Typecheck, lint, and 139 unit tests pass.

**Not verified:** physical A4 output, page breaks, and printer rendering still
require a print preview or real printer.

**Files changed:** `src/screens/more/MoreScreen.tsx`, `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** offline cold start and live custody acceptance remain to be
verified; the visual harness remains stale.

**Recommended next:** BAR-068 offline cold-start verification.

### Session — 31 August 2026 · codex

**Completed: BAR-146 follow-through — home docket alerts open the custody list.**

The home screen's awaiting-docket alert previously still flashed the retired
BAR-055 placeholder even though the custody list and accept flow existed. Its
OPEN action now routes to `/dockets`, where every awaiting docket (including the
in-transit total) can be selected. Typecheck, lint, and 139 unit tests pass.

**Files changed:** `src/screens/home/HomeScreen.tsx`, `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** live acceptance and print/offline operational checks still need
to be completed; the visual harness remains stale.

**Recommended next:** BAR-068 offline cold-start verification.

### Session — 31 August 2026 · codex

**Completed: live movement-guard verification — BAR-017 / BAR-018 / BAR-022.**

The user ran the expanded hosted PostgreSQL suite. `movement_guards.test.sql`
passes all 6 assertions, and the complete suite now reports **134 assertions
passed, 0 failed**. The three migrations are therefore applied and behaviourally
proven against PostgreSQL 17.6.

**Files changed:** `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** `ledger.test.sql` remains existence-only; the visual harness
still reports stale hardcoded-screen output; six cut/missing screens remain out
of scope.

**Recommended next:** BAR-068 offline cold-start verification, then the next
open Release 1 item.

### Session — 31 August 2026 · codex

**Completed: focused movement-guard coverage — BAR-017 / BAR-018 / BAR-022.**

Added `supabase/tests/movement_guards.test.sql` with behavioural assertions for
hand-keyed sale rejection, cross-venue SKU protection, balanced hospitality comps,
and unbalanced comp rejection. `check:sql`, typecheck, lint, 139 unit tests, and
the production build all pass locally.

**Not verified:** the new pgTAP file has not yet been run against the hosted
database in this environment; the user must run `corepack pnpm test:db`.

**Files changed:** `supabase/tests/movement_guards.test.sql`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Known issues:** the visual harness still reports stale hardcoded-screen output;
the six cut/missing screens remain intentionally out of scope.

**Recommended next:** run the expanded pgTAP suite, then BAR-068 offline cold-start
verification or the next open Release 1 item.

### Session — 31 August 2026 · codex

**Completed: live migration verification — BAR-018, BAR-022, and BAR-017 migrations applied.**

The user applied the three new migrations with the local Supabase CLI. `db-state`
shows all three versions in remote history, and the hosted PostgreSQL 17.6 suite
passes **128 assertions, 0 failed** after application.

**Verified:** `corepack pnpm test:db` (user shell), with the migration history and
live object/data summary captured from `db-state`.

**Files changed:** `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** the new BAR-017/BAR-018/BAR-022 rules do not yet
have dedicated pgTAP behaviour cases; the existing suite remains green.

**Recommended next:** add focused behavioural pgTAP cases for the three new
migrations, then continue the Release 1 checklist.

### Session — 31 August 2026 · codex

**Completed: BAR-131 — removed fake OS status chrome.**

Deleted the shell's hardcoded `19:44`, battery icon, and `4G` indicator. The app
no longer presents a frozen device status bar beside real venue-local timestamps.

**Verified:** typecheck, lint, 139 unit tests, and build pass.

**Files changed:** `src/app/AppShell.tsx`, `src/styles.css`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** the visual gate remains unsuitable in this
environment because its fixture run reports stale hardcoded-screen results.

**Recommended next:** apply and prove pending migrations, then continue Release 1
verification.

### Session — 31 August 2026 · codex

**Completed: BAR-068 (implementation) — cached membership for offline cold start.**

Successful live membership loads are now cached per authenticated user. When a
previously signed-in device starts offline with a still-valid JWT, auth restores
the cached venue membership instead of locking the staff member at the network
gate. Sign-out still clears the cache before handoff.

**Verified:** typecheck, lint, 139 unit tests, and build pass.

**Files changed:** `src/lib/auth.tsx`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** a real offline cold-start, token refresh, and
shared-phone longevity still need a browser/device test; no live database access
was required for this code change.

**Recommended next:** BAR-131, then the remaining Release 1 verification and
database-application work.

### Session — 31 August 2026 · codex

**Completed: BAR-017 (implementation) — balanced hospitality comps.**

Added `202608310003_comp_two_leg.sql`. The shared movement poster now accepts
balanced `comp` lines, and a deferred trigger requires the movement to include a
hospitality destination. The ledger remains append-only.

**Verified:** `check:sql`, typecheck, lint, 139 unit tests, and build pass.

**Files changed:** `supabase/migrations/202608310003_comp_two_leg.sql`,
`docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** migration has not been applied or behaviourally
tested against the live database because the database password is user-only.

**Recommended next:** apply and prove the pending migrations, then continue with
the next release blocker.

### Session — 31 August 2026 · codex

**Completed: BAR-022 (implementation) — venue-scope movement lines.**

Added `202608310002_scope_movement_lines.sql`, an insert trigger that verifies a
movement line's SKU and location belong to the parent movement's venue.

**Verified:** `check:sql`, typecheck, lint, 139 unit tests, and build pass.

**Files changed:** `supabase/migrations/202608310002_scope_movement_lines.sql`,
`docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** migration has not been applied or behaviourally
tested against the live database because the database password is user-only.

**Recommended next:** BAR-017, then apply and prove the pending migrations with the
user's database credentials.

### Session — 31 August 2026 · codex

**Completed: BAR-018 (implementation) — reject hand-keyed sale movements.**

Added `202608310001_restrict_sale.sql`, an append-only trigger that permits sale
rows only when their source is `pos`; all PWA/general movement writes are refused.

**Verified:** `check:sql`, typecheck, lint, 139 unit tests, and build pass.

**Files changed:** `supabase/migrations/202608310001_restrict_sale.sql`,
`docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** migration has not been applied or tested against
the live database because the database password is user-only.

**Recommended next:** BAR-022, then apply and prove the pending migrations with the
user's database credentials.

### Session — 31 August 2026 · codex

**Completed: BAR-104 UI correction — More list no longer clips SETTINGS.**

The supplied screenshot showed the SETTINGS label present but its wrapped subtitle
cut off where the list flex item met the sync card. `.more-list` now keeps its
intrinsic height (`flex: none`), allowing the section body to scroll instead of
shrinking and clipping the final option. Browser screenshot verification shows
the complete SETTINGS row and subtitle.

**Verified:** typecheck, lint, 139 unit tests, and build pass. The visual gate was
not green in this environment (it reported the existing fixture harness as
hardcoded), so no fidelity claim is made from that command.

**Files changed:** `src/styles.css`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** Other overlap reports need their own reproducible
viewport capture; D-0002 acceptance still has not been confirmed in the database.

**Recommended next:** retry D-0002 acceptance, then audit each reported screen at
the user's viewport.

### Session — 31 August 2026 · codex

**Completed: BAR-135 follow-up — explicit resolution for retained invalid outbox entries.**

The More screen now exposes `Resolve failed action` when a dead-lettered command
blocks ordered replay. Resolving marks the entry `resolved` without deleting its
audit record, then unblocks later commands. The acceptance device was browser-
verified: the stale self-accept failure was resolved and the sync card returned to
`✓ SYNCED`.

**Verified:** typecheck, lint, 138 unit tests, and build pass. The visual gate was
run but reported the existing fixture harness as 14 hardcoded screens / 0 data
layer screens, so it is not a green UI gate in this environment.

**Files changed:** `src/domain/outbox-policy.ts`, `src/domain/outbox-policy.test.ts`,
`src/lib/offline-db.ts`, `src/lib/app-store.tsx`, `src/screens/more/MoreScreen.tsx`,
`src/styles.css`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** D-0002 has not yet been re-posted after resolving
the old failure; no database inspection was possible without the user's password.
The current More and acceptance captures show no geometric overlap at 390×844;
the user's reported overlap at another viewport still needs a reproducible capture.

**Recommended next:** retry D-0002 acceptance, then capture the reported UI overlap
at the user's viewport before making any fidelity changes.

### Session — 30 August 2026 · codex

**Completed: BAR-137 (partial) — shared-device sign-out and cache isolation.**

The approved handoff slice is now in More. `SIGN OUT` clears the user-scoped
reference cache and unfinished drafts in one Dexie transaction, clears React Query
data, retains pending/failed outbox commands for the user's next sign-in, and
calls Supabase local-scope sign-out so a dead spot cannot prevent handoff. A
browser run as VIPIN showed the button and returned to the Staff sign-in screen
after tapping it; no live venue data remained visible.

**Verified:** typecheck, lint, **138 unit tests**, build, `check:sql` and the
fixture visual gate pass. The sign-out path was exercised in the live browser.

**Files changed:** `src/lib/offline-db.ts`, `src/lib/auth.tsx`,
`src/screens/more/MoreScreen.tsx`, `src/styles.css`, `docs/CURRENT-STATE.md`,
`docs/HANDOVER.md`.

**Architecture changes:** none.

**Known issues / not verified:** This proves handoff while online; a real
offline cold start, JWT expiry/refresh over a shift, and direct inspection of the
retained outbox rows were not performed. D-0002 still needs a different Bar 3
account to complete acceptance.

**Recommended next:** use the cleared browser to sign in as the independent Bar 3
receiver and complete D-0002.

### Session — 30 August 2026 · codex

**Completed: BAR-135 — invalid outbox entries stop, remain visible, and cannot produce a false custody receipt.**

An authenticated live session created docket **D-0002** for 6 cans of Bira 91
White, Warehouse → Bar 3. The create half posted: Warehouse moved 613 → 607,
in-transit moved 24 → 30, total stock stayed 637, and the open-docket count moved
1 → 2. This proves screen → service → outbox → RPC → ledger for the issue leg.

The same signed-in user (VIPIN, the issuer) then attempted acceptance. The
database's BAR-147 rule correctly prevented the custody transfer: after the
attempt Bars remained 0, in-transit remained 30 and D-0002 remained awaiting.
The walkthrough exposed two client defects:

1. The RPC raises `42501` with `a docket cannot be accepted by the person who
   issued it`. `classifyFailure` treats every `42501` as an authentication stop,
   so this permanent rule violation remains `pending` instead of dead-lettering.
   The shell now shows **LIVE · 1 PENDING**, and ordered replay means it can block
   every later write on this browser.
2. After the eight-second settle timeout, `AcceptScreen` treats the queued result
   as success and navigates to the RECEIVED route with the docket UUID. The live
   `custody()` query accepts only a docket number, so the supposed receipt renders
   `Docket <uuid> was not found`. A genuinely posted acceptance would take the
   same UUID branch and fail the same way.

Both are fixed. The explicit self-acceptance refusal is classified before the
general `42501` authentication stop, so it dead-letters permanently on its first
attempt. PostgREST-shaped plain objects now retain their `message` instead of
being flattened to `Unknown sync failure`. The existing SYNC STATE card displays
the failed action and newest retained error rather than claiming `✓ SYNCED / All
movements posted`. `AcceptScreen` remains on RECEIVE STOCK for a durable queued
write and opens RECEIVED only for `status = posted`, routing by the server-minted
docket number rather than its UUID.

The original live entry was created before error-message preservation changed,
so it can identify itself only as `Docket acceptance: Unknown sync failure`.
After hot reload the same retained row changed from **LIVE · 1 PENDING** to **LIVE
· 0 PENDING / 1 NOT SENT · NEEDS ATTENTION**. It did not retry again. Warehouse
remained 607, Bars 0, in-transit 30 and D-0002 remained awaiting acceptance.

**Verified:** typecheck, lint, **138 unit tests**, build, `check:sql` and the
fixture visual gate pass. The visual gate needed an unsandboxed Chromium launch;
its first sandboxed attempt failed before opening a page, then the approved rerun
completed successfully. Live browser evidence is the retained D-0002 transition
above.

**Files changed:** `src/domain/{outbox-policy,outbox-policy.test}.ts`,
`src/lib/offline-db.ts`, `src/lib/app-store.tsx`, `src/screens/custody/AcceptScreen.tsx`,
`src/screens/more/MoreScreen.tsx`, `src/styles.css`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues / not verified:** D-0002 has not been accepted by a second person.
The failed self-acceptance is retained in this browser's durable outbox and was
not deleted or altered; ordered replay deliberately holds later writes until a
human resolves it. Raw database rows were not inspected because the database
password is available only in the user's shell. Active members also have no
sign-out control, so this device cannot perform the required account handoff.

**Recommended next:** sign in a second account in the now-cleared browser and
retry D-0002 as Bar 3's receiver. Do not claim the custody chain is proven until
Bars moves 0 → 6, in-transit moves 30 → 24, and both names render on RECEIVED.

### Session — 29 August 2026 · codex

**Completed: BAR-082 — proved the live blind-count submission, with the BAR-024 count-command location boundary.**

The first live count walkthrough exposed a routing gap: a global admin has no
fixed membership location, so opening `/count` could not select a bar. The bar
workspace now supplies its selected location to count and variance routes; the
count screen remains blind. Migration `202608290002_count_location_scope.sql`
wraps the public open/submit count RPCs with the same location-access helper as
waste, while leaving the implementation private. Scoped bar leads are refused
for another bar; manager/admin may explicitly select a venue location.

The user applied that migration and ran the live database suite: **128 pgTAP
assertions passed, 0 failed** (`location_scope` 11, `privileges` 64). Local
static/gate evidence: `check:sql`, typecheck, lint, unit tests (136), build and
the fixture visual gate all passed (15 reading the data layer, 0 hardcoded,
0 errored).

In user-driven Safari, Bar 2 opened a **MID-EVENT COUNT · BLIND** session. The
first input showed `0`, not an expected figure; all 11 SKUs were entered as
zero and submitted. `node scripts/db-state.mjs` then reported one count session,
11 count lines, and `Bar 2 · mid_event · submitted · 11 lines ·
2026-08-29T15:26:36.255Z` (session
`ba685241-0ff4-4fc0-927d-1c889e97038`). The Bar 2 variance screen subsequently
loaded and showed expected/count values only after submission.

**Files changed:** `src/app/AppShell.tsx`, `src/app/router.tsx`,
`src/screens/bar/BarScreen.tsx`, `src/screens/count/CountScreen.tsx`,
`src/screens/count/CountDoneScreen.tsx`, `src/screens/count/VarianceScreen.tsx`,
`src/data/fixture/fixture-repository.ts`,
`supabase/migrations/202608290002_count_location_scope.sql`,
`supabase/tests/location_scope.test.sql`, `supabase/tests/privileges.test.sql`,
`scripts/db-state.mjs`, `docs/CURRENT-STATE.md`, `docs/HANDOVER.md`.

**Architecture changes:** none.

**Known issues / not verified:** Safari was user-driven, not agent-controlled.
`db-state.mjs` confirmed the session status and line count, not each raw
count-line quantity or the private sealed values. Direct global `/count` and
`/variance` routes still lack a selected location; the Bar 2 workspace route is
the proven path. Receipt and issue → docket → accept remain unproven. BAR-024
read policies and the non-waste/non-count commands remain unscoped.

**Recommended next:** prove the live issue → docket → accept custody cycle.

### Session — 29 August 2026 · codex

**Completed: BAR-024 waste-command slice — the first live screen write is proven.**

The first Safari walkthrough exposed that the bootstrap admin has no fixed
`membership.location_id`, so `/waste` could not identify a location. Routing
from a selected workspace now carries that location. The database boundary was
added at the same time: scoped roles can record waste only at their membership
location, while manager/admin may explicitly select a venue location. The rest
of BAR-024 (read policies and the other command RPCs) remains open.

Migration `202608290001_location_scope.sql` was applied by the user. Their live
PostgreSQL 17.6 run reported **113 pgTAP assertions passed, 0 failed**, including
all 4 `location_scope` behaviours and 56 privilege assertions. Two pre-existing
tests were made live-state-independent after they initially failed: membership
now uses a transaction-local venue, and receipt compares the balance projection
with the ledger sum rather than assuming an empty warehouse.

The user drove authenticated Safari because the controllable in-app browser was
blocked by the email rate limit. The live form showed **WAREHOUSE / Bira 91
White / 1 can / Breakage**. After submission it returned Home showing **LIVE · 0
PENDING**, total **637**, Warehouse **613**, Bars **0**, In transit **24**; total
stock had been 638. The user's subsequent `node scripts/db-state.mjs` connected
to the hosted database, showed the location-scope migration present and reported
**3 movements**, one more than the two pre-walkthrough movements. Together these
prove screen → service → outbox → RPC → ledger for this waste entry.

**Files changed:** `src/app/AppShell.tsx`, `src/app/router.tsx`,
`src/data/fixture/fixture-repository.ts`, `src/screens/bar/BarScreen.tsx`,
`src/screens/waste/WasteScreen.tsx`,
`supabase/migrations/202608290001_location_scope.sql`,
`supabase/tests/{location_scope,membership,privileges,receipt}.test.sql`,
`docs/{CURRENT-STATE,HANDOVER}.md`.

**Architecture changes:** none. The migration extends the existing ADR-013
command-RPC boundary.

**Known issues / not verified:** `db-state.mjs` reports counts, not the new
movement's kind, actor, reason, id or line values, so those fields were not
directly inspected. Safari was user-driven, not agent-controlled. Count,
receipt, and issue → docket → accept have still never been posted from a live
screen. BAR-024 read policies and non-waste commands remain unscoped. The test
waste is permanent in the append-only ledger; any correction must be a
compensating movement.

**Recommended next:** prove the live count write from HANDOVER §2A.

### Session — 29 August 2026 · claude

**Completed: the database is now fully applied and behaviourally proven.**

All eleven migrations are applied. `corepack pnpm test:db` reports **107
assertions, 0 failed** across seven files. The three files that had never
executed — `recount` (9), `receipt` (8), `membership` (10) — are green, so
BAR-145, BAR-060 and BAR-144 move from "written" to proven: a bad count is
superseded and both an UPDATE and a DELETE are refused by triggers; a repeated
delivery note is refused with `23505`; privilege escalation is refused and an
invite code is single-use.

**One test was wrong and the schema was right.** `receipt.test.sql` test 5 used
pgTAP's three-argument `throws_ok`, whose third argument is the expected
*message*, not the description — so it compared my prose against the real error
text. The duplicate guard had fired correctly all along. The message names the
note, the supplier and the instant of the first recording, so it cannot be
matched literally; the assertion now checks the SQLSTATE and states why in place.
**The SQLSTATE is the contract; the prose is for the person at load-in.**

`scripts/db-test.mjs` and `scripts/bootstrap.mjs` printed a bare `pnpm` command
in their credentials help — the exact trap CLAUDE.md documents. Both now print
`corepack pnpm`.

**Files changed:** `supabase/tests/receipt.test.sql`, `scripts/db-test.mjs`,
`scripts/bootstrap.mjs`, `docs/CURRENT-STATE.md`.

**Architecture changes:** none.

**Known issues:** `ledger.test.sql` (11) is still existence-only — BAR-030, and
the runner says so itself rather than letting the total flatter it. **`auth.users`
now holds a user, the venue is claimed and the app has read live data — 638
containers, bars at zero. **No live *write* has been posted from a screen.**
BAR-068
remains a live defect (offline cold start locks staff out).

**Also done, later the same day — the live path is open.** There was no
`.env.local` at all, which is the real reason no live read had ever executed: the
app was never pointed at Supabase, so `AuthGate` short-circuited on
`mode === 'demo'` and served fixtures behind the DEMO DATA banner. With the
project URL and the **publishable** key in place (never the secret key — `VITE_`
variables are compiled into the bundle and served to every phone), the app now
enforces sign-in, and signed in it renders **638 containers with the bars at
zero**. That figure is the ledger's, and the fixtures cannot produce it: they
report 1,284 across three locations. Per-SKU figures prove nothing here, since
the opening stock was taken from the design reference and is identical in both.

An unauthenticated REST read of `boa_bar_venue` returns **401, permission denied**
— `anon` holds no privileges, confirmed against real HTTP rather than inferred
from a grant table.

**Recommended next:** BAR-068 — the offline cold start, the last item that is a
defect rather than a gap. Then post a count, a waste entry and a docket from a
screen against the live database: the read path is proven, the write path
through the app is not.

### Session — 28 August 2026 · codex

**Completed: BAR-051 — the issue side of custody is now a real write path.**

The legacy `IssueScreen` was removed from `src/features/screens.tsx` and rebuilt
from the approved `issue` branch. Source, destination, current actor, the complete
SKU catalogue, case size, container vocabulary and warehouse position all come
from the new `Repository.issueOptions()` read model; the screen contains no
fixture SKU, location or stock figure. The design's case/container switch,
equivalence, quarter-case container step, 1/2/4/6-case presets and warehouse-after
row are derived and bounded by the held position.

The route now carries a Zod-validated draft — stable action id, source,
destination, SKU, whole containers and entry unit. `ReviewScreen` resolves those
ids through the repository instead of reading `custody()`, preserves the draft on
back, and calls `issueStock`. A posted result navigates using the server-minted
docket number; a durable-but-not-posted result remains on Review and explicitly
says it is queued rather than claiming a docket exists.

**Browser verification at 390×844:** CASE → BOTTLE preserved the 48-container
equivalence; plus advanced by 6 to 54 and displayed `2.25 cases`; product and
destination controls changed to repository values; Review showed the drafted 48
bottles, BAR 3 and warehouse-after 240; CREATE DOCKET & ISSUE reached
`/dockets/D-0184`. No console warnings or errors. The two-fixture visual gate
reports **15 reading the data layer, 0 hardcoded, 0 errored**.

**Verified:** `typecheck`, `lint`, `test` (114 tests), `build`, `test:visual`.

**Files changed:** `src/screens/issue/{IssueScreen,draft}.ts` and draft test,
`src/screens/custody/ReviewScreen.tsx`, `src/domain/units.ts` and test,
`src/data/repository.ts`, fixture/live repository and formatting files plus tests,
`src/app/router.tsx`, `src/features/screens.tsx`, `src/styles.css`,
`docs/CURRENT-STATE.md`.

**Architecture changes:** none. The read model, service call, typed route draft
and outbox path implement the existing architecture.

**Known issue:** the live create-docket path is still unexercised because there is
no `auth.users` row. Queued docket creation cannot open the Docket screen until
the server mints a number; Review states that honestly and stays put.

**Recommended next:** **BAR-082** — add and wire the count-submit RPC. The count
flow currently discards its result.

### Session — 28 August 2026 (sixth) · Claude

**BAR-047 and BAR-044 — the app can now record something.**

**BAR-047 — error boundary.** Router-level `defaultErrorComponent` and
`defaultNotFoundComponent`, so a new route cannot arrive without a boundary, plus
`AppErrorBoundary` outside the router for throws in the providers. The larger fix
was one line: `throwOnError` on `useRepositoryQuery`. Every screen renders
`data?.field ?? '—'`, so a failed live read produced a screen of em-dashes and
zeroes — **visually identical to a venue holding no stock**. A warehouse reading 0
because the network dropped and a warehouse reading 0 because it is empty must not
look the same.

**BAR-044 — the service layer.** `src/services/` did not exist, and nothing called
the docket RPCs. Screens now call services; services take the repository as an
argument and are testable without React; the repository appends to the outbox; the
outbox dispatches to the RPCs. No screen imports Supabase or Dexie, and no service
calls an RPC.

**Three defects in the outbox, found while generalising it to typed commands:**

1. **Ordering.** The drain selected every entry whose backoff had elapsed and
   posted those — so an entry in backoff was *skipped* while the entries behind it
   went ahead. An issue that failed once could be overtaken by its own acceptance,
   producing an acceptance of a docket the ledger did not contain. `OFFLINE-SYNC.md`
   rule 2 exists for exactly this and was not implemented. Now `selectDrainBatch`,
   which stops at the first blocked entry, with the failing case asserted.
2. **Auth.** An auth failure incremented `attempts` before breaking out, so eight
   queued entries and an expired JWT marked a shift's work `failed` inside two
   minutes — losing it as surely as deleting it. It now stops the drain without
   consuming an attempt.
3. **Classification.** A duplicate idempotency key is *success* — the server has
   the write, and a reply lost on the way back is common on a festival network.
   A rule violation is permanent and dead-letters at once instead of retrying
   eight times.

**A correction caught by my own tests.** The failure classifier's first version was
written from guesses about PostgreSQL wording and matched neither
`not authorised for venue` nor `docket % is already %` — two strings the RPCs
actually raise. The test that caught it was itself wrong in the same way: it
asserted against `'docket D-0184 has already been accepted'`, which no RPC raises.
Both were rewritten from the `raise exception` strings in the migrations. Guessing
at an interface I had written myself was avoidable.

**Verified in a browser, on the fixture path:** the difference panel opens with the
design's four reasons; the CTA is **disabled** at `Accept 47 · report short 1`
until a reason is chosen; choosing one runs the service and lands on
`RECEIVED SHORT` with the difference attributed to a named person. Zero console
errors on a fresh load.

**Deliberately not done.** The **issue** side is not wired. `ReviewScreen` sources
its data from `custody()` — an *existing* docket — so calling `createDocket` there
would create a second docket duplicating the one on screen. It needs a real draft
from the issue screen, which is BAR-051, and building on a shape I know is wrong is
how this project acquired its original problems.

**Still not verified against the database.** Everything above ran against fixtures.
The live command path is typechecked and unit-tested but has never posted, because
`auth.users` is still empty.

**Files changed:** `src/app/ErrorScreen.tsx`, `src/app/router.tsx`, `src/main.tsx`,
`src/domain/{outbox-policy,custody}.ts` and their tests, `src/lib/offline-db.ts`,
`src/lib/supabase.ts`, `src/services/{issue,accept,services.test}.ts`,
`src/data/{repository.ts,RepositoryProvider.tsx}`,
`src/data/fixture/{fixture-repository,design-data}.ts`,
`src/data/live/live-repository.ts`, `src/screens/custody/AcceptScreen.tsx`,
`src/styles.css`, `docs/CURRENT-STATE.md`

**Architecture changes:** none. The command methods on `Repository` and the typed
outbox implement `ARCHITECTURE.md` and `OFFLINE-SYNC.md` as written; no ADR is
affected.

**Recommended next:** **BAR-051** — rebuild the issue screen with a real draft and
the case/bottle unit switch. It is the last thing standing between the custody
chain and a complete write path, and it also removes the largest remaining block of
fixture literals (`src/features/screens.tsx`).

### Session — 28 August 2026 (ninth) · Claude — RELEASE-1 item 5

**BAR-161 / BAR-083 — blind counting enforced by the database.** These were always
one piece of work under two ids.

**A correction to this morning's own work, and the reason this took a design
change rather than a `where` clause.** BAR-082 gave `boa_bar_submit_count` the job
of creating the count session at submit time. That was simpler and worked offline —
but the security model keys the blind on an **open (`draft`) session**, so removing
the draft removed the only hook the enforcement has. Opening a count is therefore
an explicit act again: `boa_bar_open_count` creates the draft, creating the draft
is what blinds you, and submitting closes it.

**What now enforces it.** `private.boa_bar_is_blinded(venue, location)` is the
single definition — true while the CALLER holds an open draft session for that
location. It gates two things, because gating one would be theatre:

1. `boa_bar_inventory_snapshot` **omits** the location entirely. Not zeroed: a
   zero row is itself a claim about the position, and a counter shown zeroes would
   reasonably enter zeroes.
2. The `boa_bar_movement_line` read policy excludes that location's lines, so the
   same figure cannot be re-summed from the raw ledger. This is
   docs/SECURITY.md requirement 2, and without it the snapshot change would have
   been decorative.

**A trade recorded rather than hidden.** `openCount` is called directly, not
queued through the outbox: a blind that takes effect three seconds late is not a
blind. The consequence is that a count cannot be STARTED offline, though it can
still be recorded and submitted offline. If load-in testing shows the bars have no
signal, this needs revisiting — a locally-held blind would be the alternative, and
it is weaker.

**`blind_count.test.sql` is the first test here that simulates a signed-in user**,
by setting `request.jwt.claims` inside the transaction so `auth.uid()`, the
security-definer functions and the RLS policies all behave as they would for a real
caller. 6 assertions, including the one this task exists for: before opening a
count the bar lead can read their bar, and after opening it the snapshot returns
nothing for it. That is also the first RLS policy in this project proved
behaviourally (BAR-030).

**Verified:** typecheck, lint, 124 tests, build, `check:sql`, fidelity gate
unchanged at 0 hardcoded / 0 errored.

**NOT verified, and stated plainly:** `202608280007` is unapplied and
`blind_count.test.sql` has never executed. The machine this was written on has no
PostgreSQL. The likely failure point is the `auth.users` insert needing more
columns on this Supabase version — a one-line fix, and the test says so in its own
header.

**Recommended next:** apply it (`db push`), run `node scripts/db-test.mjs`, and
expect **78 assertions** across four files. Then RELEASE-1 item 6 (BAR-145, the
in-event correction path).

### Session — 28 August 2026 (eighth) · Claude — RELEASE-1 items 1 to 4

Done in the order 2 → 1 → 4 → 3. BAR-123 went first because it changes how every
movement stamps its date, so writing the count and waste RPCs before it would have
meant rework.

**BAR-123 + half of BAR-023 — the business date.** `business_date` was the IST
calendar date AND client-supplied. The night split at midnight, so a close-out
count at 01:30 recorded as 11 October and the identity could not close for the
event; and because a device supplied it, a wrong clock or an edited payload could
move a movement to another day and step around a count. Now derived server-side
from a venue cutoff (06:00 default) and the client value ignored.
`business_date.test.sql` is the **first behavioural test in this suite** — 9
assertions calling the function with real instants rather than asserting an object
exists.

**BAR-082 + BAR-084 — counts are recorded.** `boa_bar_count_line` had no write
path at all. `CountScreen` collected a blind count, reset each line and navigated
away, so **every count taken on it was discarded**. Adds `boa_bar_submit_count`
(one command per user action, so it queues and replays), a service, and a screen
that accumulates and only navigates after the write is accepted. The expected
position is sealed at submit from the LEDGER, into `private.boa_bar_count_seal`
with no grant to anybody — it is the expected figure a counter must never see. A
partial count is refused: 12 of 18 lines reports six SKUs as zero, and zero reads
as "all of it is missing".

**BAR-146 + BAR-136 — every docket is reachable.** Three defects. `barDetail`
surfaced only the first awaiting docket (`.find`) while `listBars` correctly said
"2 DOCKETS INCOMING". The bar screen's accept CTA was
`store.flash('RECEIVING SCREEN IS BAR-055')` — a placeholder left behind after
BAR-055 shipped, so with no scanner either **no path in the app reached the accept
screen at all**. And `in_transit` held real stock that no screen read. Adds
`/dockets`, which is **not in the approved design**: the design's mechanism is the
QR code, and a list is smaller and does not need a camera focusing in a dark tent.

**BAR-063 + the rest of BAR-133 — waste.** Rebuilt from
design-markup.html:612-651: the design's five reasons including `Foam / line loss`,
the full catalogue instead of `slice(0, 5)`, and a real write through
`boa_bar_record_waste`, which enforces the reason vocabulary and takes the location
from the command. The legacy path that posted every waste to `bar_3` is deleted.
`src/features/screens.tsx` is down from 302 lines to 67 and holds no SKU data.

**Also closed on the way:** BAR-130 (full catalogue everywhere), BAR-133,
BAR-081 partially (`mlFromGrossWeight` has its first non-test caller), and
`partialToMl` moved into the domain — a keg reading of 12 stored as 12 ml rather
than 12,000 would be a 1000x understatement on the largest container the venue has.

**Verified:** typecheck, lint, **124 tests**, build, `check:sql`, and the fidelity
gate at 16 routes, 15 reading the data layer, 0 hardcoded, 0 errored. Browser-
verified: the waste screen's composition and its reason gate, `/dockets` listing
two dockets with the second opening its own contents, and both incoming sheets on
the bar screen.

**NOT verified — the whole caveat.** Three new migrations
(`202608280004`, `_0005`, `_0006`) are **unapplied**, and none of
`boa_bar_submit_count`, `boa_bar_record_waste` or `boa_bar_business_date` has ever
executed. `auth.users` is still empty. Everything above is proven against fixtures
and a type checker only.

**Counts:** 49 done, 37 partial, 4 rewrite, **12 defects present** (was 15), 60
untouched.

**Recommended next:** RELEASE-1 item 0 — create the auth user, apply the
migrations with `node_modules/.bin/supabase db push`, then
`node scripts/bootstrap.mjs` and `node scripts/db-test.mjs`. That is now the only
thing between four completed items and evidence that any of them work.

### Session — 28 August 2026 (seventh) · Claude — handover

Last Claude session on this project. Development continues in Codex and Cursor.

**Three instruction surfaces contained a dead instruction.**
`.cursor/rules/30-data.mdc` told Cursor to hand migrations to Claude,
`.cursor/rules/00-truth.mdc` gave architecture, schema, sync and the ledger to
Claude, and `CLAUDE.md`'s role section allocated work to it. Following any of them
after today means the work simply stops. All three now say the approval gate is the
**user**, and that an accepted ADR remains the user's to change.

**Added `docs/RELEASE-1.md`.** Release 1 is Phases 1–2 of specification §15,
quoted rather than paraphrased, on the specification's own reasoning: "Phases 1–2
with paper counts and a manual POS reconciliation the following week still produces
a defensible audit. Nothing else does." It names roughly 40 tasks cut in the spec's
own cut order, thirteen blocking items in judgement order with acceptance criteria
each, the user-only items, and a release-ready checklist where every line is
checkable.

**One release blocker found while writing it, not previously recorded.** The
custody chain is not complete: `listBars` reports `2 DOCKETS INCOMING`, but
`barDetail` surfaces only the first (`.find`), there is no `/dockets` list route
and no QR scanner. A second docket issued to the same bar cannot be opened or
accepted, and its stock sits in `in_transit`, which no screen reads. That is stock
which has left the warehouse and can never arrive — worse than not shipping the
feature, because the ledger says it exists. Recorded as item 4 in RELEASE-1;
a plain awaiting-dockets list is the smaller fix and does not need a camera to work
in a dark tent.

**State at handover, verified:** 7 migrations applied, 63 pgTAP assertions green,
1 venue / 9 locations / 11 SKUs, 114 unit tests, typecheck, lint, build,
`check:sql`, and the fidelity gate at 16 routes, 15 reading the data layer,
**0 hardcoded, 0 errored**. Working tree clean, everything pushed.

**Still not verified, and the largest unknown in the repository:** `auth.users` is
empty, so no live read and no live write has ever executed. Fixture-mode success is
not evidence the live path works.

**Files changed:** `docs/RELEASE-1.md` (new), `AGENTS.md`,
`.cursor/rules/00-truth.mdc`, `.cursor/rules/30-data.mdc`, `CLAUDE.md`,
`docs/CURRENT-STATE.md`

**Recommended next:** `docs/RELEASE-1.md` section 4, item 0, then item 1.

### Session — 28 August 2026 (sixth) · Claude — review of Codex's BAR-051

**Codex's work is good and its documentation was honest.** It did not overclaim:
it recorded the live create path as unexercised, and its design-fact claims
(presets `[1,2,4,6]` / `[24,48,96,144]`, step +1 / +6, the minimum clamp) all check
out against `design-script.jsx:216-241`. Gates were green on arrival: typecheck,
lint, 114 tests, build, and the fidelity gate at 0 hardcoded / 0 errored.

**Three defects found by review and by driving the browser, all now fixed.**

1. **`/issue/review` invented a draft and offered to post it.** Reached without
   search params — a stale bookmark, a shared link, a back-navigation — the screen
   fell back to `defaultDestinationId`, `defaultProductId` and a computed quantity,
   rendering `48 × KINGFISHER` with the create button **enabled**. It would have
   posted a real ledger movement nobody selected. The worst of the three, because
   it is a write rather than a display. A picker may default; a confirmation step
   that writes to the ledger may not. Now shows an explicit "NO ISSUE TO REVIEW"
   state.

2. **The quantity stepper lost taps.** `changeQuantity` computed from the
   render-scoped `containers`, so two taps inside one React batch both read the
   same figure and only one applied: four rapid taps on minus moved 42 to 36
   instead of 42 to 18. Someone tapping quickly to reach six cases would have
   issued the wrong quantity, with the docket agreeing with the mistake. Now a
   functional update.

3. **`caseCountLabel` deviated from the design's formula.** It stripped the
   trailing zero, so 36 bottles read `1.5 cases` where the design's own expression
   — `(bottles / 24).toFixed(2).replace(/\.00$/, '')` — yields `1.50 cases`. A
   test had codified the deviation. Non-negotiable 5; the design's inconsistency
   (its hand-written catalogue string says `1.5`) is not licence to choose.

**One consequence worth recording.** Fixing defect 1 made the fidelity gate report
`review` as hardcoded, because the gate visited the route bare and got the
identical empty state under both fixture sets. That was the gate being right about
what it saw: the screen's entry contract had changed. The gate's route now carries
a draft whose ids exist in both fixture variants, and the count is back to 15
reading the data layer, 0 hardcoded.

**Still true after this review:** no live read and no live write has executed.
`auth.users` is empty, so the fixture path is all that has been exercised. In
fixture mode the docket screen shows the design's 48 after issuing 36, because the
fixture commands deliberately record nothing — correct, and stated in
`fixture-repository.ts`, but worth knowing before reading a demo as evidence.

**Files changed by this review:** `src/domain/units.ts`,
`src/domain/units.test.ts`, `src/screens/issue/IssueScreen.tsx`,
`src/screens/custody/ReviewScreen.tsx`, `scripts/visual-check.mjs`,
`docs/CURRENT-STATE.md`

**Recommended next:** unchanged — BAR-082 (a count-submit RPC), then BAR-161. And
the one thing no agent can do: create an `auth.users` row and run
`node scripts/bootstrap.mjs`.

### Session — 28 August 2026 (fifth) · Claude

**The first verified behaviour in this project's history.** Everything before this
was typechecked, linted and tested against fixtures; nothing had been proven
against the database.

**Verified against the live database (PostgreSQL 17.6):**

- All **seven** migrations applied, confirmed by object existence rather than by
  trusting `supabase_migrations.schema_migrations`.
- pgTAP **63 assertions, 0 failed** (`ledger` 11, `privileges` 52).
- Reference data present: **1 venue, 9 locations, 11 SKUs**.
- All three EXECUTE holes **shut**.

**Two EXECUTE holes, found because the privilege suite was run for the first
time.** It had been written on 27 August and recorded as passing without ever
being executed.

1. `public.boa_bar_submit_movement` — `anon` held EXECUTE since 27 August. Not
   exploitable, because the function's own `auth.uid() is null` guard rejects an
   anonymous caller. One accidental line from being the only defence.
2. `private.boa_bar_post_movement` — extracted that same morning so the bootstrap
   could supply an actor explicitly, which is exactly why it takes the actor as a
   **parameter**. `create function` grants EXECUTE to PUBLIC by default, and
   `authenticated` has held USAGE on schema `private` since BAR-012 so RLS
   policies can resolve `boa_bar_has_role`. So for several hours **any signed-in
   user could post any movement, to any location, attributed to anyone**,
   bypassing both the role gate and the two-party docket rules.

**A correction that matters more than the holes.** I recorded hole 2 as not
exploitable "because 202608280002 has not been applied". It **had** been applied.
I asserted the deployment state instead of checking it — on this project, of all
projects — and the assertion was wrong in the direction that made a live hole look
harmless. `pnpm db:state` now exists precisely so that deployment state is read
rather than assumed, and it probes both holes directly instead of inferring them
from the migration text.

**The lesson, as a rule already in CLAUDE.md and broken anyway:** never write that
a verification was performed when it was not, and never reason about a live system
from the contents of the repository. The repository says what *should* be true.

**Also fixed:** the omission was mechanical — a missing revoke — so
`privileges.test.sql` now enumerates every function for both roles, and
`alter default privileges` revokes EXECUTE from `public` for functions created from
here on. A future function that forgets its revoke fails the suite.

**Two of my own operational errors this session:** I handed over a bare `pnpm`
command on a machine where `pnpm` is not on the PATH — a fact recorded once, in a
27 August session entry, and nowhere near the quality-gates block anyone reads. It
is now in CLAUDE.md with an explicit instruction. And `scripts/bootstrap.mjs`
reimplemented `db-test.mjs`'s connection logic and got it wrong, which would have
connected with no password; both now share `scripts/lib/db-url.mjs`. Duplication
produced a defect twice in one day.

**What is still blocked:** `auth.users` is empty, so `pnpm bootstrap` has nobody to
make admin. It refuses and changes nothing — verified by running it. Creating the
first user needs no email: Supabase dashboard -> Authentication -> Users ->
Add user, Auto Confirm ticked.

**Not yet verified:** no movement has ever been posted, so the ledger, the balance
projection, `boa_bar_open_stock` and every live repository read remain unexercised.
The privilege posture is proven; the behaviour is not.

**Files changed:** `supabase/migrations/202608280003_revoke_function_execute.sql`,
`supabase/tests/privileges.test.sql`, `scripts/db-state.mjs`, `package.json`,
`CLAUDE.md`, `docs/CURRENT-STATE.md`

**Architecture changes:** none.

**Recommended next:** create the first auth user, run `node scripts/bootstrap.mjs`,
and confirm the warehouse reads 638 containers across 10 SKUs with the ledger and
the projection in agreement. That single run exercises the ledger, the projection
and the derived-idempotency-key path for the first time.

### Session — 28 August 2026 (fourth) · Claude

**Completed: BAR-156 — the system can now be started.** Written, not yet run.

**The finding that mattered most.** `supabase/seed.sql` is applied by
`supabase db reset` against a **local** database only — never by `db push`. So the
hosted project has had no venue, no location and no SKU since the schema was
applied on 27 August. That is the whole reason nothing has ever been verified
against real data, and it was invisible because the file exists, is correct, and
is in the repository. Reference data now lives in the bootstrap migration so local
and hosted come from one source, and `seed.sql` is reduced to a pointer.

**Three defects in the previously seeded values**, all surfaced by reading them
against the live repository's formatting rules rather than by inspection:

1. `container_type` was `'650 ml bottle'`. The column is the container *type*; the
   size is already `ml_per_container`. Conflated, the unit rendered as
   `650 ML BOTTLES` and the spec line as `Beer · 650 ml 650 ml bottle`.
2. Kingfisher's `units_per_case` was 12. The design shows 288 bottles as
   `12 cases` and its own docket states 24, so an issue would have printed
   `24 cases`.
3. Five SKUs the design's catalogue shows were missing (Bira, Signature Rare,
   Smirnoff, Tonic Water, Soda).

**One movement poster, three entry points.** `boa_bar_submit_movement` took its
actor from `auth.uid()` and did validation, the ledger insert and the balance
upsert in one body. Opening stock needs the same writes but has to run from a
direct database session during bootstrap, when `auth.uid()` is null and no user
exists yet. Copying those twenty lines would have put two writers on
`private.boa_bar_balance` — the drift non-negotiable 2 exists to prevent — so the
body moved to `private.boa_bar_post_movement(payload, actor)`.
`boa_bar_submit_movement` keeps its signature and behaviour exactly.

**Opening stock is a receipt movement, not a starting quantity.** Stock is derived
by summing the ledger, so a position that did not enter through the ledger would
be invisible to every calculation and to the excise return. The idempotency key is
derived from venue + location + business date, so the second run an operator makes
at 06:00 when unsure the first worked is a replay, not a doubled warehouse.

**`boa_bar_claim_venue`** breaks the membership circle exactly once: it grants the
caller `admin` only while the venue has no active membership, under an advisory
lock. The residual risk — whoever signs in first during that window becomes admin —
is stated in the migration, and `pnpm bootstrap` prints whether the window is
closed.

**The seed is a verification artefact.** Opening quantities are the design's own
warehouse catalogue, so after bootstrap the live warehouse screen must show
BEER 380, SPIRITS 142, MIXERS 116, total 638 — matching
`references/ui/warehouse.png`. If it shows anything else the live repository is
wrong in a way somebody can see. Seven tests assert the seed still agrees with the
design, sharing one JSON list with the script, and were confirmed to fail when a
quantity is altered.

**A bug I introduced and caught.** `scripts/bootstrap.mjs` reimplemented
`db-test.mjs`'s connection-string logic and got it wrong: `supabase link` writes
`postgresql://user@host` with **no** password segment, and the copy assumed a
`[YOUR-PASSWORD]` placeholder was there, so it would have connected with no
password. Both scripts now share `scripts/lib/db-url.mjs`. This is the second time
today duplication produced a defect.

**New gate: `pnpm check:sql`.** A static arity check over every migration —
VALUES-tuple length against the column list, balanced `$$`, one begin/commit pair
per file. It exists because this machine has neither Docker nor psql, so
`db push` will be the first thing that ever parses these files. Confirmed to catch
a planted column-count error. It does **not** validate SQL and must not be read as
doing so.

**Verified:** `typecheck`, `lint`, `test` (62 tests, 7 new), `build`,
`check:sql`. Both scripts' credential-failure paths exercised by hand.

**NOT verified, and this is the whole caveat:** the two new migrations have never
been applied and the three new functions have never executed. Nothing here has
touched a database.

**Files changed:** `supabase/migrations/202608280002_bootstrap.sql`,
`supabase/seed.sql`, `supabase/bootstrap/opening-warehouse.json`,
`scripts/bootstrap.mjs`, `scripts/lib/db-url.mjs`, `scripts/db-test.mjs`,
`scripts/sql-arity-check.py`,
`src/data/bootstrap/opening-warehouse.test.ts`, `package.json`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none, but note one structural change inside the
database: `private.boa_bar_post_movement` is now the sole writer of the ledger and
its projection. That is consistent with ADR-013 rather than a change to it.

**Recommended next:** the three commands under "Blockers needing a human" — they
are now the only thing standing between this repository and its first verified
behaviour.

### Session — 28 August 2026 (third) · Claude

**Completed: the three fixes from the reconciliation.**

- **BAR-087 — signed variance banding.** `varianceBand` now bands on magnitude and
  then floors a positive variance at amber; it can still reach red. The reasoning
  is in the function's comment: a negative variance is expected shrinkage and the
  tolerance table exists to size it, while a positive variance means a missed
  receipt, a wrong-SKU ring-up or a bad count — the first two being the shapes a
  concealed loss takes. Six new assertions cover the sign asymmetry, the red
  ceiling, exact zero and the null case.

  **Correction to what the previous session's entry and event-stopper 18 claimed.**
  They said `+2.4%` on bottled beer graded green. That was wrong: bottled beer's
  green edge is 1%, not 3%, so `+2.4%` already banded amber and did reproduce the
  design. The defect was real but smaller — `+0.5%` bottled beer, `+1.2%` spirits
  and `+4%` draught all graded green. Row 18 now states this correctly.

- **BAR-133 — the three screen literals.** `BarsScreen` opens any bar; the
  `bar.id === 'bar-3'` gate is gone, and `BarScreen` already renders an empty state
  for an unknown id, which is the right place for that case. `CountSession` gained
  `locationId` and `Custody` gained `toLocationId`, populated by both repositories
  and **shifted in the gate's second fixture variant** so a screen ignoring them is
  still detectable. Removing the toast also left `BarsScreen` with no use for
  `demo-store`, so that import is gone — one screen fewer on the legacy path.

  **BAR-133 is not closed.** `demo-store.tsx:353` still posts every waste to
  `bar_3`. It is marked `[~]` and goes with BAR-164.

- **BAR-154 — the literal-ban lint rule.** `no-restricted-syntax` over
  `src/screens/**` and `src/components/**`, banning location ids and names, docket
  numbers and catalogue SKU names. Deliberately narrow rather than a general ban on
  literals: an unusable rule gets disabled, and a disabled rule catches nothing.

  **Verified by planting a probe file** with six violations and two legitimate
  strings: all six errored, both legitimate strings passed, probe removed. A rule
  nobody has watched fire is not a gate — which is the same objection this file
  records against BAR-006.

**Verified:** `typecheck`, `lint`, `test` (55 tests, 5 new), `build` all pass.
`test:visual` unchanged — 16 routes, 15 reading the data layer, **0 hardcoded,
0 errored**.

**Not verified:** still nothing against a real database. The banding fix and the
location-id plumbing are exercised by tests and by the fixture gate only.

**Files changed:** `src/domain/inventory.ts`, `src/domain/inventory.test.ts`,
`src/data/repository.ts`, `src/data/fixture/design-data.ts`,
`src/data/live/live-repository.ts`, `src/screens/bars/BarsScreen.tsx`,
`src/screens/count/CountDoneScreen.tsx`,
`src/screens/custody/ReceivedScreen.tsx`, `eslint.config.js`,
`docs/CURRENT-STATE.md`

**Architecture changes:** none. Two read-model fields added, no ADR affected.

**Recommended next:** BAR-156 — seed the database. Everything else is unprovable
until it exists.

### Session — 28 August 2026 (later) · Claude

**Completed: reconciled the milestone table against the code.**

The previous table was written during the 27 August audit and had drifted in both
directions — it still listed BAR-042 as "None", the blind count as inverted and
the custody screens as absent, all built since, while marking things done that a
grep shows are not. All 164 tasks now carry a state and the evidence that decided
it. Counts are computed from the rows, not asserted: 36 `[x]`, 31 `[~]`, 8 `[R]`,
20 `[!]`, 67 `[ ]`, 2 `[?]`.

Also collapsed the two conflicting status keys into one. `[!]` meant "blocked" at
the top of this file and "defect present in code" in the table — two versions of
the truth about the notation used to record the truth.

**Two defects found by the reconciliation, both now event-stoppers 18 and 19:**

1. **BAR-087 — positive variance grades green.** `domain/inventory.ts:207` bands
   on `Math.abs(percentage)`, so `+2.4%` on bottled beer (tolerance 1–3%) reads as
   within tolerance. The design shows that exact row as gold. It was named in
   commit `36ffc4f` and never actually done, and the fixture data hardcodes the
   gold tone — so the screen looks correct and only the live repository, which
   calls the function, is wrong. **This is a defect in the live repository
   delivered earlier today.**
2. **BAR-133 — three literal `'bar-3'` ids in screens rebuilt this week**
   (`BarsScreen.tsx:64`, `CountDoneScreen.tsx:83`, `ReceivedScreen.tsx:77`).
   Under live data every id is a UUID, so the bars list opens nothing. The
   two-fixture-state gate does not catch this because both fixture variants keep
   the id `bar-3`; BAR-154's lint rule would have.

Both are recorded rather than fixed, per the working rule on defects found
outside the current task. Both are one-line fixes and are items 1 and 2 of the
recommended next actions.

**Corrections to the previous session's claims:** BAR-046 was reported as
partially wired; `mlFromGrossWeight` still has zero callers, so the tare weight
is displayed on the count screen but never applied — BAR-081 is `[~]`, not done.

**Files changed:** `docs/CURRENT-STATE.md` only. No code changed.

**Architecture changes:** none.

**Recommended next:** BAR-087, BAR-133 and BAR-154 — the three cheap fixes —
then BAR-156.

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

### Session — 31 August 2026 · codex

Completed: BAR-143 — restricted invitation creation to the two designated BOA operators (Vipin Menon and Salman) through a server-side auth allowlist; Team hides invite controls for other accounts. Verified with typecheck, lint, unit tests (143 passed), and SQL arity checks.
Files changed: `supabase/migrations/202608310011_invite_admin_allowlist.sql`, `src/data/repository.ts`, `src/data/live/live-repository.ts`, `src/data/fixture/design-data.ts`, `src/screens/team/TeamScreen.tsx`
Architecture changes: none
Known issues: The new migration has not been pushed to or behavior-tested against the hosted database; live auth identities must use the supplied email addresses.
Recommended next: Apply the migration, then continue the remaining Release 1 implementation work.

### Session — 31 August 2026 · codex

Completed: BAR-137 — added a 60-second OTP resend cooldown and clear local membership/draft caches on shared-device sign-out. Verified with typecheck, lint, and 143 unit tests.
Files changed: `src/features/AuthGate.tsx`, `src/lib/auth.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Live shared-device behavior and Gmail delivery remain unverified; hosted database tests are parked.
Recommended next: Continue Release 1 implementation or perform the live OTP test.

### Session — 31 August 2026 · codex

Completed: BAR-164 — moved the Release 1 reports placeholder out of the retired legacy screen module and removed `src/features/screens.tsx`; `/reports` remains an honest unavailable state until reporting is in scope.
Files changed: `src/screens/reports/ReportsScreen.tsx`, `src/app/router.tsx`, removed `src/features/screens.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Reports remains intentionally unavailable; hosted verification and visual checks are parked.
Recommended next: Continue with the next Release 1 implementation item.

### Session — 31 August 2026 · codex

Completed: BAR-153 — added `references/design-source/CHECKSUMS.txt` with SHA-256 hashes for every recovered design-source file. Verified with `shasum -a 256 -c` and `git diff --check`.
Files changed: `references/design-source/CHECKSUMS.txt`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Hosted/device verification remains parked.
Recommended next: BAR-009 or the next Release 1 implementation item.

### Session — 31 August 2026 · codex

Completed: BAR-009 — included `src/sw.ts` in TypeScript and ESLint coverage by removing the ignore/exclude entries. Verified with typecheck, lint, 143 unit tests, and production build.
Files changed: `eslint.config.js`, `tsconfig.app.json`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Hosted/device verification remains parked.
Recommended next: BAR-010 (repository quality gates) or the next Release 1 implementation item.

### Session — 31 August 2026 · codex

Completed: BAR-010 — added EditorConfig formatting conventions, ESLint-backed format scripts, an installable pre-commit hook, CODEOWNERS, and a pull-request template. Verified with format check, typecheck, lint, and 143 unit tests.
Files changed: `.editorconfig`, `.githooks/pre-commit`, `scripts/install-hooks.mjs`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `package.json`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The hook is available but each contributor must run `corepack pnpm hooks:install`; hosted/device verification remains parked.
Recommended next: BAR-033 (generated database types) or the next Release 1 implementation item.

### Session — 31 August 2026 · codex

Completed: BAR-033 — verified the generated Supabase schema types at `src/types/database.ts` and typed the Supabase client; retained explicit repository row narrowing at the data boundary. Verified with typecheck, lint, 143 unit tests, and production build.
Files changed: `src/types/database.ts`, `src/lib/supabase.ts`, `src/data/live/rows.ts`, `src/data/live/live-repository.ts`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Generated types reflect the linked database schema at generation time; hosted schema drift still requires regeneration after future migrations.
Recommended next: BAR-141 (attribute queued movements to the original actor) or the next Release 1 implementation item.

### Session — 31 August 2026 · codex

Completed: BAR-143 — changed live sign-in from magic-link redirect to Supabase email OTP verification, ready for the selected Resend SMTP provider. Verified with typecheck, lint, unit tests (143 passed), and production build.
Files changed: `src/lib/auth.tsx`, `src/features/AuthGate.tsx`
Architecture changes: none
Known issues: Resend SMTP/domain configuration and live OTP delivery have not been verified; Supabase project email templates must include the OTP token.
Recommended next: Configure Resend SMTP and test one complete OTP sign-in with a live account.

### Session — 31 August 2026 · codex

Completed: BAR-141 (partial) — queued command payloads now preserve the creating user's `actor_id`; the generic movement RPC validates that both the replaying user and original actor remain active venue members before attribution. Dedicated docket, count, waste, and receipt RPCs still need equivalent server-side actor plumbing.
Files changed: `src/data/live/live-repository.ts`, `supabase/migrations/202608310012_original_actor.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The migration has not been pushed or behavior-tested against the hosted database. Dedicated command RPCs still use `auth.uid()` for their direct actor columns and movement calls. Live queued replay remains unverified.
Recommended next: Extend BAR-141's actor validation to the dedicated command RPCs, then push and run the hosted database behavior test.

### Session — 31 August 2026 · codex

Completed: BAR-141 server wiring — added transaction-local actor wrappers for docket creation/acceptance, count submission, waste, and receipt commands. Existing command implementations remain unchanged behind renamed internal functions; the wrappers validate the original actor and replaying user before dispatch.
Files changed: `supabase/migrations/202608310013_queued_actor_commands.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Migrations 012–013 have not been pushed or behavior-tested against the hosted database. The transaction-local `request.jwt.claim.sub` technique must be confirmed against Supabase's `auth.uid()` implementation before calling this live-verified.
Recommended next: Push migrations 012–013 from the user's authenticated shell and run a two-account offline queue replay test.

### Session — 31 August 2026 · codex

Completed: Auth OTP input fix — accepted the 8-digit verification codes produced by the configured Supabase email template; the field, copy, placeholder, and submit guard now agree.
Files changed: `src/features/AuthGate.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Live email delivery and OTP verification remain unverified.
Recommended next: Retry sign-in with the latest 8-digit code.

### Session — 31 August 2026 · codex

Completed: Exposed the existing Team management route from More as a manager-only TEAM option, so authorized operators can reach staff invitations without typing `/team` manually.
Files changed: `src/screens/more/MoreScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Browser refresh/visual confirmation remains pending; the route itself already existed and local checks pass.
Recommended next: Refresh More and open TEAM to manage invitations.

### Session — 31 August 2026 · codex

Completed: Updated the home navigation/header treatment with the supplied BOA poster as a restrained background, removed the BOA 2026 subtitle, removed COWORK from More, and kept BAR CONTROL vertically centered with the logo.
Files changed: `src/app/AppShell.tsx`, `src/screens/more/MoreScreen.tsx`, `src/styles.css`, `public/assets/boa-poster.jpg`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Authenticated browser visual verification was unavailable after the local refresh returned to Staff sign in; typecheck, lint, and unit tests passed.
Recommended next: Sign in again and inspect the home header and More list at the target mobile viewport.

### Session — 31 August 2026 · codex

Completed: Refined the home navigation header per feedback: increased its height and logo/title scale, removed the top-right shortcut, and reduced the poster texture opacity so it remains subtle.
Files changed: `src/app/AppShell.tsx`, `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Authenticated visual confirmation remains pending because the browser session returned to Staff sign in during refresh; local build, typecheck, lint, and tests pass.
Recommended next: Refresh after signing in and review the enlarged header at the target viewport.

### Session — 31 August 2026 · codex

Completed: Increased the global bottom navigation height on every page, including its safe-area padding, while preserving the five-column layout and existing tap targets.
Files changed: `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Authenticated browser visual confirmation remains pending; local typecheck, lint, tests, and diff checks pass.
Recommended next: Refresh any route and review the taller bottom navigation.

### Session — 31 August 2026 · codex

Completed: Corrected the navigation sizing target: restored the bottom navigation to its prior dimensions and increased the shared top title bar (`section-head`) height across section screens.
Files changed: `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Authenticated browser visual confirmation remains pending; local typecheck, lint, tests, and diff checks pass.
Recommended next: Refresh More, Activity, or Warehouse to review the taller top title bar.

### Session — 1 September 2026 · codex

Completed: Increased the top title/header area consistently on section screens, including the warehouse and activity-specific headers that do not use `.section-head`; the bottom navigation remains at its original height.
Files changed: `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Authenticated browser visual confirmation remains pending; local typecheck, lint, tests, and diff checks pass.
Recommended next: Refresh Warehouse and verify the taller title area against the supplied screenshot.

### Session — 1 September 2026 · codex

Completed: BAR-081 — spirit partials now accept a gross scale reading, derive millilitres from the SKU tare through the existing domain/service boundary, retain `gross_weight_g` as evidence, and reject readings below tare rather than silently clamping them to zero. Verified in the fixture-backed browser at 390×844: 530 g against a 480 g tare produced 50 ml; 300 g displayed an error and disabled Save; 1,030 g produced 550 ml and re-enabled Save. Typecheck, lint, 146 unit tests, and production build pass.
Files changed: `src/data/repository.ts`, `src/data/live/live-repository.ts`, `src/data/fixture/design-data.ts`, `src/domain/inventory.ts`, `src/domain/inventory.test.ts`, `src/services/services.test.ts`, `src/screens/count/CountScreen.tsx`, `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: `test:visual` still reports the pre-existing fixture-harness failure (14 screens identical between fixture variants, including every data-backed route), so no green visual-gate claim is made. The live database write was not exercised; BAR-081 changes the already-existing count payload fields and requires no schema change.
Recommended next: complete the live two-account docket acceptance under BAR-053.

### Session — 1 September 2026 · codex

Completed: Added a manual-assisted Playwright runner covering receipt, issue/docket creation, waste, blind count, and independent docket acceptance. It supports two saved storage states, mobile viewport checks, explicit write confirmation, and checkpoints before each live write; credentials and OTPs are never automated.
Files changed: `scripts/live-write-check.mjs`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The runner has not been executed against live writes because the independent receiver account is not currently signed in. Local syntax, typecheck, lint, unit tests (146), and production build pass.
Recommended next: sign in the independent receiver account, then run the harness with `LIVE_WRITE_CONFIRM=I_UNDERSTAND_LIVE_WRITES`.

### Session — 1 September 2026 · codex

Completed: BAR-092 follow-through — made the paper fallback's print contract explicit for A4 output, with zero printer margins, 210×297 mm sheets, one sheet per page, and table-row break protection.
Files changed: `src/styles.css`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: A real browser print preview/printer output was not available in this environment, so physical pagination remains unverified. Typecheck, lint, 146 unit tests, and production build pass.
Recommended next: verify `/print` in a browser's A4 print preview, then continue with staff onboarding under BAR-143/BAR-144/BAR-137.

### Session — 1 September 2026 · codex

Completed: BAR-074 follow-through — auth-shaped outbox failures now expose a direct “Sign in again to retry” action in the Sync State card. The queued command remains retained; re-authentication does not resolve or delete it.
Files changed: `src/screens/more/MoreScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The recovery path was statically verified only; an expired live JWT and subsequent replay were not exercised. Typecheck, lint, and 146 unit tests pass.
Recommended next: verify re-authentication and queue replay with an expired session, then continue BAR-143 load-in onboarding.

### Session — 1 September 2026 · codex

Completed: BAR-064 foundation — added the durable top-up request table and command RPC with SKU, quantity, urgency, note, request status, actor, and idempotency; wired the typed outbox command and live/fixture repository write methods; added a bar-side request form.
Files changed: `supabase/migrations/202609010001_top_up_requests.sql`, `src/data/repository.ts`, `src/lib/supabase.ts`, `src/lib/offline-db.ts`, `src/data/live/live-repository.ts`, `src/data/fixture/fixture-repository.ts`, `src/screens/bar/BarScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Warehouse-side request listing/status transitions are not yet implemented, and the migration has not been applied or behavior-tested against the hosted database. Local typecheck, lint, SQL checks, and 146 unit tests pass.
Recommended next: add the warehouse request queue and fulfil/cancel transitions for BAR-064.

### Session — 1 September 2026 · codex

Completed: BAR-064 lifecycle foundation — added the warehouse-authorized `boa_bar_update_top_up` RPC with requested → issued → fulfilled/cancelled transition guards and actor/timestamp capture.
Files changed: `supabase/migrations/202609010001_top_up_requests.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Warehouse request listing, UI transition controls, and the required issue-docket linkage are still open. The migration has not been applied or behavior-tested against the hosted database. SQL static checks and typecheck pass.
Recommended next: expose pending top-up requests to warehouse staff and link fulfilment to docket creation.

### Session — 1 September 2026 · codex

Completed: BAR-064 queue read slice — added a warehouse-authorized list RPC, live/fixture repository read models, and a warehouse screen section showing pending top-up requests with location, product, quantity, urgency, note, and status.
Files changed: `supabase/migrations/202609010001_top_up_requests.sql`, `src/data/repository.ts`, `src/data/live/live-repository.ts`, `src/data/fixture/fixture-repository.ts`, `src/screens/warehouse/WarehouseScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Fulfil/cancel controls and automatic docket creation from an issued request are still open. The migration has not been applied or behavior-tested against the hosted database. Typecheck, lint, and SQL static checks pass.
Recommended next: add warehouse fulfil/cancel controls and connect fulfilment to the existing issue/docket flow.

### Session — 1 September 2026 · codex

Completed: BAR-064 controls slice — warehouse requests now have queued status updates, a cancel action, and an Issue action that opens the existing issue/docket flow prefilled with the requested SKU, destination, and quantity.
Files changed: `src/data/repository.ts`, `src/lib/supabase.ts`, `src/lib/offline-db.ts`, `src/data/live/live-repository.ts`, `src/data/fixture/fixture-repository.ts`, `src/screens/warehouse/WarehouseScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The request is marked issued manually before docket creation; automatic fulfilment after docket acceptance is still open. The migration remains unapplied and unverified against the hosted database. Typecheck, lint, and SQL static checks pass.
Recommended next: connect accepted docket results to top-up fulfilment, then run the hosted BAR-064 behavior test.

### Session — 1 September 2026 · codex

Completed: BAR-064 end-to-end — applied the top-up request schema and lifecycle RPCs to the hosted Supabase project, linked warehouse issue/docket creation to requests, auto-fulfilled requests after full docket acceptance, and wired stable idempotency through the bar and warehouse client flows. The hosted rollback behavior test passed all 21 assertions: authorized create, persisted SKU/location/quantity/urgency/note, safe duplicate replay, conflicting-key rejection, unauthorized rejection, warehouse listing, valid and invalid transitions, linked issue, non-negative stock guard, and automatic fulfilment.
Files changed: `supabase/migrations/202609010001_top_up_requests.sql`, `supabase/migrations/202609010002_non_negative_upsert.sql`, `supabase/migrations/202609010003_accept_status_cast.sql`, `supabase/tests/top_up.test.sql`, `src/data/repository.ts`, `src/data/live/live-repository.ts`, `src/services/top-up.ts`, `src/services/top-up.test.ts`, `src/services/issue.ts`, `src/services/services.test.ts`, `src/screens/bar/BarScreen.tsx`, `src/screens/warehouse/WarehouseScreen.tsx`, `src/screens/issue/IssueScreen.tsx`, `src/screens/custody/ReviewScreen.tsx`, `src/screens/issue/draft.ts`, `src/app/issue-draft.test.ts`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Supabase MCP recorded the applied migrations under generated versions `20260901055116` (`top_up_requests`), `20260901055631` (`non_negative_upsert`), and `20260901055809` (`accept_status_cast`); local filenames remain the source files. The MCP usage limit blocked further live inspection after the passing test. `corepack pnpm test:db` was not run because it requires the unavailable database password. The hosted advisory still reports RLS disabled on `private.boa_bar_balance`, `private.boa_bar_count_seal`, `public.boa_bar_tolerance_band`, and `public.boa_bar_excise_category`; no unrelated remediation was applied. Generated database TypeScript types were not regenerated.
Verified: `corepack pnpm check:sql`, typecheck, lint, 150 unit tests, and production build pass.
Recommended next: regenerate database types when the hosted schema snapshot is available, then continue BAR-143 onboarding.

### Session — 1 September 2026 · codex

Completed: UX dead-end cleanup — routed Warehouse “Receive stock” to `/receipt`, routed More “Variance” to `/variance`, routed unknown home receiving alerts to `/dockets`, and removed false detail affordances from warehouse SKU, bar inventory, and activity rows whose v1 detail routes are intentionally cut. More “Control” now states `NOT IN V1` and has no action for managers; permission, sync, error, and durable-write confirmation feedback remain intact.
Files changed: `src/screens/warehouse/WarehouseScreen.tsx`, `src/screens/more/MoreScreen.tsx`, `src/screens/home/HomeScreen.tsx`, `src/screens/activity/ActivityScreen.tsx`, `src/screens/bar/BarScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Reports, movement detail, SKU ledger, and Control remain deliberately outside v1; their routes/screens were not invented in this cleanup. `corepack pnpm test:db` was not run because the database password is unavailable; no database behavior changed. The Product Design audit screenshot was captured at `.visual-diff/ux-audit-more.png` and inspected; the visual gate still reports 15 data-backed screens, 1 legitimately static screen, 0 hardcoded, 0 errored, and 6 deliberately missing/cut screens.
Verified: `corepack pnpm typecheck`, `corepack pnpm lint`, 151 unit tests, `corepack pnpm build`, `corepack pnpm check:sql`, and `corepack pnpm test:visual` pass.
Recommended next: user-owned live/device/print checks and the remaining v1 release checklist.

### Session — 1 September 2026 · codex

Completed: BAR-074 and BAR-076 — the outbox now surfaces an authentication-stopped state and More/AppShell direct staff to sign in again while retaining queued commands; the service worker caches only same-origin navigation/static assets plus Supabase SKU/location reference reads, excludes snapshots/RPCs/writes, and removes legacy broad data caches on activation.
Files changed: `src/domain/outbox-policy.ts`, `src/domain/outbox-policy.test.ts`, `src/lib/offline-db.ts`, `src/lib/app-store.tsx`, `src/screens/more/MoreScreen.tsx`, `src/app/AppShell.tsx`, `src/sw.ts`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The browser/device offline cold-start, service-worker activation, and cache behavior require real-device verification. The two-account docket acceptance and physical A4 print checks remain unverified. `corepack pnpm test:db` was not run because the database password is unavailable; no hosted database mutation was needed for these tasks.
Verified: `corepack pnpm typecheck`, `corepack pnpm lint`, 151 unit tests, `corepack pnpm build`, and `corepack pnpm check:sql` pass. Focused auth-stop tests pass.
Recommended next: perform the user-owned second-account acceptance and A4 print checks, then reconcile the stale task-status table against the session evidence.

### Session — 1 September 2026 · codex

Completed: BAR-076 — narrowed service-worker runtime caching to Supabase SKU/location reference reads only; snapshots, memberships, people, dockets, counts, ledger reads, RPCs, and writes remain network-only, and legacy broad data caches are removed on activation.
Files changed: `src/sw.ts`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Service-worker activation and cache behavior still require real-device verification. `corepack pnpm test:db` and `test:visual` were not run; no database mutation was needed for this task.
Verified: `corepack pnpm typecheck`, `corepack pnpm lint`, 151 unit tests, `corepack pnpm build`, and `corepack pnpm check:sql` pass.
Recommended next: complete the user-owned two-account docket acceptance and physical A4 print checks.

### Session — 1 September 2026 · codex

Completed: BAR-008 verification support — development-only fixture captures now bypass the live-auth gate when the explicit `?fixture=` query is present, allowing the visual harness to exercise both fixture repositories without weakening production authentication.
Files changed: `src/features/AuthGate.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: The visual gate reports 15 data-backed screens, 1 legitimately static screen, 0 hardcoded, 0 errored, and 6 deliberately missing/cut screens; those missing screens remain outside V1. Real-device offline/service-worker, two-account acceptance, and physical A4 output remain unverified.
Verified: `corepack pnpm test:visual` passes with 15 data-backed / 0 hardcoded / 0 errored; `corepack pnpm typecheck`, `corepack pnpm lint`, 151 unit tests, `corepack pnpm build`, and `corepack pnpm check:sql` pass.
Recommended next: user-owned live/device/print checks, then freeze the V1 build.

### Session — 1 September 2026 · codex

Completed: BAR-033 and BAR-138 — aligned `src/types/database.ts` with the hosted top-up request table, enum, relationships, and RPC signatures; removed the two remaining top-up RPC `as never` casts; added repository CSP/HSTS headers and exposed `VITE_RELEASE` with a `dev` fallback in More.
Files changed: `src/types/database.ts`, `src/lib/supabase.ts`, `vercel.json`, `src/screens/more/MoreScreen.tsx`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: BAR-033 was aligned against hosted information-schema evidence through Supabase MCP but not regenerated by the Supabase CLI because local Docker/Podman and a linked access token were unavailable. BAR-138 deployment headers, production `VITE_RELEASE`, HTTPS/custom-domain enforcement, and provider-console session settings remain unverified. `corepack pnpm test:db` was not run because it requires the unavailable database password; `test:visual` was not run because no dev server was started. BAR-010 remains open because Prettier is neither installed nor cached. BAR-006 was not changed because database and visual CI prerequisites remain incomplete.
Verified: Supabase MCP confirmed the hosted top-up table columns and four top-up RPC signatures. `corepack pnpm typecheck`, lint, 150 unit tests, build, and `check:sql` pass.
Recommended next: complete BAR-010 with an approved/cached Prettier dependency, then address the remaining live two-account docket/receipt checks and human release prerequisites.

### Session — 1 September 2026 · codex

Completed: BAR-068, BAR-131, and BAR-030 — parallelized three isolated tasks. Auth now restores user-scoped cached memberships for a still-valid JWT during an offline or failed-network cold start while refusing explicit auth failures; the fabricated AppShell status-bar reference is removed; and ledger tests now prove append-only headers/lines plus position derivation from ledger sums.
Files changed: `src/lib/auth.tsx`, `src/app/AppShell.tsx`, `supabase/tests/ledger.test.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Real browser/device offline cold-start behavior remains unverified. The new ledger test was executed through Supabase MCP in a rollback transaction and passed its final `ok 11` assertion; the password-dependent `corepack pnpm test:db` wrapper was not run. `test:visual` was not run because no dev server was started.
Verified: Separate commits `27b9925` (BAR-131), `4683bf9` (BAR-068), and `dd0b40a` (BAR-030). `corepack pnpm typecheck`, lint, 150 unit tests, build, and `check:sql` pass. Hosted Supabase MCP execution completed the BAR-030 transaction without error.
Recommended next: review the remaining SECURITY DEFINER privilege advisories, then complete the live two-account docket acceptance and receipt write-path checks.

### Session — 1 September 2026 · codex

Completed: BAR-013 security follow-through — enabled RLS on the four tables previously flagged as RLS-disabled and added explicit deny-by-default policies without granting client table access. Hosted Supabase security inspection now reports zero `rls_disabled` and zero `rls_enabled_no_policy` lints.
Files changed: `supabase/migrations/202609010005_enable_internal_rls.sql`, `supabase/migrations/202609010006_internal_deny_policies.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Supabase still reports unrelated SECURITY DEFINER/search-path and Auth configuration advisories; those were not changed in this scoped RLS fix. `corepack pnpm test:db` was not run because it requires the database password. `test:visual` was not run because this is a database-only change.
Verified: Both migrations applied through Supabase MCP. A hosted rollback probe confirmed the authenticated tolerance RPC still returns four rows and direct authenticated reads of the private count seal remain denied. `corepack pnpm typecheck`, lint, 150 unit tests, build, and `check:sql` pass.
Recommended next: address the remaining security advisories by scoped task, beginning with function search paths and privilege review.

### Session — 1 September 2026 · codex

Completed: BAR-013 security follow-through — pinned `search_path = public, private, pg_temp` on all seven private trigger/guard functions reported by the hosted security advisor.
Files changed: `supabase/migrations/202609010007_harden_private_function_paths.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: Supabase still reports intentional SECURITY DEFINER API-function and Auth configuration advisories; those remain outside this scoped search-path fix. `corepack pnpm test:db` was not run because it requires the database password. `test:visual` was not run because this is a database-only change.
Verified: Migration applied through Supabase MCP; hosted security inspection reports zero mutable-search-path lints and zero RLS-disabled/no-policy lints. `corepack pnpm typecheck`, lint, 150 unit tests, build, and `check:sql` pass.
Recommended next: review the remaining SECURITY DEFINER privilege advisories and separate intentional authenticated RPCs from accidental public execution.

### Session — 1 September 2026 · codex

Completed: BAR-082 + BAR-084 — preserved the existing count-submit flow and corrected the queued-actor wrapper's privilege regression so `boa_bar_submit_count(jsonb)` is executable only by `authenticated`, while observed count lines and the private theoretical-position seal remain append-only.
Files changed: `supabase/migrations/202609010004_count_submit_grant.sql`, `docs/CURRENT-STATE.md`
Architecture changes: none
Known issues: `corepack pnpm test:db` was not run because it requires the database password; hosted Supabase MCP rollback probes passed for blind opening, location hiding, persisted submission, idempotent replay, sealed ledger position, and count/seal immutability. `test:visual` was not run because this is a database/service change and the dev server was not started.
Verified: hosted privilege check reports `PUBLIC=false`, `anon=false`, `authenticated=true`; `corepack pnpm typecheck`, lint, 150 unit tests, build, and `check:sql` pass.
Recommended next: regenerate database types when the hosted schema snapshot is available, then continue BAR-143 onboarding.

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
| BAR-008 | Two-fixture-state harness | `[x]` | `41c5b2e` — `pnpm test:visual`. Currently reports 16 routes, 15 reading the data layer, **0 hardcoded** |
| BAR-153 | `CHECKSUMS.txt` over the design source | `[ ]` | No `CHECKSUMS.txt` anywhere in the tree. The UI contract can be edited without trace |
| BAR-154 | Lint rule banning literals in screen files | `[x]` | Added 28 Aug. `no-restricted-syntax` over `src/screens/**` and `src/components/**` bans location ids and names, docket numbers and catalogue SKU names. **Verified by probe**: all six planted literals errored and two legitimate strings passed. Deliberately narrow — a general literal ban gets disabled, and a disabled rule catches nothing |
| BAR-009 | `sw.ts` in typecheck and lint | `[ ]` | Still excluded: `eslint.config.js:8` ignores it, `tsconfig.app.json:23` excludes it |
| BAR-010 | Formatter, pre-commit, CODEOWNERS, PR template | `[ ]` | None of the four exist |

### M1 — Ledger core, executed

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-155 | Command RPCs as the only write path | `[~]` | `e087d10` — `boa_bar_create_docket` and `boa_bar_accept_docket` exist and enforce their rules. **No application code calls either.** The count-submit and POS-post RPCs do not exist |
| BAR-156 | Interim opening-stock bootstrap | `[~]` | `202608280002` applied 28 Aug; `boa_bar_claim_venue` and `boa_bar_open_stock` exist. **Opening stock has not been posted** — `pnpm bootstrap` correctly refuses while `auth.users` is empty and changes nothing. Verified by running it |
| BAR-011 | Verify no table-level write grants | `[x]` | **Verified against the live database 28 Aug**, not asserted: `privileges.test.sql` 52/52, plus `ledger.test.sql` 11/11 — 63 assertions, 0 failed. It failed the first time it was ever actually run, which is how the two EXECUTE holes were found. It now enumerates every function for both roles |
| BAR-161 | Location-scope the snapshot RPC | `[ ]` | Raised 28 Aug. `boa_bar_inventory_snapshot` still cross-joins every location and authorises on any role at the venue |
| BAR-163 | Count witness column | `[ ]` | `boa_bar_count_session` has `assigned_to` and `reviewed_by`; no witness column |
| BAR-012 | `GRANT USAGE ON SCHEMA private` | `[x]` | `3c6acd9`, verified 28 Aug — `authenticated` has USAGE on `private`, `anon` has none, and `private.boa_bar_balance` is unreachable |
| BAR-013 | Harden ledger immutability | `[~]` | Row triggers on `movement`, `movement_line` and now `person_name_history`; `alter default privileges … revoke truncate` present. Still no `ENABLE ALWAYS` and no `FORCE ROW LEVEL SECURITY`, so a table owner bypasses both |
| BAR-014 | `v_position` sums the ledger | `[ ]` | **No view of any kind exists in any migration** (grep `create .*view` → 0 hits). `boa_bar_inventory_snapshot` reads the projection exclusively |
| BAR-015 | Reconciliation view and test | `[ ]` | Same. Nothing compares the projection against a ledger sum |
| BAR-016 | Protect the balance projection | `[~]` | `private.boa_bar_balance` now has exactly one writer, `private.boa_bar_post_movement`, instead of the insert being duplicated per entry point. Still no trigger and no scheduled reconciliation — `pnpm bootstrap` compares the projection against a ledger sum once, at bootstrap, which is not the same as protecting it |
| BAR-017 | Fix `comp` to a two-leg move | `[!]` | `202608220001:256` still forces `comp` to net negative, so hospitality separation is unrecordable |
| BAR-018 | Restrict `sale` to the POS path | `[!]` | `boa_bar_submit_movement` accepts `kind = 'sale'` from `crew`, `warehouse` and `bar_lead`. Violates non-negotiable 8 |
| BAR-019 | Receipt movement path | `[ ]` | No receipt RPC and no receipt screen |
| BAR-020 | Return and transfer paths | `[~]` | Transfer legs exist inside the docket RPCs. No standalone return path |
| BAR-021 | Adjustment path with role and reason | `[ ]` | No adjustment RPC; `reverses_movement_id` is not unique, so one movement can be reversed twice |
| BAR-022 | Venue-scope every foreign key | `[!]` | `movement_line.sku_id` and `.location_id` are not venue-scoped — a movement can post against another venue's SKUs |
| BAR-023 | Server-validate the timestamps | `[!]` | `202608220001:263` still takes `occurred_at` and `business_date` from the client payload unvalidated. History can be backdated around a count |
| BAR-024 | Location-scoped authorisation | `[~]` | `membership.location_id` is now **read** — the live repository uses it for the caller's default docket and count location — but no policy or RPC enforces it |
| BAR-025 | Tolerance bands in the database | `[ ]` | They exist only in TypeScript (`domain/inventory.ts` `toleranceFor`) |
| BAR-026 | `excise_category` NOT NULL | `[~]` | Still nullable free text, so the constraint half of the task is undone. But it is no longer NULL for every SKU: the bootstrap populates a **provisional** vocabulary (`beer`, `spirit`, NULL for mixers) so the excise view has a shape to be built against. The vocabulary will change once BAR-158 lands |
| BAR-027 | Missing spec §13 columns | `[~]` | BAR-124 added display names. `abv`, `supplier_vendor_id`, `is_licenced`, `is_blind`, `witnessed_by`, `counted_at`, empties and delivery-note remain absent |
| BAR-028 | Non-negative position guard | `[ ]` | Nothing prevents issuing more than is held. The per-column `>= 0` checks are on docket and count lines, not on the position |
| BAR-029 | Index `movement_line.movement_id` | `[ ]` | The two indexes are `(venue_id, business_date, occurred_at)` and `(location_id, sku_id)`. `movement_id` is still an unindexed FK, evaluated per row by the read policy — and the live repository queries it by `movement_id` on every ledger read |
| BAR-030 | Behavioural pgTAP suite | `[R]` | `ledger.test.sql`'s 11 assertions are still existence-only. `privileges.test.sql`'s 52 are real privilege checks and earned their keep — they caught two live EXECUTE holes. Still uncovered: nothing attempts an UPDATE to prove the immutability trigger fires, and nothing connects **as** a role to prove an RLS policy returns the right rows |
| BAR-031 | Execute migrations | `[x]` | **All seven migrations applied and confirmed by object existence, 28 Aug.** PostgreSQL 17.6. `pnpm db:state` reports the history and checks that each migration's objects actually exist, rather than trusting the history table |
| BAR-032 | Deterministic seed that renders the design | `[~]` | **Reference data verified present in the hosted project 28 Aug: 1 venue, 9 locations, 11 SKUs.** Opening ledger not yet posted — blocked on the first `auth.users` row. Still no serve mappings (BAR-159) and no tolerance bands in the database (BAR-025) |
| BAR-033 | Generate database types | `[ ]` | The client is untyped. `src/data/live/rows.ts` hand-writes every row shape precisely because generated types do not exist — 156 lines that a generator would own |
| BAR-122 | Revoke `TRUNCATE` everywhere | `[x]` | `3c6acd9` — verified empirically over REST: `anon` receives `HTTP 401 permission denied` |
| BAR-123 | Business date spans the festival night | `[!]` | Still the IST calendar date, so the night splits at midnight and a close-out count at 01:30 belongs to the wrong day |
| BAR-124 | Person-name resolution | `[~]` | `202608280001_person_names.sql` written — table, generated first name, append-only history, `boa_bar_set_person_name`. **Unapplied, and `boa_bar_person` is empty, so every live name would render `UNNAMED`** |
| BAR-125 | Seal submitted counts | `[ ]` | Nothing sets `submitted_at` or freezes a count; there is no count write path at all |
| BAR-126 | Storage bucket for POS files | `[ ]` | — |
| BAR-127 | Read `venue.timezone` and `event_date` | `[~]` | `timezone` is now read (`auth.tsx:81`) and threaded into the live repository's clock, so no stamp uses the device timezone. `event_date` is still never read |
| BAR-128 | Deterministic membership selection | `[~]` | `auth.tsx` takes `memberships[0]` with no explicit ordering, so a person holding two roles gets whichever the query returns first |

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
| BAR-041 | Toast system | `[~]` | `demo-store.tsx:309` expires at **2400 ms**; the design and the acceptance criterion are 2600 ms |
| BAR-042 | Repository interface | `[~]` | Interface, fixture and live implementations all exist (`b49768c`, `743a4d4`). **The live implementation has never executed a query** — the database holds nothing to read |
| BAR-043 | Fixture repository from the design's data | `[x]` | `design-data.ts` with line references; the gate reports 0 hardcoded screens |
| BAR-044 | Application service layer | `[~]` | `src/services/` exists with `issue.ts` and `accept.ts` — Zod validation, the custody domain rules, then the repository. Both custody writes are now wired and verified in a browser. Commands are on the `Repository` interface, so no screen imports Supabase or Dexie and no service calls an RPC. 13 service tests. Count, waste and the remaining write use cases still have no service-backed screen path |
| BAR-045 | Remove fixture data from screen files | `[~]` | The issue screen's legacy fixture block is deleted; all 15 data-bearing routes read the repository, the gate reports 0 hardcoded, and BAR-154's lint rule enforces it mechanically for screens and components. `src/features/screens.tsx` still holds waste/report literals — it is not under the rule's file scope because it is being deleted, not fixed (BAR-164) |
| BAR-046 | Wire the domain layer | `[~]` | Callers now exist for `varianceBand`, `toleranceFor`, `buildQueuedMovement`, and the whole of the new `domain/custody.ts` and `domain/outbox-policy.ts`. Still zero callers outside tests: `derivePositions`, `applyIdempotently`, `reverseMovement`, `theoreticalClosing`, `weightedAverageCost`, **`mlFromGrossWeight`** |
| BAR-164 | Delete the legacy parallel live path | `[ ]` | `src/lib/live-repository.ts` and `demo-store`'s snapshot loader are still present and still hardcode `bar_3` |
| BAR-047 | Error boundary and not-found route | `[x]` | Added 28 Aug. Router-level `defaultErrorComponent` and `defaultNotFoundComponent` so a new route cannot arrive without a boundary, plus `AppErrorBoundary` outside the router for throws in the providers. **Verified in a browser**: a planted throw in a repository read rendered the failure card in-shell with the nav intact, and cleared when the read succeeded. Also `throwOnError: true` on `useRepositoryQuery` — screens render `data?.field ?? '—'`, so a failed live read previously produced a screen of em-dashes and zeroes, visually identical to a venue with no stock |
| BAR-048 | Zod at every boundary | `[~]` | Zod now validates both write use cases at the service boundary — the first real use outside `domain/inventory.ts`. RPC **responses**, QR payloads, POS rows and local-store reads are still unvalidated; `rows.ts` casts by hand |
| BAR-129 | Bounded quantity inputs | `[~]` | Verified in the custody chain: issue cannot exceed the warehouse position and accept cannot exceed the docket. Waste remains on the legacy unbounded stepper |
| BAR-130 | Full SKU catalogue on every screen | `[~]` | Issue and count list the full active catalogue through the repository. The legacy waste screen still slices its store data |
| BAR-131 | Remove the fake OS status bar | `[!]` | `AppShell.tsx:59` still renders `status-line` with a hardcoded `19:44` and a fake 4G indicator |
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
| BAR-060 | `receipt` screen | `[ ]` | — |
| BAR-140 | Opening stock entry | `[~]` | `boa_bar_open_stock` is the write path and `pnpm bootstrap` is an operator route to it. **There is still no screen** — a warehouse operator cannot enter opening stock from the app, only an operator with the database password can |

### M4 — Bar operations and offline

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-061 | `bar` screen — the bar workspace | `[x]` | `10185b5` |
| BAR-062 | Bar list navigates to bar detail | `[x]` | Fixed 28 Aug — the `bar.id === 'bar-3'` gate is gone, so every card opens its bar under both fixture and live data |
| BAR-063 | `waste` screen, three taps | `[R]` | Still `src/features/screens.tsx:87`. Reason vocabulary diverges; line loss missing |
| BAR-064 | Request top-up | `[ ]` | — |
| BAR-065 | Bar-to-bar transfer | `[ ]` | — |
| BAR-066 | Reference cache | `[!]` | `referenceCache` is declared in `offline-db.ts:23` and **written to by nothing** (grep: zero writes) |
| BAR-067 | Offline reads from cache | `[~]` | The dangerous half is fixed: `RepositoryProvider` cannot fall back to fixtures, and as of BAR-047 a failed read now *surfaces* instead of rendering as empty data. The useful half still does not exist — there is no cache to read, so a failed read shows an error rather than the last known position |
| BAR-068 | Cold-start offline | `[!]` | Membership load needs the network; an offline cold start locks every staff member out |
| BAR-069 | Stable idempotency keys | `[~]` | The idempotency key now identifies the user **action** — created once when the screen mounts, reused for every attempt — and the outbox dedupes on it, so a double tap posts once. It does **not** survive a reload (BAR-072), so a reload before the drain relies on the database refusing the second acceptance (BAR-134 asserts it does) |
| BAR-070 | Ordered outbox replay | `[x]` | `selectDrainBatch` replays in causal order and **stops at the first blocked entry**. The previous drain skipped an entry in backoff and posted the ones behind it, so an issue that failed once could be overtaken by its own acceptance. Asserted in `outbox-policy.test.ts`, including the case that used to break |
| BAR-071 | No silent write loss | `[!]` | `demo-store.tsx:353` — `void queueLiveMovement(…)`. An unawaited promise whose rejection is discarded while the UI toasts success |
| BAR-072 | Persist mutable state | `[!]` | Dockets, counts and optimistic deltas live in React memory only; lost on reload |
| BAR-073 | Real connectivity detection | `[R]` | Still a hand-operated toggle in the shell |
| BAR-074 | Retry, backoff and auth stop | `[~]` | Backoff capped at 60 s with jitter; an auth failure now stops the drain **without consuming an attempt** (it previously burned all eight in two minutes and marked a shift's work failed); a rule violation dead-letters immediately instead of retrying. Not done: nothing prompts re-authentication when the drain stops |
| BAR-075 | Real "as of" stamps | `[~]` | The live repository derives every stamp from the server's clock in the venue's timezone. `AppShell.tsx:59` still prints a hardcoded `19:44` |
| BAR-076 | Service worker for a festival network | `[R]` | `06968a4` made an update applicable. No API caching strategy, and still excluded from typecheck and lint |
| BAR-077 | Remove demo switches from the UI | `[!]` | `AppShell.tsx:85` — the sync line is still a button that toggles offline mode |
| BAR-078 | Tap targets and focus | `[ ]` | Not measured since the rebuild. Needs a pass |
| BAR-133 | Waste and accept post to the right location | `[~]` | The three screen literals are fixed (28 Aug): `BarsScreen` opens any bar, and `CountSession.locationId` / `Custody.toLocationId` carry the id the two flow CTAs need, populated by both repositories and shifted in the gate's second fixture variant. **The task is not done: `demo-store.tsx:353` still posts every waste to `bar_3` regardless of which bar recorded it.** That is the legacy path and goes with BAR-164 |
| BAR-134 | Idempotent acceptance | `[x]` | The accept RPC rejects a second acceptance and replays idempotently on the client key |
| BAR-135 | Dead-letter for invalid outbox entries | `[~]` | A permanent failure is now classified as such and marked terminal on the first attempt rather than after eight, with `permanent: true`. Nothing surfaces it yet — the dead-letter view is still missing |
| BAR-136 | QR scanner | `[ ]` | No `BarcodeDetector`, `getUserMedia` or QR library anywhere. `vercel.json` grants camera permission for a capability that does not exist |
| BAR-137 | Session longevity for shared devices | `[ ]` | Magic-link only, and no device registry — which is why the live `deviceLabel` falls back to the membership's location code |
| BAR-138 | Security headers and build identity | `[x]` | `06968a4` — a waiting service worker can now actually be activated; previously it could never be replaced |
| BAR-141 | Attribute movements to their real actor | `[ ]` | The RPC stamps `auth.uid()` at flush time, so a shift handover re-attributes the previous crew member's work |
| BAR-142 | Outbox visibility and device loss | `[ ]` | — |
| BAR-146 | Surface `in_transit` stock | `[~]` | `IN TRANSIT` now appears in the live stock-position breakdown when non-zero. No screen shows *which* dockets are parked there |
| BAR-147 | Prevent self-acceptance | `[x]` | The accept RPC rejects acceptance by the issuing user. Enforced in the database, not the client |

### M5 — Counts and variance

| Task | Title | State | Evidence |
| --- | --- | --- | --- |
| BAR-079 | `count` sequential and blind | `[x]` | `36ffc4f` — inputs start at zero, stepper resets per line, no expected figure in the read model. Verified by driving the browser |
| BAR-080 | Partial-container capture | `[x]` | `36ffc4f` — all three modes (`none` / `ml` / `litres`) verified in the browser |
| BAR-081 | Tare weighing | `[~]` | The count screen captures partial millilitres and shows `WEIGH · TARE 480 G`. **`mlFromGrossWeight` still has zero callers** — nothing converts a gross reading to millilitres, so the tare is displayed but not applied |
| BAR-082 | Count persistence | `[!]` | **There is no count-submit RPC in any migration and no write grant. A submitted count is discarded.** The whole counting chain has no destination |
| BAR-083 | Blind enforcement in the database | `[!]` | The word "blind" appears nowhere in the SQL, and the snapshot RPC serves the expected position to any role — see BAR-161 |
| BAR-084 | Seal the theoretical position at submit | `[ ]` | Nothing is sealed. The live variance report recomputes the expected position from the ledger at read time, which is correct but not a seal |
| BAR-085 | `countDone` screen | `[x]` | `36ffc4f` |
| BAR-086 | `variance` screen | `[x]` | `36ffc4f` — renders from the repository, signed deltas, banding, notes |
| BAR-087 | Signed variance banding | `[x]` | Fixed 28 Aug. `varianceBand` bands on magnitude then floors a positive variance at amber — it can still be red, never green. Six new assertions in `inventory.test.ts` cover the sign asymmetry, the red ceiling, exact zero and the null case |
| BAR-088 | Throughput ranking | `[ ]` | — |
| BAR-089 | `activity`, five filters | `[x]` | `10185b5` — all five groups; counts unioned from `count_session`, not derived from movements |
| BAR-090 | `mv` screen — movement detail | `[ ]` | Screen missing. The live repository's `movementDetail()` is implemented and has no consumer |
| BAR-091 | Adjustment log view | `[ ]` | — |
| BAR-092 | Paper fallback print views | `[ ]` | No `@media print` and no `window.print` anywhere. **The specification's fallback when the network fails does not exist** |
| BAR-145 | In-event correction path | `[ ]` | A mistyped count cannot be fixed |
| BAR-148 | Empties capture | `[ ]` | Blocked on BAR-160 |
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
| BAR-160 | Decide empties | `[ ]` | Must be settled before the count sheet is printed at load-in |
| BAR-114 | Component and interaction tests | `[ ]` | Testing Library is installed and typed; no jsdom environment is configured, so no component test can run |
| BAR-115 | Real-device offline and QR checks | `[?]` | Cannot be assessed — there is no QR scanner and no offline read path to test |
| BAR-116 | Staff onboarding and roster | `[ ]` | — |
| BAR-117 | Shift handover and manager-absent path | `[ ]` | — |
| BAR-143 | Onboarding that works at load-in | `[ ]` | Magic-link only, ~20 temporary staff, congested cellular |
| BAR-144 | In-app membership and role management | `[ ]` | When the manager leaves, variance and count sign-off leave with them |
| BAR-118 | Backup and restore verified | `[ ]` | — |
| BAR-119 | Observability | `[ ]` | — |
| BAR-120 | Staging deploy and acceptance | `[ ]` | — |
| BAR-121 | Production cutover | `[ ]` | — |

### Counted

Computed from the rows above, not asserted.

| | Count |
| --- | --- |
| `[x]` done | 42 |
| `[~]` partial | 37 |
| `[R]` rewrite | 6 |
| `[!]` defect actively present | 15 |
| `[ ]` not started | 62 |
| `[?]` unverifiable today | 2 |
| **Total** | **164** |

Read the middle three rows as the real position: **59 tasks are neither done nor
untouched**, and 15 of them are defects sitting in the code right now.

## Would stop the event dead

These came out of the adversarial verification pass, which asked one question:
will this survive 10 October? Each is evidenced in code and none was in the
original audit.

| # | Problem | Task |
| --- | --- | --- |
| 1 | ~~**There is no way to enter opening stock.**~~ **Half addressed 28 Aug.** `boa_bar_open_stock` posts opening stock as a receipt through the ledger, and `pnpm bootstrap` drives it. Still an operator-only path needing the database password: **there is no screen**, so a warehouse lead cannot do it from the app, and the migration has not been applied | BAR-156 / BAR-140 |
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
| 18 | ~~**Positive variance grades green.**~~ **Fixed 28 Aug**, `bd0f1a2`-series. `varianceBand` now floors a positive variance at amber and can still reach red on magnitude. **Correction to the first version of this row:** it claimed `+2.4%` on bottled beer graded green. That was wrong — bottled beer's green edge is 1%, not 3%, so `+2.4%` already banded amber and reproduced the design. The real defect was smaller positives: `+0.5%` bottled beer, `+1.2%` spirits and `+4%` draught all graded green, and spec §8 requires positive variance never to be green | BAR-087 |
| 19 | ~~**The bars list dead-ends under live data.**~~ **Fixed 28 Aug.** `BarsScreen` opens any bar; `CountSession.locationId` and `Custody.toLocationId` now carry the id the two flow CTAs need. BAR-154's lint rule was added at the same time and **was verified to catch all three literals** before they were removed | BAR-133 |
| 20 | ~~**Any signed-in user could forge a movement.**~~ **Found and fixed 28 Aug**, `202608280003`, verified shut. `private.boa_bar_post_movement` was extracted that morning so the bootstrap could supply an actor explicitly — and it therefore takes the actor as a parameter. `create function` grants EXECUTE to PUBLIC by default, and `authenticated` already had USAGE on schema `private` (needed since BAR-012 so RLS policies can resolve `boa_bar_has_role`). So for several hours any crew member could post any movement, to any location, attributed to anyone, bypassing both the role gate and the two-party docket rules. **It was live, not theoretical** — I initially recorded it as unexploitable on the grounds that the migration was unapplied, and it had in fact been applied | BAR-011 |

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

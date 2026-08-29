# HANDOVER — 29 August 2026

**Claude is off this project from today.** Codex and Cursor own everything from
here; the approval gate for architecture, schema and ADR changes is the **user**.

This file is the complete pending list and the prompt to resume with. It does not
restate the architecture — `/docs` is canonical. Read in this order:

1. `docs/CURRENT-STATE.md` — what is done, broken and next
2. `docs/RELEASE-1.md` §4 — the ordered blocking list, and what is deliberately cut
3. `AGENTS.md` — how to work here, and what you must not claim
4. this file — the pending list in one place

---

## 1. Where the project actually stands

**Event: 10 October 2026.** 42 days out.

| | |
| --- | --- |
| Tasks | **61 done · 40 partial · 7 defects · 51 not started** (164 total) |
| Unit tests | 136 passing |
| Database | All local migrations through `202608290001` applied · **113 pgTAP assertions, 0 failed** |
| Gates | typecheck, lint, test, build, `check:sql` all green |
| Fidelity gate | 15 screens reading the data layer · **0 hardcoded · 0 errored** |
| Screens | 16 of 22 built |

**Cleared 29 August:** the live read path. A user exists, the venue is claimed,
opening stock is posted (movement `8a0c5b2c`, 10 lines, 638 containers), the
bootstrap confirms the ledger sum and the projection agree on every line, and the
app signed in against the hosted database renders **638 containers with the bars
at zero**.

**The first live write is now proven:** on 29 August an authenticated Safari
session recorded 1 can of Bira 91 White as Warehouse waste. The app returned
Home at 0 pending with total stock 638 → 637, and `db-state.mjs` reported the
movement count increased from 2 to 3. Count, receipt and the two-person custody
cycle remain unproven from screens.

That is the same shape as the gap just closed — a whole layer that looks right
and has never run. **Close it first.**

---

## 2. Pending — everything, in priority order

### A. Prove the write path — do this first (half a day)

Post one of each from the app against the live database, then confirm with
`node scripts/db-state.mjs`:

- [x] a **waste** entry — live 29 Aug: Warehouse, Bira 91 White, 1 can, Breakage; Home 0 pending and 638 → 637; database movement count 2 → 3
- [ ] a **count** — the blind path, and the one the audit depends on
- [ ] an **issue → docket → accept** cycle, using two different accounts
- [ ] a **receipt** against a delivery note

**Done when** each appears in `boa_bar_movement` / `boa_bar_count_line` and the
home screen figures move accordingly. If any fails, that failure is worth more
than any new feature.

### B. Defects present in the code — 5 in scope

| Task | What is wrong | Where |
| --- | --- | --- |
| **BAR-018** | `boa_bar_submit_movement` accepts `kind = 'sale'` from `crew`, `warehouse` and `bar_lead`. **Violates non-negotiable 8** — a hand-keyed sale corrupts variance silently | schema |
| **BAR-022** | `movement_line.sku_id` and `.location_id` are not venue-scoped, so a movement can post against another venue's SKUs | schema |
| **BAR-017** | `202608220001:256` forces `comp` to net negative, so hospitality separation is unrecordable | schema |
| **BAR-068** | `auth.tsx` loads memberships over the network at start, so an **offline cold start locks staff out** before any caching helps | `src/lib/auth.tsx` |
| **BAR-131** | `AppShell.tsx:59` renders a fake OS status bar with a hardcoded `19:44` and a fake 4G indicator. A fake clock beside real `AS OF` stamps undermines the one thing the audit rests on | UI |

BAR-094 and BAR-096 are also `[!]` but are **POS**, which Release 1 cuts. Ignore
them.

### C. Release 1 blocking items still open — `docs/RELEASE-1.md` §4

- **Item 10 — BAR-148 empties.** On the printed sheet only; nothing captures
  empties in the app or the schema. Blocked on the user's BAR-160 decision.
- **Item 11 — BAR-068** (above) and **BAR-137**, session longevity on shared
  phones. Untouched, and largely Supabase project configuration.
- **Item 12 — BAR-164 remainder.** `src/features/screens.tsx` still holds the
  `reports` empty state until BAR-107.

### D. Verification gaps — things believed true that nothing checks

- **BAR-030** — `ledger.test.sql` is 11 *existence* assertions. It asserts the
  ledger's objects are present, never that they behave. The last file to replace.
- **BAR-006** — `.github/workflows/ci.yml` exists and **no CI run has ever been
  observed**. A pipeline nobody has watched pass is not a gate.
- **BAR-114** — the Dexie outbox and cache need a browser; unit tests do not
  exercise the IO.
- **BAR-115** — no real-device offline or QR check is possible; there is no QR
  scanner and the offline read path has never run on a phone.
- **BAR-092** — 7 print sheets render, but **the printed output has never been
  seen**. A4 fit and page breaks are unverified.

### E. Decisions only the user can make — none of these are agent work

| | Why it cannot wait |
| --- | --- |
| **BAR-158 — excise return template** | Target was 31 August. Decides what must be **physically observed** on the night. A wrong category set is backfillable per SKU; a missed observation is not |
| **BAR-160 — empties** | Must be settled before count sheets are printed at load-in |
| **ADR-014 — sign-in method** | `PROPOSED`. BAR-143's membership half works with any method, but until this is ruled, load-in depends on email magic links for ~20 temporary staff on congested cellular |
| **ADR-006, 008, 010, 011, 012** | Still `PROPOSED` — agent-chosen defaults until the user rules |

### F. Cut from Release 1 — do not spend a day on these

Show-day control board, run-out alerts, POS import and everything downstream,
reports and settlement, the `sku` / `mv` / `control` / `cowork` / `rep` screens,
and variance vs **sales**. About 40 tasks. The specification's own cut order;
the reasoning is in `docs/RELEASE-1.md` §2.

---

## 3. Operational facts that will waste your time if you miss them

- **`pnpm` is NOT on the PATH.** `corepack enable` needs sudo. Every script is
  `corepack pnpm <script>`. Never hand the user a command starting with `pnpm`.
- **`test:visual` does not start a server.** Run `corepack pnpm dev` in another
  terminal first, or it fails with a connection error that looks like a code
  failure and is not.
- **`.env.local` holds the project URL and the PUBLISHABLE key.** It is
  git-ignored. `VITE_` variables are compiled into the browser bundle — the
  secret / service-role key must never appear there.
- **The database password lives only in the user's shell.** `test:db`,
  `db:state` and `bootstrap` will fail for an agent. Say so and ask; never record
  a database task as verified because the code looks right.
- **The magic link returns to `window.location.origin`**, so the dev server must
  be on the port registered in Supabase's Redirect URLs (`http://localhost:5173`).
- **Legacy JWT API keys are still enabled** on the Supabase project. Nothing uses
  them and the `service_role` one bypasses RLS until 2036. Worth disabling.

---

## 4. The prompt to resume with

Paste this into Codex or Cursor as the first message of a new session.

```
You are picking up BOA Bar Control, a festival bar-inventory PWA for Bangalore
Open Air on 10 October 2026. Claude is off the project; you own implementation
and the user approves anything architectural.

Read these first, in order, and do not skip them:
  1. docs/CURRENT-STATE.md   — the session log at the bottom is newest-first
  2. docs/HANDOVER.md        — the complete pending list
  3. docs/RELEASE-1.md §4    — the ordered blocking list and what is cut
  4. AGENTS.md               — how to work here and what you must not claim

Then confirm the gates are green before changing anything, so you know what you
broke:
  corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build

Note: pnpm is not on the PATH on this machine. Every script runs as
`corepack pnpm <script>`. Never give the user a command starting with `pnpm`.

Your first task is section 2A of docs/HANDOVER.md: prove the write path. The
read path was verified live on 29 August — the app renders 638 containers from
the ledger with the bars at zero. No WRITE has ever been posted from a screen:
not a count, waste entry, receipt or docket. The RPCs pass 107 pgTAP assertions
and the services pass against fixtures, but nothing has run
screen -> service -> outbox -> RPC -> ledger end to end.

Start with a waste entry, because it is the shortest write path — no two-party
rules and no docket. Walk it in a browser against the live database, then ask
the user to run `node scripts/db-state.mjs` (only they have the database
password) and confirm it landed. Report exactly what you saw, and say plainly
what you could not verify.

Four rules that override anything convenient:
  - The ledger is append-only. Corrections are compensating movements.
  - Stock is derived by summing the ledger. Never store a quantity.
  - Never pre-fill a count input with an expected figure, and never let a
    counting user read the expected position for the location they are counting.
  - Never write "verified" for something you did not run. This project's original
    failure was a document asserting a verification nobody performed. It is the
    one unrecoverable mistake here.

Work one task at a time by BAR-nnn id, commit with the id in the message, and
append a session entry to docs/CURRENT-STATE.md before you finish, stating what
you did NOT verify.
```

---

## 5. If you only get one more day before the event

In this order:

1. **Prove the write path** (2A). Everything else is theory until a write lands.
2. **BAR-018** — a hand-keyed `sale` silently corrupts the variance the whole
   audit rests on.
3. **BAR-068** — a staff member in a dead spot cannot get into the app at all.
4. **Print the paper sheets** and check them on real A4. The fallback plan is
   paper counts; an unreadable sheet means no fallback.

Phases 1–2 with paper counts and a manual POS reconciliation the following week
still produces a defensible audit. Nothing else does — that is the
specification's own judgement, and it is why everything in §2F is cut.

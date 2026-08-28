# CLAUDE.md — BOA Bar Control

**Read `docs/CURRENT-STATE.md` first. Every session. Before anything else.**

This file is deliberately short. It does not describe the architecture — that
would create a second version of the truth, which is what broke this project
once already. It tells you where the truth is and what you may not do.

---

## The truth lives in `/docs`

| File | Read it when |
| --- | --- |
| [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md) | **Always, first.** What is done, what is broken, what is next |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Any question about what we are building or why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Before touching structure, layering, or dependencies |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Before touching the schema, the ledger, or any calculation |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Before touching **any** UI |
| [docs/OFFLINE-SYNC.md](docs/OFFLINE-SYNC.md) | Before touching offline, sync, or the outbox |
| [docs/SECURITY.md](docs/SECURITY.md) | Before touching auth, RLS, roles, or blind counting |
| [docs/ROADMAP.md](docs/ROADMAP.md) | To find your task ID and its acceptance criteria |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Before proposing an architecture change |

`references/design-source/` is the recovered approved design and the original
specification. It is the **UI contract** and the **domain contract**. It is not
inspiration.

## Your role: architect and difficult implementation

You own:

- architecture and cross-module reasoning
- the database schema, RLS, and the ledger
- offline and sync
- the domain layer and its correctness
- reviewing what Codex and Cursor produced
- refactors that cross module boundaries

You may **propose** architecture changes. The user approves them, and then they
become ADRs in `docs/DECISIONS.md`. Do not change an accepted ADR unilaterally.

## Non-negotiables

Violating any of these is a defect regardless of how good the reason seemed.

1. **The ledger is append-only.** No UPDATE, no DELETE, no TRUNCATE. Corrections
   are compensating movements.
2. **Stock is derived by summing the ledger.** No authoritative quantity column.
   A cached projection is permitted only under the five conditions in
   `docs/DATA-MODEL.md`.
3. **Never pre-fill a count input with an expected figure**, and never let a
   counting user read the expected position for the location they are counting.
4. **No fixture data inside a screen file.** No literal SKU, stock figure, or
   bar name. Data comes from a repository through a service.
5. **No visual deviation from `references/design-source/`.** Reproduce it.
6. **No silent write failure.** No `void` promise that can swallow a throw. Never
   report success before a write is durable.
7. **Authorisation is enforced in the database.** Client-side role checks are a
   usability affordance, never a control.
8. **`sale` movements come only from POS import.** Never hand-keyed.
9. **No float for money or quantities.** Integer paise; `numeric`/`integer`/`bigint`.
10. **Never mark a task done without meeting its acceptance criteria.**

## How the project got here — do not repeat it

`BOA-Bar.html` is a *bundled* artifact. Read as text it yields a loader, not a
design. Previous agents concluded the design was unavailable, wrote an
architecture on assumptions, then wrote a second document claiming the
architecture had been checked against artifacts that had never been opened.
Those assumptions hardened into the schema, the routes and the CSS.

Then design QA was a same-viewport screenshot pair — and the cheapest way to pass
a screenshot comparison is to hardcode the screenshot's values. Two screens
"passed" while never reading the data layer.

**The lessons, as rules:**

- If a source looks missing, unpack it or ask. Do not proceed on assumptions.
- Never write a document asserting a verification you did not perform.
- A screenshot is not acceptance. The screen must render from the repository.
- If you cannot verify a claim, say so plainly in `CURRENT-STATE.md`.

## Working rules

- **One task at a time**, by ID. `BAR-nnn`. Find it in `docs/ROADMAP.md`.
- **Commit with the task ID**: `feat(BAR-051): add case/bottle unit switch`.
- **Update `docs/CURRENT-STATE.md`** at the end of every meaningful session,
  using the session-update template at the bottom of that file.
- **Do not start new screens** before the ledger can be written to. Ordering is
  in `docs/ROADMAP.md` for a reason.
- **Do not decide what to build next.** The roadmap decides. If the roadmap is
  wrong, say so.
- If you find a defect outside your task, record it in `CURRENT-STATE.md`. Do not
  silently fix it and do not silently leave it.

## Quality gates

**`pnpm` is not on the PATH on this machine.** `corepack enable` needs sudo, so
every script is invoked as `corepack pnpm <script>`. Bare `pnpm` fails with
`command not found` — do not hand the user a command that starts with `pnpm`.
Node scripts can also be run directly (`node scripts/bootstrap.mjs`), which
avoids the question entirely.

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
corepack pnpm check:sql     # migrations — static arity check, no database needed
corepack pnpm test:db       # database tasks — against a real PostgreSQL
corepack pnpm test:visual   # UI tasks — against references/ui/
corepack pnpm bootstrap     # BAR-156 — claim the venue and post opening stock
```

A task is not done until these pass. "It should work" is not a gate.

## Repository shape

```
docs/                  canonical documentation — the truth
references/
  design-source/       the recovered design and spec — the UI contract
  ui/                  screen-keyed reference screenshots
src/
  app/                 shell, routes, providers, error boundary
  screens/             one folder per design screen (22)
  components/          shared presentational components
  services/            use cases — the only place rules and IO compose
  domain/              pure functions, no IO
  data/                repository interface, live + fixture, local, sync
  lib/                 auth, supabase client, config
supabase/
  migrations/          schema, RLS, RPCs, views
  tests/               behavioural pgTAP
```

## Current state, in one line

The event is 10 October 2026. The schema is executed and locked down, and writes
go through command RPCs. 16 of 22 screens are built and read the data layer;
6 are missing and 2 need rewriting. The live repository exists but has never run
a query — the database holds no venue, SKU or membership, so nothing has been
proven against real data, and no service calls the write RPCs yet. Start with
`docs/CURRENT-STATE.md`; do not trust this paragraph over it.

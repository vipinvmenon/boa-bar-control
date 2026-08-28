# AGENTS.md — BOA Bar Control

**Read `docs/CURRENT-STATE.md` first. Every session. Before anything else.**

This file is for Codex and any other coding agent working in this repository.
It is deliberately short: it points at the truth rather than restating it,
because three separate descriptions of this system is how the project broke.

---

## Where the truth is

`/docs` is canonical. Read these before writing code:

| File | Read it when |
| --- | --- |
| [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md) | **Always, first** |
| [docs/ROADMAP.md](docs/ROADMAP.md) | To find your task ID and acceptance criteria |
| [docs/PRODUCT.md](docs/PRODUCT.md) | What we are building and why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, structure, dependencies |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Schema, ledger, calculations |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | **Before any UI work** |
| [docs/OFFLINE-SYNC.md](docs/OFFLINE-SYNC.md) | Offline, sync, outbox |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, RLS, roles, blind counting |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisions already made — do not relitigate |

`references/design-source/` is the recovered approved design and the original
written specification:

- `design-script.jsx` — the 22-screen state machine. **The interaction contract.**
- `design-markup.html` — the markup with every style inline. **The pixel contract.**
- `spec.txt` — the original specification. **The domain contract.**

## Your role: implementation

You implement clearly scoped tickets. You do not design the architecture and you
do not decide what to build next.

A well-formed task for you looks like:

```
Implement BAR-051.

Read: docs/CURRENT-STATE.md, docs/DESIGN-SYSTEM.md, docs/ROADMAP.md
Reference: references/design-source/design-markup.html (the `issue` branch)
           references/design-source/design-script.jsx (issueQty, issueUnit, bottles)

Scope: the issue screen's case/bottle unit switch and quantity equivalence.
Do not change: the schema, the router, the design tokens.

Acceptance: (from ROADMAP BAR-051)
```

If a task is not scoped like this, ask for the scope. Do not infer it.

## Non-negotiables

Violating any of these is a defect regardless of how good the reason seemed.

1. **The ledger is append-only.** No UPDATE, no DELETE, no TRUNCATE. Never write
   `inventory.quantity -= n` or anything like it.
2. **Stock is derived by summing the ledger.** Never introduce a stored stock level.
3. **Never pre-fill a count input with an expected figure.** Count inputs start
   at zero. This is the most important integrity rule in the product.
4. **No fixture data inside a screen file.** No literal SKU list, stock figure,
   or bar name in `src/screens/`. Data comes from a repository through a service.
5. **Reproduce the design; do not reinterpret it.** See the forbidden list below.
6. **No silent write failure.** No `void` promise that can swallow a throw.
   Never toast success before a write is durable.
7. **`sale` movements come only from POS import.** Never hand-keyed.
8. **No float for money or quantities.**
9. **No new dependency** without it being in the task scope.
10. **Never mark a task done without meeting its acceptance criteria.**

## Forbidden without an explicit instruction in the task

**UI:**
- redesign cards or change their composition
- change spacing, radii, or the type scale
- change navigation or screen order
- substitute colours, or add any colour outside the palette
- add a grey — every muted tone is sage or bone at an alpha
- introduce a new component style
- add gradients, shadows, or effects not in the source
- change the typography hierarchy
- rename, re-case, or rewrite label text (the design's data vocabulary is UPPER CASE)
- invent content, metrics, or affordances

**Architecture:**
- change the layering or add a cross-layer import
- import Supabase or Dexie into a screen
- add or remove a dependency
- change the schema
- change an accepted ADR

If the design or the docs appear wrong, **say so and stop**. Do not fix it
silently.

## Running anything on this machine

**`pnpm` is NOT on the PATH.** `corepack enable` needs sudo here, so every script
is invoked as `corepack pnpm <script>`. Bare `pnpm` fails with
`command not found` — do not put a command starting with `pnpm` in front of the
user. Node scripts can also be run directly (`node scripts/db-state.mjs`), which
avoids the question.

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
corepack pnpm check:sql     # migrations — static arity check, no database needed
corepack pnpm test:visual   # UI tasks — NEEDS A DEV SERVER ALREADY RUNNING
corepack pnpm test:db       # needs SUPABASE_DB_PASSWORD
corepack pnpm db:state      # read-only: what is actually in the database
```

`test:visual` does **not** start a server. Run `corepack pnpm dev` in another
terminal first, or it fails with a connection error that looks like a code
failure and is not.

`test:db`, `db:state` and `bootstrap` need the database password, which lives only
in the user's shell. If you do not have it, say so and ask — do not report a
database task as verified when you could not connect.

## Definition of done

1. The task's acceptance criteria in `docs/ROADMAP.md` are met.
2. `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build`
   all pass.
3. Database tasks: `corepack pnpm test:db` passes against a real PostgreSQL, and
   `corepack pnpm check:sql` passes before any migration is pushed.
4. UI tasks: the screen renders from the **fixture repository** — not from
   literals — and `corepack pnpm test:visual` still reports **0 hardcoded, 0
   errored** with the screen counted under "reading the data layer".
5. No new hardcoded fixture data, no new palette colour, no architecture change.
6. `docs/CURRENT-STATE.md` updated with the evidence.

Point 4 matters: a screen that hardcodes the design's sample figures can pass a
screenshot comparison while being completely non-functional. That is exactly how
this project's previous design QA certified two broken screens.

## Commits

```
feat(BAR-051): add case/bottle unit switch to issue screen
fix(BAR-079): initialise blind count inputs to zero
```

One task per commit where possible. The task ID is not optional.

## Session handoff

At the end of a session, append to `docs/CURRENT-STATE.md`:

```markdown
### Session — <date> · codex

Completed: BAR-nnn — <what, and how it was verified>
Files changed: <paths>
Architecture changes: none
Known issues: <what is broken or half-done>
Recommended next: BAR-nnn
```

"Architecture changes: none" is the expected answer. If it is not none, you have
exceeded your scope.

## Context you need about this repository

The previous implementation diverged badly from the approved design and the
specification: 156 evidenced defects, 36 of them blockers. The causes were
structural, not carelessness — no version control, no agent instructions, no
machine-checkable design contract, and a QA gate that rewarded hardcoding.

The most important consequences for you:

- **Do not trust the old status documents.** `PROJECT_STATUS.md` and
  `design-qa.md` recorded milestones as complete that were not.
  `docs/CURRENT-STATE.md` supersedes both.
- **Do not build from `docs/archive/`.** Those documents are retained as
  evidence of what went wrong.
- **`src/features/screens.tsx` is not a model to follow.** 167 lines still
  standing in for the `issue`, `waste` and `reports` screens, full of hardcoded
  fixtures and the last file reading `demo-store` for SKU data. It is being
  deleted, not improved (BAR-051, BAR-063, BAR-164).
- **`src/lib/live-repository.ts` and `demo-store`'s snapshot loader are a second,
  older live data path** that hardcodes `bar_3`. Do not extend them; BAR-164
  deletes them. The live path is `src/data/live/`.

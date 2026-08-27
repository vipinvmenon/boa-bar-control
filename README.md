# BOA Bar Control

Phone-first, offline-first PWA for Bangalore Open Air 2026 bar inventory.
Warehouse issues, QR docket acceptance, waste, blind counts, an immutable
movement ledger, variance review, and a defensible post-event audit.

**Event: Saturday 10 October 2026.**

---

## Start here

**If you are an AI agent or a new contributor, read
[docs/CURRENT-STATE.md](docs/CURRENT-STATE.md) first.** It records what is done,
what is broken, and what to do next.

A forensic audit on 27 August 2026 found 156 evidenced defects — 36 of them
blockers. The application code is substantially unbuilt: 11 of the design's 22
screens do not exist and 11 more must be rewritten. Do not infer project state
from the code, and do not trust `PROJECT_STATUS.md` or `design-qa.md` — both are
superseded and both recorded milestones as complete that were not.

## Documentation

`/docs` is canonical. Every agent reads it before writing code.

| File | Contents |
| --- | --- |
| [CURRENT-STATE.md](docs/CURRENT-STATE.md) | **Read first.** Per-task status, blockers, next actions |
| [PRODUCT.md](docs/PRODUCT.md) | What we are building and why |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, layering, boundaries, quality gates |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | The ledger, the schema, the identity, integrity rules |
| [DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | The visual contract — tokens, type, material, the 22 screens |
| [OFFLINE-SYNC.md](docs/OFFLINE-SYNC.md) | Offline reads, the outbox, replay, paper fallback |
| [SECURITY.md](docs/SECURITY.md) | Roles, RLS, blind-count enforcement, threat model |
| [ROADMAP.md](docs/ROADMAP.md) | Milestones M0–M8, task IDs, acceptance criteria |
| [DECISIONS.md](docs/DECISIONS.md) | ADRs — decisions already made |
| [archive/](docs/archive/) | Superseded documents, retained as evidence. **Do not build from these.** |

## The design and specification

`references/design-source/` holds the recovered approved design and the original
written specification. These are contracts, not inspiration.

| File | What it is |
| --- | --- |
| `design-script.jsx` | The 22-screen state machine — **the interaction contract** |
| `design-markup.html` | The markup with every style inline — **the pixel contract** |
| `spec.txt` | The original specification, 16 sections — **the domain contract** |
| `template.html` | The complete original design page |

These were recovered from `BOA-Bar.html`, which is a *bundled* artifact: read as
text it yields a loader, not a design. Every agent that opened it previously
concluded the design was unavailable and built on assumptions instead. See
[DECISIONS.md](docs/DECISIONS.md) ADR-001.

## Agent instructions

| File | For |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Claude — architect, schema, offline/sync, review |
| [AGENTS.md](AGENTS.md) | Codex and other coding agents — scoped implementation |
| [.cursor/rules/](.cursor/rules/) | Cursor — everyday IDE pair work |

Each points at `/docs` rather than restating it. Three descriptions of one system
is how this project drifted.

## Core rule

> Store movements, never levels.

Stock on hand is derived by summing an append-only ledger. The identity that must
hold, per SKU, per location, per window:

```
Opening + Received − Issued out + Received in − Sold − Comped − Wasted − Returned = Closing
```

Never write `inventory.quantity -= n`. Corrections are compensating movements.

## Start locally

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

With no Supabase variables the app runs against a fixture repository. With both
variables present it uses invited-staff email authentication and the live
repository.

## Quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

```bash
pnpm test:visual     # design fidelity gate (BAR-008) — needs `pnpm dev` running
pnpm capture:design  # regenerate references/ui from the approved design (BAR-007)
```

`pnpm test:db` exists but has never passed: the migrations have never been
executed against PostgreSQL. See BAR-031, the current blocker.

## Repository map

```
docs/                    canonical documentation
references/
  design-source/         the recovered design and spec, plus screens.json
  ui/                    22 screen-keyed reference captures (the acceptance artefacts)
  brand-tokens/          brand text tokens only — ADR-009 scope, artwork untracked
src/
  app/                   shell and typed routes
  features/              current screens — being replaced, see CURRENT-STATE
  components/            shared components
  domain/                ledger and audit calculations (currently unwired)
  lib/                   store, auth, Supabase adapter, offline outbox
  sw.ts                  PWA caching
supabase/
  migrations/            schema, RLS, immutable ledger, RPCs
  tests/                 pgTAP (currently existence-only, see BAR-030)
  seed.sql               fixture data
scripts/                 design capture and fidelity gate
audit-current/           earlier reference and implementation captures
```

The BOA "Ritual" brand system (40 MB of poster and lineup artwork) is **not
tracked** — it is git-ignored. Only its text tokens are kept, in
`references/brand-tokens/`. Per ADR-009 the app design file governs every
app-surface value, and the app itself loads only `public/assets/`.

## Production setup

1. Separate Supabase projects for development, staging and production.
2. Apply `supabase/migrations` through the CLI or a CI migration job.
   **These have never been executed — see BAR-031.**
3. Seed locations, SKUs, serve mappings, tolerance bands and memberships.
4. Configure `VITE_SUPABASE_URL` and the browser-safe publishable key.
5. Point `bar.bangaloreopenair.com` at the project after staging acceptance.

Never place the Supabase service-role key in this app. Privileged work belongs in
database functions or server-side jobs.

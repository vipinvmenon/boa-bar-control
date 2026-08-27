# BOA Bar Control — Architecture

Status: canonical. This file is the architecture contract.
Supersedes: the previous `docs/architecture.md`, which was written while the
design and specification were unavailable and whose guesses hardened into code.
See [DECISIONS.md](DECISIONS.md) ADR-001.

---

## Stack

Only what is actually installed and wired. A library named here must be in use;
a library in `package.json` that nothing imports is a defect, not a plan.

### Frontend

| Concern | Choice |
| --- | --- |
| Framework | React 19 |
| Language | TypeScript (strict) |
| Build | Vite 7 |
| Routing | TanStack Router (typed routes) |
| Server state | TanStack Query |
| Local UI state | React state / context — **only** for ephemeral UI |
| Offline store | Dexie (IndexedDB) |
| Validation | Zod — at every trust boundary |
| Icons | lucide-react |
| QR | qrcode.react |
| PWA | vite-plugin-pwa + Workbox |
| Fonts | @fontsource (Anton, Oswald 400/500/600/700, Archivo 400/600) |

### Backend

| Concern | Choice |
| --- | --- |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (invited staff, email) |
| Authorisation | Row Level Security + `SECURITY DEFINER` RPCs |
| Storage | Supabase Storage (POS source files, count evidence) |
| Types | Generated from the database — never hand-written |

### Infrastructure

| Concern | Choice |
| --- | --- |
| Hosting | Vercel |
| Database | Supabase |
| Domain | `bar.bangaloreopenair.com` |
| Timezone | Store UTC, display Asia/Kolkata |
| Currency | INR, integer paise |

## Layer boundaries

```
   UI (screens, components)
    │   presentation only — no data access, no business rules
    ▼
   Application services
    │   use cases: issueStock, acceptDocket, submitCount, recordWaste
    ▼
   Repository interface
    │   one interface, two implementations (live, fixture)
    ▼
   Local store (Dexie)  ◄──►  Sync engine (outbox + reference cache)
    │
    ▼
   Supabase client (typed)
    │
    ▼
   PostgreSQL — RLS, RPCs, immutable ledger
```

### Rules

1. **A screen never imports the Supabase client.** It never imports Dexie either.
2. **A screen never contains fixture data.** No literal SKU list, no literal
   stock figure, no literal bar name. Data arrives from a repository through a
   service. This rule exists because hardcoded fixtures let a screen pass a
   screenshot comparison while being entirely non-functional.
3. **Business rules live in `src/domain/`, and `src/domain/` must have callers.**
   A domain function with no call site outside its own test file is dead code
   and the tests covering it are worthless.
4. **One repository interface.** The fixture and live implementations satisfy the
   same interface and return the same shapes. Two divergent code paths guarantee
   drift.
5. **Writes go to the outbox, always** — online or offline. The sync engine is
   the only thing that talks to the network for writes. There is no "fast path"
   that skips it.
6. **A failed write is never silent.** No `void promise` that can swallow a
   throw. No toast claiming success before the write is durable.
7. **Zod at every boundary** — RPC responses, POS files, QR payloads, local
   store reads.
8. **No `any`.** Database types are generated.

## Directory structure

```
src/
  app/                    shell, routes, error boundary, providers
  screens/                one file per design screen (22)
    home/  warehouse/  sku/  issue/  review/  docket/  bars/  bar/
    accept/  diff/  received/  waste/  count/  countDone/  variance/
    activity/  movement/  control/  cowork/  more/  reports/  report/
  components/             shared presentational components
    primitives/           Panel, Chip, Stepper, StatusDot, Metric, Pill
    layout/               AppShell, StatusBar, Header, BottomNav, FooterCTA
  services/               use cases — the only place rules and IO compose
    issue.ts  accept.ts  count.ts  waste.ts  transfer.ts  receipt.ts
    posImport.ts  variance.ts  reports.ts
  domain/                 pure functions, no IO
    ledger.ts             position, theoretical closing, the identity
    units.ts              container/ml/case conversion, tare weighing
    variance.ts           variance, signed banding, throughput ranking
    depletion.ts          rate, projection, run-out time
    movement.ts           movement construction and validation
  data/
    repository.ts         the interface
    live/                 Supabase implementation
    fixture/              deterministic fixture implementation
    local/                Dexie schema, outbox, reference cache
    sync/                 engine, ordering, retry, conflict handling
  lib/                    auth, supabase client, config, formatting
  types/                  generated database types
supabase/
  migrations/             schema, RLS, RPCs, views
  tests/                  pgTAP — behavioural, not existence
  seed.sql                deterministic fixture data
docs/                     canonical documentation (this folder)
references/
  design-source/          the recovered design and spec — the UI contract
  ui/                     screen-keyed reference screenshots
```

## Navigation

The design is one state machine with an explicit stack
(`references/design-source/design-script.jsx:18-20`). The router must reproduce
its semantics:

- `go(screen)` pushes the current screen onto a stack.
- `back()` **pops the stack** — it does not navigate home.
- `tab(screen)` navigates and **resets the stack**.
- Flow screens hide the bottom nav and show a sticky footer CTA.

Implement this as router state, not as an ad-hoc `<Link to="/">`.

## Offline-first

See [OFFLINE-SYNC.md](OFFLINE-SYNC.md) for the full contract. The
architectural requirements:

- **Reads work offline.** The reference cache (SKUs, locations, memberships,
  the bar's own ledger) is populated on every successful sync and is the read
  path when the network is gone. A failed live load must never silently fall
  back to fixture data and render it as real festival stock.
- **Cold start works offline.** A staff member who opens the app with no
  network must still reach their bar. Membership and session must be cached.
- **Writes queue durably** in an ordered outbox with stable idempotency keys.
- **Replay is ordered.** A failed earlier movement blocks later ones, so an
  acceptance can never post before its issue.
- **Every screen stamps "as of HH:MM"** from real data, never a literal.

## Security

See [SECURITY.md](SECURITY.md). Architectural requirements:

- Authorisation is enforced in the database. Client-side role checks are a
  usability affordance, never a control.
- The service-role key never reaches this app. Privileged work lives in database
  functions or server-side jobs.
- `sale` movements are writable only by the POS import path.
- Blind-count enforcement is count-scoped and lives in the database.
- QR docket tokens are opaque, hashed at rest, and expiring.

## Quality gates

Every gate runs in CI, and CI is required to merge. A gate that exists only as a
sentence in a document is not a gate.

```bash
pnpm typecheck     # tsc -b, includes sw.ts
pnpm lint          # eslint, max-warnings 0, includes sw.ts
pnpm test          # vitest — domain + services + components
pnpm test:db       # supabase test db — behavioural pgTAP
pnpm build         # production build
pnpm test:visual   # screen captures vs references/ui
```

## What must not happen

| Rule | Why |
| --- | --- |
| No stored stock level as source of truth | [DATA-MODEL.md](DATA-MODEL.md) — the whole audit rests on this |
| No `UPDATE`/`DELETE` on the ledger | Corrections are compensating movements |
| No fixture data inside a screen file | It fakes a passing screenshot |
| No domain function without a caller | Dead code with tests is worse than no code |
| No silent write failure | Stock disappears with a success toast |
| No client-only authorisation | Trivially bypassed |
| No visual deviation from the design source | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) |
| No architecture change without an ADR | [DECISIONS.md](DECISIONS.md) |
| No milestone marked done without its acceptance criteria met | This is how the project got here |

---

See also: [PRODUCT.md](PRODUCT.md) · [DATA-MODEL.md](DATA-MODEL.md) ·
[OFFLINE-SYNC.md](OFFLINE-SYNC.md) · [SECURITY.md](SECURITY.md) ·
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · [ROADMAP.md](ROADMAP.md)

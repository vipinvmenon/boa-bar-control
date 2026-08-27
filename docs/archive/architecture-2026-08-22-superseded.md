> ARCHIVED 27 August 2026. Superseded by `docs/ARCHITECTURE.md`.
>
> This document was written while the design prototype, PowerPoint and written
> specification were unavailable — it says so itself in section 1. Its
> assumptions then hardened into the schema, routes and CSS. It is retained as
> evidence of the root cause described in DECISIONS.md ADR-001, not as guidance.
> Do not build from this file.

# BOA Bar Inventory PWA — Production Architecture Plan

Status: implementation-ready draft  
Prepared: 22 August 2026  
Target: `https://bar.bangaloreopenair.com`

## 1. Artifact review status and assumptions

The referenced ChatGPT task confirms that a specification, PowerPoint design, and HTML prototype were uploaded, but their file bodies are not present in this project mirror and cannot be recovered from the task preview. This plan therefore covers every workflow named in the request, but it cannot claim pixel-level or field-by-field fidelity to those three artifacts.

Before UI implementation, reattach the three files and run a short reconciliation pass. That pass should update route names, labels, screen states, field requirements, and QR docket semantics without changing the core ledger or sync architecture.

Assumptions used here:

- BOA is initially one organization and one venue, but the schema supports multiple venues.
- Inventory includes packaged units and divisible stock such as spirits measured in millilitres.
- A “docket” is an operational stock document—receipt, issue, or transfer—which can be opened or accepted by scanning a QR code.
- Staff may count or record stock where connectivity is intermittent. Security-sensitive finalization still requires a server round-trip.
- POS data initially arrives as CSV/XLSX exports. A direct POS connector can be added later through the same staging model.
- India Standard Time is the venue display timezone, while all stored timestamps are UTC.
- Currency is INR, stored as integer paise. Quantities use exact Postgres `numeric`, never floating point.

## 2. Executive architecture decision

Build a client-heavy, installable PWA that talks directly to Supabase for authorized reads and calls narrowly scoped Postgres RPCs for all inventory commits. Keep drafts and an operation outbox in IndexedDB. Make Postgres the only authority for permissions, ordering, inventory balances, and business invariants.

The inventory record is an append-only ledger:

- committed inventory events and their lines are never edited or deleted;
- a correction is a new reversing or adjusting event;
- mutable workflow records—draft dockets, count sessions, import batches—live outside the ledger;
- a transaction inserts ledger rows and updates derived balance projections together;
- all client retries are safe because every operation has a client-generated idempotency key.

This gives BOA an audit trail, deterministic recalculation, safe offline retries, and a clean migration path from one bar to multiple venues.

## 3. Recommended stack

| Layer | Choice | Rationale |
|---|---|---|
| Web app | React + TypeScript + Vite | Fast, static, installable app with no unnecessary SSR layer. |
| Routing | TanStack Router | Typed routes, search parameters, route guards, and SPA-friendly QR deep links. |
| Remote state | TanStack Query | Request lifecycle, invalidation, retries, and hydration around the local repository layer. |
| Local database | Dexie over IndexedDB | Indexed queries, transactions, versioned migrations, and a durable outbox. |
| Forms/validation | React Hook Form + Zod | Responsive forms and shared runtime validation. |
| UI | Tailwind CSS + shadcn-style local components | Rapid implementation while keeping all components owned in the repository. Reconcile colors/type/spacing with the PowerPoint and prototype. |
| Transient UI state | Zustand, only where React state is insufficient | Do not duplicate server or IndexedDB records in a global store. |
| PWA | `vite-plugin-pwa` in `injectManifest` mode + Workbox | Explicit service-worker control and a versioned app shell. |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions, Realtime | One managed platform with Postgres constraints and RLS as the security boundary. |
| Database changes | Supabase CLI migrations + generated TypeScript types | Reproducible local/staging/production schema. |
| Hosting | Vercel static deployment | Preview deployments, TLS, SPA rewrites, and straightforward custom-subdomain setup. |
| Monitoring | Sentry for web/Edge Functions; Supabase logs/metrics; synthetic uptime check | Covers user-visible failures, backend failures, and availability. |
| Tests | Vitest, Testing Library, fast-check, Playwright, pgTAP | Unit, property, browser/offline, and database/RLS coverage. |
| Package/runtime policy | pnpm; current active-LTS Node pinned in `.nvmrc` and `packageManager` | Deterministic developer and CI environments without freezing this plan to a stale patch version. |

Do not add Next.js merely for hosting or authentication. The application’s hard problem is reliable local data and synchronization, not server rendering. If public marketing pages are later required, host those separately or revisit SSR then.

## 4. System architecture

```text
Staff PWA
  ├─ React feature modules
  ├─ Local repository (Dexie / IndexedDB)
  ├─ Durable mutation outbox
  ├─ Cursor-based sync coordinator
  └─ Service worker (app shell and static assets)
          │
          ├── authorized reads / change pull ──> Supabase Data API + RPC
          ├── idempotent command batches ─────> Postgres RPC functions
          ├── file uploads ───────────────────> private Supabase Storage
          └── optional live invalidations ────> Supabase Realtime

Supabase
  ├─ Auth: individual staff identities and sessions
  ├─ Postgres
  │   ├─ organization, venue, catalog, recipes, memberships
  │   ├─ mutable workflow tables
  │   ├─ immutable inventory_event + inventory_event_line
  │   ├─ derived inventory_balance and reporting views
  │   ├─ sync_change feed
  │   └─ RLS, validation functions, transactional command RPCs
  ├─ Storage: private POS source files and optional docket attachments
  ├─ Edge Functions: POS parsing/integrations and privileged orchestration
  └─ Cron: snapshots, retention, reconciliation checks, backup verification jobs
```

Rules of ownership:

- The browser may use the Supabase publishable key. It must never receive a service-role key.
- Routine reads use RLS-protected tables, security-invoker views, or read RPCs.
- All ledger inserts go through `submit_inventory_operations(...)`; clients receive no direct insert/update/delete grant on ledger tables.
- Edge Functions hold third-party credentials and may use service-role access only for the specific operation they own.
- Realtime is a “something changed” notification. After any gap or reconnect, the client resumes from its durable sync cursor.

## 5. Frontend module structure

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    route-guards.ts
  routes/
    login/
    dashboard/
    inventory/
    receive/
    transfers/
    waste/
    dockets/
    counts/
    pos-imports/
    reports/
    admin/
  features/
    auth/
    catalog/
    inventory-ledger/
    receiving/
    transfers/
    waste/
    dockets/
    blind-counts/
    pos/
    reports/
    users-and-roles/
  domain/
    quantities.ts
    money.ts
    inventory-events.ts
    depletion.ts
    variance.ts
    permissions.ts
    schemas.ts
  data/
    local/
      db.ts
      schema-v1.ts
      repositories/
    remote/
      supabase.ts
      generated-database.types.ts
      commands.ts
      queries.ts
    sync/
      coordinator.ts
      outbox.ts
      pull.ts
      push.ts
      conflict-policy.ts
      connectivity.ts
  components/
    ui/
    layout/
    feedback/
    scanners/
  pwa/
    sw.ts
    registration.ts
    update-policy.ts
  test/
    factories/
    fixtures/
    service-worker/
supabase/
  config.toml
  migrations/
  seed.sql
  functions/
    _shared/
    parse-pos-import/
    pos-provider-webhook/
  tests/
    database/
    rls/
```

Module conventions:

- A feature owns screens, components, use cases, and feature tests. It imports domain primitives and repository interfaces, not raw Supabase calls.
- `domain/` is framework-free TypeScript. Quantities and money are passed as decimal strings or integer minor units at I/O boundaries.
- Only `data/remote` knows Supabase response shapes. Only `data/local` knows Dexie.
- The UI reads from local repositories first. Sync updates local canonical data and TanStack Query invalidates affected selectors.
- Avoid a generic “utils” directory. Put logic with the domain it belongs to.

## 6. Supabase and Postgres data design

Use UUID primary keys generated by the client for offline-created records. Use `timestamptz` for timestamps and explicit `business_date` values for venue reporting days. Every tenant-owned row carries `organization_id`; every operational row also carries `venue_id` where applicable.

### 6.1 Identity and tenancy

| Table | Essential columns |
|---|---|
| `organization` | `id`, `name`, `created_at` |
| `venue` | `id`, `organization_id`, `name`, `timezone`, `currency`, `is_active` |
| `profile` | `user_id` FK to `auth.users`, `display_name`, `status` |
| `membership` | `id`, `organization_id`, `venue_id nullable`, `user_id`, `role`, `status`, `created_at` |
| `device` | `id`, `organization_id`, `venue_id`, `label`, `platform`, `last_seen_at`, `revoked_at` |

A null `venue_id` membership is organization-wide. Add unique constraints that prevent overlapping duplicate memberships.

### 6.2 Locations, catalog, units, and recipes

| Table | Essential columns |
|---|---|
| `inventory_location` | `id`, `venue_id`, `name`, `code`, `kind`, `is_active`, `version` |
| `product` | `id`, `organization_id`, `sku`, `name`, `category`, `base_unit`, `tax_code`, `is_active`, `version` |
| `product_package` | `id`, `product_id`, `name`, `barcode`, `base_quantity`, `is_default_purchase`, `is_sealed_unit`, `version` |
| `supplier` | `id`, `organization_id`, `name`, `contact`, `version` |
| `recipe` | `id`, `venue_id`, `pos_item_id`, `version_number`, `valid_from`, `valid_to`, `yield_rate`, `is_active` |
| `recipe_line` | `id`, `recipe_id`, `product_id`, `quantity_base`, `waste_factor`, `substitution_group` |
| `pos_item` | `id`, `venue_id`, `provider`, `external_id`, `name`, `is_active`, `version` |

`base_unit` is a constrained enum such as `ml`, `g`, or `each`. A product never changes base unit after it has ledger activity; replacing it requires a new product record. `base_quantity` and all inventory quantities use `numeric(20,3)`. Barcode uniqueness is scoped to the organization.

### 6.3 Mutable workflows

| Table | Purpose |
|---|---|
| `docket` / `docket_line` | Draft/issued/accepted/cancelled stock documents before ledger commit. |
| `count_session` / `count_scope` / `count_observation` | Blind count lifecycle and raw observations. |
| `pos_import_batch` / `pos_import_row` / `pos_import_error` | Raw import, validation, mapping, and commit status. |
| `pos_item_mapping` | Provider item to BOA recipe/product mapping. |
| `attachment` | Metadata for private Storage objects. |
| `approval` | Optional dual-control approval record for high-variance counts or overrides. |

Workflow tables use a `version bigint` for optimistic concurrency. Terminal records are not reopened. A correction creates a new workflow or ledger reversal.

## 7. Append-only inventory ledger

### 7.1 Ledger tables

`inventory_event`:

- `id uuid primary key` — client-generated UUID;
- `organization_id`, `venue_id`;
- `server_seq bigint generated always as identity` — canonical incremental cursor;
- `event_type` — `opening`, `receipt`, `transfer`, `pos_depletion`, `waste`, `count_adjustment`, `manual_adjustment`, `reversal`;
- `occurred_at`, `business_date`, `received_at default now()`;
- `actor_user_id`, `device_id`, `device_seq`;
- `idempotency_key uuid not null`;
- `source_type`, `source_id`, `correlation_id`;
- `reverses_event_id nullable`;
- `reason_code`, `notes`, `metadata jsonb`;
- unique `(organization_id, idempotency_key)` and `(device_id, device_seq)`.

`inventory_event_line`:

- `id uuid primary key`, `event_id`;
- `product_id`, `location_id`;
- `quantity_delta numeric(20,3)` — positive adds stock; negative removes it;
- `value_delta_minor bigint` — signed paise value movement when known;
- `unit_cost_minor bigint nullable`;
- `package_id nullable`, `lot_code nullable`, `expiry_date nullable`;
- `metadata jsonb` for immutable recipe/import references.

`inventory_balance` is a mutable projection keyed by `(venue_id, location_id, product_id)`, with `quantity`, `inventory_value_minor`, `weighted_average_cost_minor`, `last_server_seq`, and `updated_at`. Only the ledger commit function may change it.

`inventory_daily_snapshot` stores closing projections by venue business date for faster reports. It is derived and rebuildable.

### 7.2 Invariants

- Runtime roles cannot update or delete either ledger table. Database triggers also reject mutation attempts from runtime roles.
- Event header, lines, projection updates, sync-feed entries, workflow finalization, and approvals commit in one Postgres transaction.
- Transfers have at least two lines and net to zero per product across source/destination locations.
- A reversal points to one prior event and has exact opposite lines. A unique constraint prevents reversing the same event twice unless an explicit partial-reversal model is later introduced.
- Negative stock is rejected by default. `inventory_manager` may use a specific override permission and must provide a reason; the override is recorded in event metadata and an alert is emitted.
- `occurred_at` may be client-supplied within an allowed window, but `received_at` and `server_seq` are always server-generated. Historical backdating beyond the window requires manager permission.
- Quantity scales and unit compatibility are validated in Postgres, not only in Zod.
- Master records referenced by a ledger event are never hard-deleted.

### 7.3 Commit function

Expose a single versioned RPC such as:

```sql
submit_inventory_operations(p_schema_version int, p_operations jsonb)
```

For each operation it must:

1. Read `auth.uid()` and resolve active membership inside the function; never trust role, actor, organization, or venue values supplied by the client.
2. Return the prior canonical result if the idempotency key already exists.
3. Validate operation shape, allowed event type, workflow state, units, locations, and permission.
4. Acquire transaction-scoped advisory locks for the affected `(venue, location, product)` keys in sorted order.
5. Calculate value deltas and check negative-stock policy against the current projection.
6. Insert the immutable event and lines.
7. Update `inventory_balance` and append `sync_change` rows.
8. Finalize the related docket/count/import workflow.
9. Return `event_id`, `server_seq`, canonical balances, and a stable per-operation result code.

Start with batches of at most 100 operations or 1 MB. Return independent results only when operations are independent; dependent operations are submitted as one atomic command. Do not silently partially post a single docket, count, or import commit.

### 7.4 Rebuild and reconciliation

Provide a privileged SQL function or maintenance script that rebuilds balances from ledger lines into a temporary table and compares it with `inventory_balance`. Run a nightly reconciliation check. Any mismatch pages an operator; do not automatically overwrite production balances. A controlled repair can swap in a verified rebuild during maintenance.

## 8. Offline-first local data model

Dexie stores only the current venue and only data necessary for operations:

| Store | Key/content |
|---|---|
| `catalog` | Products, packages, barcodes, active recipe summaries. |
| `locations` | Authorized venue locations. |
| `balances` | Last canonical balance projection where the role is allowed to see it. |
| `workflows` | Cached dockets, count sessions, and import summaries. |
| `drafts` | Device-local editable forms and count observations. |
| `outbox` | Durable mutation envelopes and state. |
| `syncState` | Cursor, schema version, last successful pull/push, validated user and venue. |
| `conflicts` | Rejected operations and user-resolvable copies. |
| `tombstones` | Deleted/deactivated sync records until the client has applied them. |

Never cache POS source files or broad employee data in IndexedDB. Provide “Clear offline data” and automatically purge venue data on sign-out, device revocation, or venue switch. Avoid logging inventory payloads to console or analytics.

### 8.1 Outbox envelope

```ts
type PendingOperation = {
  operationId: string;       // UUID, also the server idempotency key
  schemaVersion: number;
  organizationId: string;
  venueId: string;
  userId: string;
  deviceId: string;
  deviceSeq: number;
  kind: string;
  payload: unknown;
  baseVersion?: number;      // for mutable workflow/master data
  dependsOn?: string[];
  createdAtClient: string;
  state: 'pending' | 'inflight' | 'applied' | 'blocked' | 'dead-letter';
  attempts: number;
  lastErrorCode?: string;
};
```

The local draft update and outbox insert happen in one IndexedDB transaction. `inflight` is recoverable: on restart it returns to `pending` and idempotency prevents double posting.

### 8.2 Change feed

Use an append-only `sync_change` table with `seq`, tenant/venue, entity type, entity id, operation, entity version, changed time, and a bounded canonical payload or tombstone. Every server mutation adds feed entries in the same transaction.

`pull_changes(venue_id, after_seq, limit)` rechecks membership and returns only permitted entities. The response includes `next_cursor`, `has_more`, and `server_time`. Keep feed retention comfortably longer than the longest expected offline period—for example 90 days. If a cursor predates retention, return `FULL_RESYNC_REQUIRED` and replace the local canonical cache while preserving unsent drafts/outbox.

Realtime may prompt an immediate pull, but the durable cursor handles missed messages and long offline periods.

### 8.3 Sync order and retry rules

On login, app launch, foreground, `online`, manual retry, and a Realtime nudge:

1. Acquire a single cross-tab Web Lock; if unavailable, another tab is syncing.
2. Refresh/validate the Supabase session online.
3. Pull membership, device status, schema compatibility, and changes since the cursor.
4. Apply changes to IndexedDB transactionally and advance the cursor only after success.
5. Select dependency-ready outbox items in `deviceSeq` order and push a bounded batch.
6. Mark accepted/duplicate operations applied; copy canonical results locally.
7. Mark permission/validation failures blocked for user action. Retry network, `429`, and `5xx` failures with exponential backoff and jitter. Never retry ordinary `4xx` validation failures indefinitely.
8. Pull again until caught up, because the push may have generated changes and other devices may have written concurrently.

Inventory events are additive and idempotent, so they do not use last-write-wins. Mutable dockets/catalog records use `baseVersion`; a version mismatch creates a visible conflict. Automatic field merging is limited to explicitly safe fields such as an unsent local note.

### 8.4 Offline authorization policy

An already signed-in user may view authorized cached data and continue an existing local draft for up to a configured offline grace period after the last successful permission check. All offline changes are visibly labelled “Pending sync.” The server re-authorizes every push.

Require online connectivity for:

- first login and venue/device enrollment;
- starting or finalizing a count session;
- accepting/redeeming a QR docket;
- POS import commit;
- role or catalog changes;
- manager overrides and approvals.

If the cached session is expired or the grace period has passed, allow export/recovery of unsent drafts but prevent new operational changes until the session is validated.

Do not depend on Workbox Background Sync to post ledger operations. A queued raw request can contain an expired bearer token, and browser support is uneven. The app-owned Dexie outbox refreshes authentication before replay. Service-worker background sync may only wake or notify the app opportunistically.

## 9. Authentication, RBAC, and RLS

Use individual Supabase Auth accounts; never a shared “bar” login. Start with admin-invited email/password or email OTP according to BOA’s staff process. Require MFA for `owner` and `admin`; support it for managers. Configure session lifetime, inactivity timeout, and single-session policy based on shared-device risk.

Roles and minimum capabilities:

| Role | Capabilities |
|---|---|
| `owner` | Organization settings, all venues, membership administration, approvals, reports. |
| `admin` | Venue/catalog/user administration, all operations and reports, no ownership transfer. |
| `inventory_manager` | Receipts, transfers, waste, dockets, counts, POS import, adjustments, operational reports. |
| `operator` | Assigned receipts/transfers/waste/dockets; cannot adjust or see admin reports. |
| `counter` | Assigned blind count sessions and product/location labels only; no expected balances. |
| `auditor` | Read-only ledger, workflow history, and reports. |

RLS design:

- Enable RLS on every exposed table, including Storage metadata policies.
- Policies specify `TO authenticated`, filter by active membership, and use indexed tenant/venue columns.
- Put authorization helpers such as `private.has_venue_permission(venue_id, permission)` in an unexposed `private` schema. Security-definer functions set a fixed `search_path`, fully qualify tables, and expose only required execute grants.
- Do not put roles in user-editable `raw_user_meta_data`. Membership tables remain the source of truth; JWT app metadata may be a cache only.
- Use `security_invoker = true` for exposed reporting views, or revoke direct access and expose a guarded RPC.
- A counter cannot select `inventory_balance`, ledger lines, variance reports, or fields that reveal expected quantities. Blind-count RPCs return only count scope, product labels, package conversions, and the counter’s own observations.
- QR tokens grant no anonymous inventory access. The scan route requires authentication; a server RPC resolves the token and rechecks membership and docket status.
- Private Storage object paths begin with organization/venue IDs and are protected by matching membership policies. Use short-lived signed URLs only when a direct authorized download is insufficient.

Add pgTAP tests for every table/role/action combination, including cross-tenant denial and direct ledger mutation denial.

## 10. QR docket flow

Use an opaque 128-bit random token. Store only `sha256(token)` in `docket.public_token_hash`; the QR contains:

```text
https://bar.bangaloreopenair.com/d/<token>
```

Flow:

1. An authorized user creates a draft docket and lines. Draft editing uses optimistic versioning.
2. “Issue QR” validates the docket, generates token hash and expiry server-side, changes status to `issued`, and returns the token once for QR rendering.
3. The recipient scans the code. The SPA deep link survives Vercel rewrite to `index.html`.
4. If signed out, the app preserves the intended route through login. After authentication it calls `resolve_docket_token(token)`.
5. The RPC hashes the token, rate-limits attempts, checks expiry/status/venue membership, and returns the minimum docket preview.
6. The user reviews quantities and destination. “Accept” requires online connectivity and calls an idempotent transactional RPC.
7. The RPC commits receipt or transfer ledger events, marks the docket accepted, records accepter/device/time, and invalidates the token.
8. A pre-acceptance cancellation changes the workflow state. A post-acceptance correction creates a reversal or new adjustment; it never rewrites the committed event.

Do not put product quantities, IDs, staff identity, or predictable docket numbers in the QR. Add a human-readable docket number separately. Log token resolution failures without logging the token itself.

## 11. Blind counts

### 11.1 Lifecycle

`draft → active → submitted → approved` or `cancelled`.

1. A manager defines venue, locations, products/categories, counters, and variance thresholds.
2. Starting a session is online-only. The server records `cutoff_server_seq`, server time, scope, and a workflow lock for affected locations.
3. For the first release, enforce a hard operational lock: no receipt, transfer, waste, or POS posting against a locked location until count submission/cancellation. This avoids ambiguous “stock moved while counting” reconciliation.
4. Counters download the scope and count offline. They see product/package information, not expected stock or variance. Each observation records sealed package counts, loose base quantity, optional note/photo, counter, and client timestamp.
5. Local observations save immediately to Dexie and queue to the server when possible. The submitted total is computed from raw observations; raw records remain auditable.
6. Final submit is online-only. The server verifies complete scope, no late location movement, and calculates expected balance as of `cutoff_server_seq`.
7. `variance = observed - expected`. Within threshold, approval can be automatic; above threshold requires a manager who did not perform the count.
8. Approval appends a `count_adjustment` event whose delta equals the variance, making the projected balance equal the physical count, then releases the lock.
9. A correction requires a new count/recount or reversal; submitted observations are immutable.

If uninterrupted operational locks are unacceptable, implement movement-aware counting as a later feature with explicit movement capture and a second reconciliation pass. Do not mix both models in MVP.

### 11.2 Blindness enforcement

Blindness is not just hidden UI. The assigned `counter` role receives no RLS access to balances, ledger, prior counts, or reports during the session. If a manager performs a count using a manager account, it is only “UI blind,” because that person can access expected stock elsewhere; record this distinction in the audit trail.

## 12. POS import and recipe depletion

### 12.1 Import pipeline

1. Upload the original file to a private `pos-imports` bucket using a generated path; set file type and size limits.
2. Create `pos_import_batch` with provider, venue, timezone, business-date range, file checksum, uploader, and status.
3. An Edge Function parses into normalized staging rows. Keep provider adapters separate from validation. For large files, chunk rows and checkpoint progress rather than relying on one long function invocation.
4. Normalize timestamps to UTC plus venue `business_date`; normalize quantity, gross/net amount, void/refund status, and external IDs.
5. Deduplicate first by `(venue, provider, external_line_id)`. Where the provider has no stable row ID, use a documented hash of provider, business date, receipt number, item, quantity, amount, and row index, plus a unique batch checksum.
6. Map every POS item to an active recipe or explicitly excluded non-stock item. Unknowns remain in “Needs mapping”; nothing posts silently.
7. Preview totals, duplicates, errors, unmapped rows, and projected stock impact.
8. Commit online via `commit_pos_import(batch_id, idempotency_key)`. The transaction locks the batch, expands the recipe version valid at sale time, aggregates immutable depletion lines, inserts ledger events, and marks rows committed.
9. Re-importing the same rows returns duplicate results without new ledger activity. Later voids/refunds produce positive reversing depletion lines referencing the original source where possible.

Keep source rows and the exact recipe version/component quantities used for every commit. Editing a recipe must not change historical depletion.

### 12.2 Direct integration later

A provider webhook or scheduled fetch writes into the same `pos_import_batch`/row staging tables, so mapping, deduplication, preview, and commit behavior remain identical. Third-party API secrets live only in Edge Function secrets.

## 13. Inventory, variance, and depletion calculations

Sign convention: positive ledger quantity adds stock; negative quantity removes it.

For a product/location at a point in time:

```text
book quantity = SUM(inventory_event_line.quantity_delta up to server_seq)
```

For a reporting period:

```text
book closing
  = opening
  + receipts
  + transfers in
  - transfers out
  - POS theoretical depletion
  - recorded waste/comps
  + other approved adjustments

count variance quantity = physical observed closing - book closing before count adjustment
count adjustment delta  = count variance quantity

gross physical usage
  = opening + receipts + transfers in - transfers out - physical closing

unexplained usage
  = gross physical usage - POS theoretical depletion - recorded waste/comps
```

For each sale row and recipe component:

```text
component depletion
  = sold quantity × recipe component base quantity × (1 + waste_factor)
    ÷ yield_rate
```

Default `waste_factor = 0` and `yield_rate = 1`. Require explicit configuration and show both in import preview; otherwise they become invisible knobs that hide variance.

```text
variance percentage
  = variance quantity / ABS(book closing before adjustment) × 100
```

Return percentage as null—not infinity—when book quantity is inside a configurable near-zero threshold. Always show absolute quantity and value beside percentages.

Use weighted-average cost per product/location initially:

```text
new average cost
  = (old inventory value + received quantity × receipt unit cost)
    / (old quantity + received quantity)
```

Outbound lines remove value at current weighted-average cost. Transfers carry the source cost to the destination. Count/manual adjustments use current average cost unless an authorized valuation correction is explicitly recorded. Store finalized `value_delta_minor` on ledger lines so later cost changes do not rewrite history.

Perform all authoritative calculations in Postgres `numeric`/integer arithmetic. Mirror them in TypeScript for previews and test both implementations against shared fixtures.

## 14. PWA and service-worker strategy

Use `injectManifest` so `src/pwa/sw.ts` is reviewed like application code.

Caching policy:

| Resource | Strategy |
|---|---|
| Hashed JS/CSS, icons, local fonts, manifest | Precache; immutable cache entries. |
| HTML navigation/app shell | Network-first with short timeout, then cached shell fallback. |
| Product thumbnails/static public images | Stale-while-revalidate or cache-first with size/age limits. |
| Supabase Auth/Data/RPC requests | Do not place in generic Cache Storage. The repository and IndexedDB own data freshness. |
| Private Storage files and signed URLs | Network only unless a specific encrypted/offline attachment feature is designed. |
| POST mutations | Dexie outbox, not Workbox request replay. |

Additional requirements:

- Provide 192px/512px and maskable icons, `display: standalone`, theme/background colors, and an offline fallback route.
- Do not auto-activate a new service worker while unsent operations or dirty drafts exist. Show “Update available”; activate after queues are safe, then reload.
- Version Dexie schema independently from command payload schema. Include explicit migrations and a minimum-supported-client version returned by the server.
- Show connection and sync state globally: online/offline, last synced time, pending count, blocked count.
- Test installation and updates on Android Chrome and iOS Safari. iOS background execution is opportunistic; foreground/online event sync remains mandatory.
- Keep the install bundle lean. Scanner and import-preview code may be route-split.

## 15. Deployment to `bar.bangaloreopenair.com`

Environments:

- local: local Supabase stack and seeded users/data;
- staging: separate Supabase project and Vercel preview/staging deployment;
- production: dedicated Supabase project and Vercel production project.

Never point preview deployments at production Supabase. Configure environment-specific Auth redirect allowlists and CORS origins.

Vercel configuration:

- build command `pnpm build`, output `dist`;
- SPA rewrite all non-file routes, including `/d/*`, to `/index.html`;
- security headers: strict CSP tailored to Vercel/Supabase/Sentry, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` allowing camera only for same-origin scanner pages;
- immutable long-cache headers for hashed assets; no-cache for HTML and service worker;
- production environment variables contain only the Supabase URL, publishable key, Sentry DSN, release, and feature flags—never service-role or database credentials.

Domain cutover:

1. Add `bar.bangaloreopenair.com` to the Vercel production project.
2. Ask Vercel for the exact required DNS record. At the current DNS provider, add the displayed `bar` CNAME; do not replace unrelated apex/MX records.
3. Verify ownership if prompted and wait for managed TLS issuance.
4. Add the production URL to Supabase Auth site URL and redirect allowlist.
5. Verify QR deep link, login callback, manifest, service worker scope, CSP, and offline launch on the real origin.
6. Lower DNS TTL ahead of cutover, keep staging available, and retain a rollback deployment.

## 16. Observability, audit, and backups

### 16.1 Observability

- Sentry browser errors, unhandled promise rejections, route performance, release/source maps, and Edge Function exceptions. Scrub tokens, emails, QR values, notes, file contents, and full inventory payloads.
- Add a correlation ID from client command through Edge Function/RPC and ledger event metadata. Show it in support errors.
- Metrics: active devices, sync success/failure latency, oldest pending operation, blocked/dead-letter count, command result codes, negative-stock overrides, reconciliation mismatches, import duration/error rate, count duration and high-variance approvals.
- Supabase logs/metrics for database saturation, slow queries, function failures, Auth anomalies, and Storage errors.
- External uptime checks for the app shell and a lightweight authenticated health workflow in staging. A public health endpoint must not expose database details.
- Nightly alerts for balance-rebuild mismatch, stuck workflow locks, stale import batches, and sync-feed retention/cursor risk.
- Maintain an operational audit view combining actor, role, device, source workflow, immutable event, approval, and correlation ID.

### 16.2 Backups and recovery

- Use a paid Supabase plan for production. Enable PITR when the acceptable recovery point is shorter than daily backup coverage; document the selected RPO/RTO.
- Nightly encrypted logical export of schema and business tables to storage outside the Supabase project. Storage objects are not restored by a database backup, so separately replicate original POS files and attachments.
- Retain migration history, seed fixtures without production data, deployment releases, and configuration in Git.
- Quarterly restore drill into an isolated project: restore database and files, run ledger-to-balance reconciliation, exercise login and a read-only report, record actual RPO/RTO.
- Before high-risk migrations or imports, verify a recent recovery point and use expand/migrate/contract schema changes.

## 17. Testing strategy

### 17.1 Unit and property tests

- quantity/package conversions, money rounding, recipe expansion, weighted-average costing, business-date/timezone logic;
- variance/depletion formulas and near-zero percentage behavior;
- operation dependency sorting, retry classification, and local Dexie migrations;
- fast-check properties: event plus reversal nets to zero, transfer nets to zero, idempotent replay changes balance once, aggregation order does not change exact totals.

### 17.2 Database tests

- pgTAP for constraints, grants, RLS, security-definer functions, and every role matrix entry;
- commit RPC tests for idempotency, concurrency, negative stock, unit mismatch, backdating, immutable ledger, and atomic workflow finalization;
- cross-tenant and cross-venue access denial;
- deterministic balance rebuild equals projection after randomized event sequences;
- POS duplicate/refund and recipe-version tests;
- blind count tests proving counters cannot query expected values.

### 17.3 Integration and end-to-end tests

- React Testing Library for forms, scanner fallback/manual token entry, blind fields, sync banners, and conflict recovery;
- Playwright against local Supabase for login, receipt, transfer, docket scan/accept, count, POS preview/commit, report, and role restrictions;
- offline scenarios: kill network mid-submit, reload with inflight operations, retry after token refresh, two tabs, cursor expiry/full resync, device revocation, app update with pending work;
- concurrency scenarios: two devices post against the same balance, duplicate scans, count lock versus receipt, import commit double-click;
- PWA checks: installability, navigation fallback, cache headers, new release activation, iOS/Android smoke test;
- accessibility: keyboard/focus, scanner alternative, 44px touch targets, contrast, semantic labels, screen-reader status announcements.

CI gates every pull request with format/lint, typecheck, unit/property tests, a clean Supabase reset plus pgTAP, production build, and a focused Playwright suite. Run the full browser/offline matrix before production promotion.

## 18. Environment and developer setup

Repository-owned files:

```text
.env.example                 # safe names/placeholders only
.nvmrc
package.json                 # packageManager pins pnpm
pnpm-lock.yaml
vite.config.ts
vercel.json
supabase/config.toml
supabase/migrations/*.sql
supabase/seed.sql
supabase/tests/**/*.sql
```

Environment variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=
VITE_APP_ENV=local|staging|production
VITE_RELEASE=
```

Secrets such as Supabase access tokens, database passwords, service-role keys, POS credentials, and Sentry auth tokens belong in CI/Vercel/Supabase secret stores, never in `VITE_*` variables or the repository.

Local workflow:

1. Install the pinned active-LTS Node and pnpm version; install Docker and Supabase CLI.
2. Copy `.env.example` to `.env.local`.
3. Start local Supabase, reset migrations/seeds, and generate TypeScript database types.
4. Run the Vite app against the local project.
5. Use seed accounts for every role and a representative catalog, recipe, docket, count, and POS file.
6. Before commit, run lint, types, unit tests, database tests, and build.

Database migrations are forward-only and code-reviewed. CI recreates the local database from all migrations. Deployment applies migrations to staging first, runs smoke tests, then promotes production using an explicit approval. Backward-compatible database changes land before web code that depends on them.

## 19. Phased implementation order

### Phase 0 — Artifact reconciliation and decisions

- Reattach and inspect the spec, PowerPoint, and HTML prototype.
- Produce screen/route inventory and a field/role/workflow matrix.
- Confirm QR docket meaning, POS export format/provider, count-lock policy, units, locations, and approval thresholds.
- Record decisions in `docs/adr/` and update this document.

Exit: no unresolved ambiguity changes ledger event types, security roles, or count semantics.

### Phase 1 — Foundation and security skeleton

- Scaffold React/Vite/TypeScript, routing, UI tokens, test stack, CI, Vercel preview.
- Initialize Supabase migrations/seeds/types.
- Implement organization, venue, profile, membership, device, catalog, units, and role helpers.
- Implement login, venue selection, route guards, RLS tests, and no-op PWA install shell.

Exit: every seeded role sees only permitted venue data; cross-tenant tests pass; app installs and launches offline to a safe shell.

### Phase 2 — Ledger core and projections

- Create immutable ledger, balances, commit RPC, reversal, reconciliation function, and reporting primitives.
- Implement receipt, transfer, waste, and manual adjustment domain commands without offline queue first.
- Add costing/formula fixtures and property/database concurrency tests.

Exit: idempotent retry posts once, direct mutation is denied, reversal nets to zero, and rebuild matches projection.

### Phase 3 — Offline repository and sync

- Add Dexie schema, local-first repositories, outbox, change feed, cursor pull, push, conflicts, full resync, and sync UI.
- Add service-worker cache/update policy.
- Exercise network loss, reload, token refresh, two-tab, and old-client scenarios.

Exit: receipt/transfer/waste captured offline survive reload and synchronize exactly once.

### Phase 4 — QR dockets

- Implement docket workflow, QR issue/resolve/accept, deep links, token hashing/expiry, scanner/manual fallback, and audit.

Exit: duplicate acceptance and expired/foreign tokens cannot post; accepted docket produces exactly one ledger transaction.

### Phase 5 — Blind counts

- Implement scoped count sessions, location locks, offline observations, submission, threshold approval, adjustments, and count reports.

Exit: counter cannot retrieve expected stock; movement lock is enforced; approved count sets book balance to physical quantity.

### Phase 6 — POS, recipes, and depletion

- Implement recipe versioning, private upload, provider parser, staging/mapping/preview, deduplication, commit, void/refund, and depletion reports.

Exit: fixture export reconciles to expected ingredient depletion and a second import is a no-op.

### Phase 7 — Reporting, hardening, and production launch

- Complete variance/depletion dashboards, exports, audit views, accessibility, Sentry/metrics/alerts, backup automation, and restore drill.
- Run load/concurrency/security/offline device matrix.
- Configure domain, TLS, Auth URLs, CSP, production data setup, staff training, rollback, and support runbook.

Exit: signed launch checklist, successful restore drill, no critical test/accessibility/security defects, and monitored production smoke test.

Do not build dashboard polish before ledger, RLS, and offline retry invariants are proven.

## 20. Definition of done for production

- Every inventory-affecting action is an immutable, attributable ledger event.
- Same client operation can be retried any number of times and affects stock once.
- No role can cross organization/venue boundaries; direct ledger mutation is denied.
- A device can capture supported work offline, reload, and later sync without loss.
- Blind counters cannot retrieve expected quantities through UI or API.
- QR redemption is authenticated, expiring, rate-limited, and idempotent.
- POS duplicates and refunds are deterministic and traceable to source row and recipe version.
- Balance projection can be independently rebuilt and compared with zero mismatch.
- App shell, QR deep links, update flow, and offline fallback work on supported iOS/Android devices.
- Monitoring identifies failed syncs and reconciliation mismatches; backup and file restore have been proven.
- Staging and production are isolated; secrets never enter the client bundle.

## 21. Open decisions to resolve from the artifacts/business owner

1. Exact meaning and types of “QR docket”: receipt, inter-bar transfer, supplier delivery, issue to counter, or all of these.
2. POS vendor(s), export sample, stable transaction/line IDs, void/refund behavior, and business-day cutoff.
3. Product units and open-bottle measurement method: direct ml, bottle fraction, calibrated scale, or all.
4. Locations and whether a hard movement lock during blind counts is operationally acceptable.
5. Role names and which staff may see on-hand values, costs, and variance.
6. Approval thresholds for count variance, negative stock, and backdated events.
7. Required retention for POS source files, attachments, audit logs, and sync feed.
8. Existing DNS host and Vercel/Supabase accounts, budget, required RPO/RTO, and support owner.
9. Browser/device support floor and whether shared tablets require local device enrollment or rapid user switching.
10. Visual tokens, routes, field labels, and responsive behavior from the unavailable PowerPoint/HTML prototype.

None of these should be answered by silently changing ledger history or weakening RLS. Use explicit ADRs and configuration where possible.

## 22. Codex-ready starting brief

Copy the following into a new Codex build task after placing the spec, PowerPoint, and HTML prototype in a read-only `references/` directory:

```text
Build Phases 0–2 of the BOA Bar Inventory production PWA described in
BOA_PWA_ARCHITECTURE_PLAN.md.

First inspect every file under references/ and create docs/artifact-reconciliation.md containing:
- a screen/route inventory;
- a field and validation matrix;
- a role/workflow matrix;
- differences between the artifacts and the architecture plan;
- explicit blockers only where a choice would change ledger, security, or count semantics.

Then implement the foundation and ledger core. Use React + TypeScript + Vite,
TanStack Router/Query, Tailwind with locally owned UI components, Supabase, Vitest,
Playwright, and pgTAP. Pin the current active-LTS Node and pnpm. Do not add Next.js.

Required repository outcomes:
- installable PWA shell and SPA routes, with design tokens reconciled from the artifacts;
- local Supabase configuration, forward-only migrations, deterministic seed data, and
  generated TypeScript database types;
- organization, venue, profile, membership, device, location, product, package, recipe,
  and POS item foundations;
- individual authentication, venue selection, permission helpers, RLS on every exposed
  table, and pgTAP tests for all roles and cross-tenant denial;
- immutable inventory_event and inventory_event_line tables, inventory_balance projection,
  idempotent transactional submit_inventory_operations RPC, reversal support, negative-stock
  policy, and a balance rebuild/reconciliation function;
- thin usable flows for receipt, transfer, waste, and manager adjustment while online;
- domain tests for exact quantity/money arithmetic, variance/depletion formulas, costing,
  reversals, transfers, idempotency, and concurrent commits;
- CI for lint, typecheck, unit/property tests, clean Supabase reset + pgTAP, build, and focused E2E.

Non-negotiable constraints:
- inventory ledger rows are append-only; corrections are new events;
- clients have no direct ledger table mutation grants;
- the service-role key never reaches the browser;
- server derives identity, membership, organization, venue permission, timestamps, and
  ordering instead of trusting client claims;
- quantities use exact decimal arithmetic and money uses integer paise;
- all retries are safe through client UUID idempotency keys;
- views are security-invoker or accessible only through guarded RPCs;
- preserve reference files and unrelated user changes;
- do not implement the offline outbox, QR dockets, blind counts, or POS commit yet except
  for interfaces/schema seams explicitly required by Phases 1–2.

Work in small verified slices. Before finishing, run the full Phase 1–2 test suite, inspect
the production build, and report migrations, security decisions, test results, remaining
artifact conflicts, and the exact next Phase 3 entry point.
```

## 23. Primary references

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database testing with pgTAP](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Realtime architecture](https://supabase.com/docs/guides/realtime/architecture)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase database backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Vite PWA Workbox integration](https://vite-pwa-org.netlify.app/workbox/)
- [Workbox Background Sync behavior](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync)
- [Vercel custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain)

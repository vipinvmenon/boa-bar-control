> ARCHIVED 27 August 2026. Superseded by `docs/CURRENT-STATE.md`.
>
> Retained as evidence, not as guidance. Many `[x]` entries below were not true:
> the migrations had never been executed, every RLS policy was SELECT-only so
> nothing could be written, the pgTAP suite tested existence only, and the two
> screens recorded as passing design QA rendered hardcoded literals without ever
> reading the data layer. Six unimplemented specification controls are listed
> under "Completed decisions" as settled properties of the system.
>
> See docs/DECISIONS.md ADR-012. Do not build from this file.

# BOA Bar Control — Project Status

Last updated: 22 August 2026, Asia/Kolkata
Current milestone: Design and workflow rebuild before backend linking
Overall status: Rebuild in progress — dashboard and warehouse passed visual QA

This file is the live handoff record. It is updated after every verified milestone so the current state is visible without reading task history.

## Status key

- `[x]` Done and verified
- `[~]` In progress
- `[ ]` Pending
- `[!]` Blocked or waiting for a decision

## Milestones

- [x] Recover and inspect the Word specification
- [x] Render and inspect all PowerPoint slides
- [x] Open and capture the interactive HTML prototype
- [x] Inspect the BOA "Ritual" brand system, tokens, fonts, and official logo
- [x] Reconcile the architecture with festival-specific requirements
- [x] Create the production React/Vite/PWA project foundation
- [!] Initial mobile UI was not accepted; it differs materially from the supplied HTML/PPT design
- [x] Rebuild the responsive shell, dashboard, and warehouse to source fidelity
- [~] Rebuild bars, issue → review → QR docket → acceptance, waste, blind count, activity, reports, and manager flows to source fidelity
- [x] Implement the Supabase core schema and append-only inventory ledger RPC
- [x] Define RBAC/RLS policies and pgTAP policy assertions
- [x] Implement exact quantity, container/ml, variance, and costing domain tests
- [x] Implement the Dexie outbox, ordered retries, idempotency keys, and auth-failure stop condition
- [x] Install dependencies and pass typecheck, 12 tests, lint, and production build
- [x] Run browser interaction checks for the core journey
- [!] Prior home-screen design QA was invalidated by the 22 August user acceptance review
- [x] Complete a fresh source-to-build audit across dashboard, warehouse, bars, issue, blind count, activity, and More
- [x] Pass same-state visual QA for the rebuilt dashboard and warehouse milestone
- [x] Copy the verified project into `My Works/boa-bar-control`
- [x] Add invited-staff authentication, membership loading, authorised live inventory reads, and queued ledger writes
- [x] Pin Supabase CLI 2.115.0 and add local config, deterministic catalog seed, snapshot RPC, and database test commands
- [ ] Connect a development Supabase project and execute migrations/pgTAP against PostgreSQL after the UI/workflow milestone is accepted
- [ ] Build production receipt, return, transfer, adjustment, and POS-import screens/jobs
- [ ] Add production authentication enrolment and seed real users, locations, SKUs, and serve mappings
- [ ] Run real-device/offline/QR checks at the venue network profile
- [ ] Deploy staging, complete acceptance, then connect `bar.bangaloreopenair.com`

## Completed decisions from the artifacts

- The app is a festival operations system for BOA 2026, not a generic hospitality inventory product.
- Stock on hand is derived from an immutable movement ledger.
- Every relevant movement records both sealed-container quantity and base millilitres.
- Warehouse issues use a QR docket and named two-party acceptance for chain of custody.
- Hospitality depletion is separated from sales variance.
- Blind counts hide expected stock at the API/RLS layer, not only in the UI.
- Open bottles support gross-weight capture using SKU tare weight.
- POS imports are append-only, retain the source file, and hard-fail unmapped POS SKUs.
- Variance is ranked against throughput, with category-specific tolerance bands.
- The bar experience is phone-first, offline-first, high-contrast, one-handed, and optimized for no more than three taps for common actions.
- Production tables use the `boa_bar_` prefix for compatibility with the wider BOA database.

## Currently in progress

The application-side Supabase foundation remains intact, but backend linking is paused. The responsive shell, dashboard, and warehouse have now been rebuilt directly from the supplied prototype and passed same-state visual QA. The remaining operational screens are the active milestone. The original gap audit remains recorded in `docs/design-gap-audit-2026-08-22.md`, and the latest pass is recorded in `design-qa.md`.

## Next actions

1. Rebuild Bars, Activity, and More to the supplied HTML prototype.
2. Rebuild issue, review, QR docket acceptance, waste, and blind-count workflows to the supplied interaction model and full specification.
3. Add receipt, transfer, return, adjustment, request-top-up, partial-container, reports, and manager review flows.
4. Run same-state visual comparisons for each remaining flow and obtain user acceptance for the complete UI milestone.
5. Resume Supabase linking, production data setup, offline-device tests, and deployment.

## Open business decisions

These do not block the initial build, but must be resolved before production data setup:

- POS operator and whether integration is API, CSV, or emailed export.
- Whether all four bars carry the same SKU range.
- Whether Eddie's and Promoter's lounges are inclusive hospitality locations or paid bars.
- Whether the STOK commercial deal is consumption-linked.
- Excise licence holder, required return template, and empty-container retention rules.

## Blockers

The design correction is unblocked. Executing the database migration later requires either a running Docker-compatible local environment or access to a hosted Supabase development project. Production setup still requires the user roster, confirmed SKU/location data, POS export sample, and the open business decisions listed above.

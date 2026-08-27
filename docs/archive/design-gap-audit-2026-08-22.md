> ARCHIVED 24 August 2026. Superseded by `docs/CURRENT-STATE.md`.
>
> This gap audit was accurate. Every screen-level defect it recorded was still
> present verbatim in the code five weeks later, while `PROJECT_STATUS.md` marked
> the rebuild it prescribed as complete. `design-qa.md` then passed as correct the
> exact fixed 390x844 desktop frame this document calls "the largest structural
> error".
>
> It is kept because it proves the findings were known and not acted on — the
> remediation gap, not the analysis, was the failure.
> Do not build from this file; use docs/CURRENT-STATE.md.

# BOA Bar Control — Design and Feature Gap Audit

Date: 22 August 2026  
Outcome: Rebuild required before further production integration

## Authority order

The rebuild must use the supplied artifacts in this order:

1. `BOA-Bar.html` — screen composition, navigation, interaction order, density, and mobile behaviour.
2. `BOA_Bar_Inventory.pptx` — visual language, operational cards, severity states, chain-of-custody story, blind-count story, and manager reporting outcomes.
3. `Bar Inventory.docx` — business rules, movement types, counts, POS ingest, variance, reports, offline operation, and phasing.
4. `docs/architecture.md` — technical implementation and production boundaries.

No visual or workflow departure from the first three artifacts is accepted unless it is recorded and explicitly approved.

## Verdict

The current build is a functional engineering prototype, but it is not an acceptable implementation of the supplied product design. It copied some BOA colours, typefaces, and dashboard content while changing the screen hierarchy, interaction model, data density, and feature surface. The earlier `design-qa.md` pass is invalidated by this audit and by user acceptance feedback.

The largest structural error is treating every route as a fixed 390 × 844 presentation frame. This makes the app appear as a tiny phone on a desktop, although the specification requires phone-first bar operations plus usable phone/desktop control and desktop audit/reporting surfaces.

## Screen-by-screen findings

### 1. Dashboard — poor

Evidence: `audit-current/00-reference-html.png` and `audit-current/01-dashboard.png`.

- The current page keeps the same broad information but loses the reference's ambient BOA presentation, density, spacing rhythm, and third full alert.
- The four bar states change from compact operational rows into a two-column card grid.
- Labels, figures, and demo values drift from the source, weakening confidence in the design comparison.
- The fixed device frame makes the dashboard unnecessarily small on desktop.

### 2. Warehouse — poor

Evidence: `audit-current/00-reference-warehouse.png` and `audit-current/02-warehouse.png`.

- Missing Beer/Spirits/Mixers summary totals.
- Missing SKU search and category filters.
- Missing case quantities, base-container quantities, volume values, and last-movement timestamps.
- The supplied catalog is reduced to six simplified rows and different products/quantities.
- Receive is a demo notification rather than a real capture flow.
- The operational hierarchy from the prototype is replaced with oversized action cards and a sparse list.

### 3. Bars — weak

Evidence: `audit-current/00-reference-bars.png` and `audit-current/03-bars.png`.

- Missing named bar leads, count timestamps, overdue-count message, and incoming-docket state.
- Bar cards do not open the full bar workspace required by the spec: accept docket, request top-up, record waste, and count.
- Decorative mini-bars were introduced without a definition in the design or plan.
- Waste and blind-count actions appear only on Bar 3, which is not the intended location model.

### 4. Issue stock — poor

Evidence: `audit-current/00-reference-issue.png` and `audit-current/04-issue.png`.

- The prototype's focused one-product flow was replaced by three full selection sections on one scrolling page.
- Case/bottle switching is missing.
- Case conversion and warehouse-after-issue feedback are incomplete or presented differently.
- The dedicated review step is missing; the page jumps directly to docket creation.
- The primary action is not anchored to the bottom as designed for one-handed operation.

### 5. Blind count — critical

Evidence: `audit-current/00-reference-blind-count.png` and `audit-current/05-blind-count.png`.

- The prototype counts one SKU at a time with progress (`4 of 18`) and `Save & next`; the build exposes three lines at once.
- Values are pre-filled (`11`, `36`, `19`). A blind count must start from an empty/zero entry and must not suggest the expected answer.
- Missing quick quantity presets and section progress.
- Missing the complete count model from the specification: full containers, partial millilitres, gross weight, tare-derived spirit volume, witness/submit state, and manager-only variance reveal.

### 6. Activity — weak

Evidence: `audit-current/00-reference-activity.png` and `audit-current/07-activity.png`.

- Counts and Adjustments filters are missing.
- The issue event preceding docket acceptance is missing, so the displayed chain of custody is incomplete.
- Rows are much smaller and lower contrast than the prototype, reducing scan speed during the event.
- A demo role banner appears inside the production-facing surface.

### 7. More / manager controls — poor

Evidence: `audit-current/00-reference-more.png` and `audit-current/06-more-reports.png`.

- Missing separate Control, Counts, Variance, Reports, Cowork, and Settings destinations.
- Missing sync explanation, device ID, signed-in operator, and build identity.
- Excise return, stock settlement, and sales-per-hour reports are not represented.
- Demo role and connection switches are exposed as product controls.

## Cross-product gaps

### Structural

- No true desktop control board or desktop audit/reporting experience.
- No bar-detail workspace with role-specific primary actions.
- Route structure follows the engineering demo rather than the product's operational jobs.
- Demo data and temporary controls are mixed into production-facing screens.

### Feature coverage still missing or incomplete

- Receipt capture with supplier/delivery evidence.
- Bar-to-bar transfer and warehouse return flows.
- Signed adjustment/reversal flow.
- Request-top-up flow.
- Sequential blind counts across the complete SKU list.
- Open-container weighing and tare calculation UI.
- Manager variance review and approval workflow.
- POS batch import, unmapped-SKU failure, and import history.
- Excise, STOK settlement, throughput variance, rupees-per-attendee, and sales-per-hour reports.
- Paper fallback exports/print views.
- True desktop live-control experience with run-out projections, open dockets, and count ages.

### Accessibility risks visible from the screenshots

- Many labels are visually around 8–10 px and muted against charcoal, creating readability and contrast risk.
- Several chips and compact controls appear below a comfortable 44 × 44 px touch target.
- The desktop fixed-phone treatment forces users to zoom instead of reflowing content.
- Operational state is often communicated through very small coloured text; text labels help, but size and contrast remain weak.

Keyboard order, focus visibility, screen-reader labels, zoom reflow, and exact WCAG colour ratios require implementation-level testing and cannot be confirmed from screenshots alone.

## Rebuild order and acceptance gates

1. Rebuild the responsive shell: true full-screen mobile app, plus desktop control/audit layouts.
2. Reproduce the HTML prototype's dashboard, warehouse, bars, activity, and More screens at the same viewport and data state.
3. Rebuild issue → review → QR docket → exact/short acceptance with container-unit switching and clear custody status.
4. Rebuild blind counts as a sequential zero-entry flow; add partial/open-container measurements and manager-only variance reveal.
5. Add the missing operational flows: receipt, transfer, return, adjustment, request top-up, and paper fallback.
6. Build manager control, variance, POS import, excise, settlement, and performance reports.
7. Run visual comparisons against the source for every route and require user acceptance before resuming Supabase/deployment work.

## Acceptance definition

A screen is complete only when:

- its source and implementation are captured at the same viewport and state;
- layout, typography, density, controls, and data hierarchy visibly match;
- the source interaction sequence is preserved unless an approved production rule changes it;
- every visible primary control works;
- mobile touch targets and desktop reflow pass review;
- the user has accepted the milestone.

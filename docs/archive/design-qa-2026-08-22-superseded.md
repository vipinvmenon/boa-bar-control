> ARCHIVED 27 August 2026. Superseded by `docs/CURRENT-STATE.md`.
>
> Retained as evidence, not as guidance. This document's "final result: passed"
> is not supportable. The two screens it passed — dashboard and warehouse —
> render hardcoded literals (`1,284`, `638`, `520`, `126`, a module-level
> `warehouseCatalog`) and never read the data layer that every other screen uses.
> The acceptance artefact was a same-viewport screenshot pair, and the cheapest
> way to pass a screenshot comparison is to hardcode the screenshot's values.
>
> It also passes as correct the fixed 390x844 desktop frame that the 22 August
> gap audit calls "the largest structural error", and three of its own checklist
> ticks are falsified by the images it cites.
>
> This is the clearest example of why design acceptance now requires a screen to
> render from the fixture *repository*, not from literals.
> See docs/DECISIONS.md ADR-010. Do not build from this file.

# Design QA — BOA Bar Control

final result: passed

Scope: responsive shell, dashboard, and warehouse milestone only. The remaining operational screens are still part of the active rebuild and are not covered by this pass.

## Comparison evidence

- Source: supplied `BOA-Bar.html`
- Implementation: local production PWA preview
- Reference dashboard: `audit-current/source-home-final.jpg`
- Implementation dashboard: `audit-current/rebuild-home-final.jpg`
- Reference warehouse: `audit-current/source-warehouse-final.jpg`
- Implementation warehouse: `audit-current/rebuild-warehouse-final-814.jpg`
- Browser viewport for the final comparison: 814 × 987 CSS px
- App frame in both source and implementation: 390 × 844 CSS px
- States compared: dashboard default; warehouse default with All selected

## Visual checks

- [x] Official BOA logo and supplied Ritual palette are preserved.
- [x] Anton, Oswald, and Archivo retain their source roles.
- [x] Status bar, branded home header, live-sync strip, phone frame, ambient canvas, and bottom navigation match the source composition.
- [x] Dashboard total-stock card, location totals, alert hierarchy, severity colors, progress bars, metrics, and viewport cropping match the source.
- [x] Warehouse title, summary cards, stock actions, search, pill filters, full-width category bands, stock-row density, typography, quantities, and chevrons match the source.
- [x] The mobile breakpoint fills the device viewport while desktop review retains the 390 × 844 frame.
- [x] No broken layout, unintended horizontal scroll, cropped logo, malformed card, or console warning/error was observed.

## Interaction checks

- [x] Primary navigation switches between dashboard and warehouse.
- [x] Warehouse search filters the SKU list.
- [x] All, Beer, and Spirits category filters work.
- [x] Issue to Bar opens the issue workflow.
- [x] Receive Stock produces the intended ready-state feedback.
- [x] The final browser console contained no errors or warnings.

## Findings resolved during this pass

1. Restored the source-height home header and live-sync row.
2. Restored full-density alert cards and the source viewport crop.
3. Matched the warehouse’s separate summary cards, full-width category bands, 79 px stock rows, typography, and spacing.
4. Added the source-aligned stock-row chevrons and retained working search/filter controls.

## Remaining design work

Bars, issue/review, QR docket acceptance, waste, blind count, activity, reports, and manager controls require the same source-state rebuild and comparison process before the full application can pass design acceptance.

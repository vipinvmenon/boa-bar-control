> ARCHIVED 24 August 2026. Retained as evidence, not as guidance.
>
> This document claims the build "was checked against the supplied" specification,
> PowerPoint and HTML prototype. Section 1 of the architecture document written
> two minutes earlier states those artifacts "are not present in this project
> mirror and cannot be recovered". The verification asserted here did not happen.
> It also omits four of the five sections its own generating brief required.
>
> It is kept because it is the clearest example of the failure mode these docs
> exist to prevent: a document asserting a gate that was never run.
> See docs/DECISIONS.md ADR-001. Do not build from this file.

# Artifact reconciliation

This build was checked against the supplied `Bar Inventory.docx`, `BOA_Bar_Inventory.pptx`, `BOA-Bar.html`, and the “Bangalore Open Air — Ritual” brand system before implementation.

## Confirmed product rules

- BOA 2026 is modelled as one venue with a warehouse, four bars, hospitality, lounges, and an explicit in-transit custody state.
- Inventory is not an editable quantity field. Current stock is a projection of immutable movement lines.
- The allowed movement vocabulary is receipt, issue, transfer, return, sale, comp, waste, and adjustment.
- Corrections are new signed adjustments that reference the prior movement. Posted movement rows cannot be updated or deleted.
- Each physical movement records containers and millilitres independently. A full-container count and an open-container measurement can therefore coexist without losing auditability.
- Warehouse issues create QR dockets. Stock is held in transit until a named receiver accepts the quantity. A difference remains visible and requires a reason.
- Blind counts never receive expected stock in the crew response. Expected values are computed after submission and are available only to the manager review path.
- Open spirits use `max(0, gross weight − tare weight)` as the initial practical ml estimate. Kegs support meter/weight evidence.
- Hospitality consumption is reported separately and is never included in paid-sales variance.
- POS import retains the raw file, rejects unmapped items, and deduplicates with the stable POS transaction ID.
- Variance uses throughput as the denominator: `counted closing − theoretical closing`, divided by `sold + comped + wasted`.
- Positive variance is an investigation signal too; tolerance bands use the absolute percentage.

## Visual translation

The implementation uses the supplied official BOA logo, ink/charcoal surfaces, poison green, venom green, sage, gold, bone, Anton, Oswald, and Archivo. The desktop view is a presentation frame for review; on phone widths the PWA fills the viewport and removes simulated device chrome.

The initial functional journey is:

1. Dashboard identifies an urgent Bar 3 shortage.
2. Warehouse creates an issue docket.
3. The receiving bar scans/views the docket and accepts the exact or short quantity.
4. Bar staff record waste in a short, one-handed flow.
5. Staff submit a blind count; only a manager sees variance.

## Deliberate production boundaries

- The UI runs against a deterministic demo repository until Supabase environment variables and live festival data are provided.
- The migration establishes the security and ledger boundary, but live POS vendor adapters remain separate Edge Functions because the operator/export format is still an open business decision.
- Paper dockets and count sheets remain a mandatory operating fallback; the PWA does not pretend connectivity can be guaranteed at the venue.

# Design QA — Consolidated More / Option 3

Source visual truth: `/Users/USER/.codex/generated_images/01a05e0a-f9a5-7840-9143-6043c88e44c7/exec-2ca38129-f845-4285-92ce-b1592ea637da.png`

Implementation screenshot: `/Users/USER/My Works/boa-bar-control/.visual-diff/more-clean-identity.png`

Side-by-side comparison: `/Users/USER/My Works/boa-bar-control/.visual-diff/settings-option-3-comparison-pass-2.svg.png`

Viewport: 390 × 844 CSS px, device scale factor 1.

Density normalization: source was 853 × 1844 px and was downsampled to 390 × 844 px. The implementation was captured at 390 × 844 px. Comparison was therefore performed at equal pixel dimensions.

State: local Vite development build, fixture `a`, manager-only Settings rows exposed by the development-only fixture guard. The red demo-data banner is fixture-only and does not appear in production.

## Full-view comparison evidence

The pass-2 side-by-side comparison confirms that the consolidated More hierarchy keeps the selected Option 3 grouped surfaces, row density, typography hierarchy, palette, icons, dividers, and bottom navigation. More is intentionally taller because it now includes Operations as well as the former Settings options; it scrolls vertically inside the app shell and has no horizontal overflow or hidden persistent navigation. The identity strip now uses the signed-in person's initials and role, as requested. The profile-level sync badge and build footer were removed; sync remains represented by the Device & Continuity row.

## Focused region evidence

A separate crop was not required: both normalized screens are presented at 1:1 size in the comparison and the small labels, subtitles, icons, borders, and state badge are legible. The Invite Crew, Change Password, and Team Members destinations were additionally captured and inspected at 390 × 844.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: Oswald remains the display face and Archivo the body face. Weight, casing, spacing, hierarchy, and wrapping match the selected direction.
- Spacing and layout rhythm: header, identity strip, section gaps, grouped rows, and persistent navigation fit the viewport with no horizontal overflow.
- Colors and visual tokens: the implementation uses the existing BOA ink, bone, sage, and green tokens. No new palette color was introduced.
- Image quality and asset fidelity: this screen does not require raster imagery. Icons use the project's existing Lucide dependency rather than placeholders or custom-drawn assets.
- Copy and content: More now contains Operations, Team Access, Device & Continuity, and Account. Invitation details live behind Invite Crew; Team Members and Change Password remain separate destinations. `/settings` is a compatibility redirect, so there is no duplicate Settings page.
- Identity: the avatar is derived from the signed-in name and the second line is the user's role; the venue name is no longer shown under the person.
- More chrome: the profile-level sync badge and `BOA BAR CONTROL · BUILD …` footer are intentionally absent; only the dedicated Sync State row carries sync status.
- Sync failure hierarchy: the failed action is now a short primary message, “Retained on this device” is a separate muted note, the failure badge is non-wrapping, and the resolve control is compact and clearly separated from the status row.
- Confirmation hierarchy: sign-out, leaving an active count, and discarding a delivery now use one centered modal pattern instead of expanding inline inside the footer or More list.

Expected differences:

- The local fixture capture shows the repository's demo-data warning banner and fixture identity. These are development-state indicators, not production design drift.
- The implementation omits the source mock's chevron on the identity strip because no account-profile destination exists; leaving a non-functional affordance would be misleading.
- Invite Crew retains “assign role and location,” which describes the implemented access controls more precisely than the mock's shortened subtitle.

## Comparison history

### Pass 1

- P2: identity appeared as a floating card instead of a Settings-level strip.
- P2: Team Access was absent from fixture review because the visual harness has no authenticated manager identity.
- P3: password, sign-out, and synced-state icon treatment drifted from Option 3.

Fixes made:

- Converted the Settings identity block to a full-width hierarchy strip.
- Added a development-only fixture permission override; production authorization remains email-gated.
- Matched the selected lock, green sign-out, and synced check-circle treatment.

### Pass 2

- Post-fix evidence: `.visual-diff/settings-option-3-comparison-pass-2.svg.png` and `.visual-diff/more-consolidated-implementation.png`.
- No actionable P0/P1/P2 findings remain.

## Primary interactions tested

- More → Invite Crew
- More → Team Members
- More → Change Password
- Legacy `/settings` → More redirect
- Invite Crew and Change Password fields render at 16 px on mobile, avoiding iOS input-focus zoom.
- Settings, More, Invite Crew, Team Members, and Change Password were checked at 390 px width with no horizontal overflow.
- A fresh Team Members load produced no browser console warnings or errors.

## Implementation checklist

- [x] Move invitation form behind an Invite Crew row in More.
- [x] Group options into Operations, Team Access, Device & Continuity, and Account.
- [x] Remove the duplicate Settings page while preserving its route as a redirect.
- [x] Add Team Members and Change Password destinations.
- [x] Preserve mobile-safe form sizing and persistent navigation.
- [x] Refine failed-sync status, retention copy, and recovery action on More.
- [x] Use a consistent modal for destructive or progress-loss confirmations.
- [x] Verify build, lint, typecheck, and unit tests.

## Follow-up polish

- P3: review authenticated manager data on a physical phone before production deployment.

final result: passed

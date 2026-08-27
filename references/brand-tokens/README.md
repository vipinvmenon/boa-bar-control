# BOA "Ritual" brand tokens — preserved reference

Copied from `Bangalore Open Air — Ritual/`, which is **not tracked** in this
repository (40 MB of poster and band artwork, plus unannounced 2026 lineup
images). Only the text tokens and guideline cards are kept here, because
`docs/DESIGN-SYSTEM.md` and `docs/DECISIONS.md` ADR-009 reference them.

## Scope — read ADR-009 first

Per ADR-009, accepted by the user on 24 August 2026:

> Go with the mobile app design file and not the Ritual file.

These tokens govern **brand identity only** — logo, palette meaning, campaign
typography. They do **not** override an app-surface value. Where they disagree
with `references/design-source/design-markup.html`, the app design wins.

The clearest case is radii. This system declares `--radius-sm: 2px`,
`--radius-md: 4px`, `--radius-lg: 8px`, commented "mostly sharp — this brand is
spiky, not soft". The app design uses soft 12–18 px. Applying these sharp values
to the app is what produced the 3–7 px flow screens the audit flagged — correct
tokens, wrong surface.

Note also that this system defines **no red**. The app's `--red: #FF4A3D` comes
from the app design alone and was never in conflict.

The full brand system, including artwork, remains on the designer's machine and
in the original delivery. If it is needed again, restore it locally — it is
ignored, not deleted.

# BOA Bar Control — Design System

Status: canonical. This file is the visual contract.
Source of truth: `references/design-source/` (recovered from `BOA-Bar.html`).

---

## The rule that matters most

> `references/design-source/` is the visual source of truth.
> Do not reinterpret the interface.

The approved design is not a mood board. It is a complete, pixel-exact
specification: 22 screens, every value inline. Reproduce it.

**Visual deviation is a bug, not a preference.** Without an explicit written
instruction in the task, do not:

- redesign cards or change their composition
- change spacing, radii, or type scale
- change navigation or screen order
- substitute colours or introduce new ones
- introduce a new component style
- add gradients, shadows, or effects not in the source
- change the typography hierarchy
- rename, re-case, or rewrite label text
- invent content, metrics, or affordances

If the design appears wrong, raise it as a question. Do not fix it silently.

## Where the truth lives

| File | What it is |
| --- | --- |
| `references/design-source/design-script.jsx` | The design's state machine: all 22 screens, their data shapes, transitions, and conditional behaviour. **The interaction contract.** |
| `references/design-source/design-markup.html` | The design's markup with every style inline. **The pixel contract.** |
| `references/design-source/template.html` | The complete original page, fonts included. |
| `references/design-source/spec.txt` | The original written specification. |
| `references/brand-tokens/` | The BOA brand text tokens and guideline cards. Brand identity only — see the precedence rule below. The full 40 MB artwork set is untracked. |

### Precedence, when two sources disagree

**Ruled by the user, 24 August 2026: go with the mobile app design file, not the
Ritual file.** ([DECISIONS.md](DECISIONS.md) ADR-009, Accepted.)

1. `references/design-source/design-markup.html` — the approved app design wins on every app-surface value.
2. `references/design-source/design-script.jsx` — wins on behaviour, data shape, and label text.
3. `references/brand-tokens/tokens/` — governs brand identity (logo, palette meaning, campaign type) only. It does **not** override an app value.

The Ritual brand system was built for **posters and campaign assets**. Its
display face (Metal Mania) and its large type scale do not apply to the app.

**The radius conflict, resolved.** Ritual declares sharp radii — `--radius-sm: 2px`,
`--radius-md: 4px`, `--radius-lg: 8px`, commented *"mostly sharp — this brand is
spiky, not soft"*. The app design uses **soft 12/14/15/16/18 px**. The app design
wins. The previous implementation's 3–7 px flow screens were the Ritual tokens
applied correctly to the wrong surface — which is precisely why this precedence
rule had to be written down.

Note that Ritual defines **no red at all**, so `--red: #FF4A3D` was never in
conflict; the drift to `#ff5d5d` was simply a bug.

## Colour

Exact hex, from the design. These are the only colours in the app.

| Token | Hex | Role | Usage count in design |
| --- | --- | --- | --- |
| `--bone` | `#F2EFE2` | Primary text, key figures | 94 |
| `--green` | `#00F5A5` | Primary accent, live/healthy, active nav, CTA fill | 39 |
| `--ink` | `#0D0D12` | Base background, text on green/gold | 32 |
| `--sage` | `#A6C9B4` | Muted text and hairlines — **always at alpha** | 19 |
| `--gold` | `#E3BB72` | Warning, amber band, offline state, gold CTA | 16 |
| `--red` | `#FF4A3D` | Critical, negative variance, waste, audit flag | 9 |
| `--charcoal` | `#1B1B24` | Card and panel surface | — |
| `--venom` | `#08B078` | Mid-green gradient stop | — |

`--red` is `#FF4A3D`. It is **not** `#ff5d5d`.

### The sage-alpha scale

The design has no grey palette. Every muted tone is `--sage` at an alpha, over
ink. This is the single most-violated rule in the current implementation, which
invented ~22 off-palette greys.

```css
rgba(166, 201, 180, 0.16)  /* hairline borders */
rgba(166, 201, 180, 0.22)  /* dividers, inactive pill border */
rgba(166, 201, 180, 0.40)  /* de-emphasised ledger meta */
rgba(166, 201, 180, 0.55)  /* inactive nav icon */
rgba(166, 201, 180, 0.62)  /* small caps labels */
rgba(166, 201, 180, 0.70)  /* secondary label */
rgba(166, 201, 180, 0.72)  /* section eyebrow */
rgba(166, 201, 180, 0.80)  /* inactive pill text */
```

Surfaces are ink and charcoal at alpha:

```css
rgba(27, 27, 36, 0.62)   /* raised control */
rgba(27, 27, 36, 0.72)   /* metric cell */
rgba(27, 27, 36, 0.82)   /* panel */
rgba(13, 13, 18, 0.55)   /* glass header */
rgba(242, 239, 226, 0.10) /* grid gap fill */
```

Do not add a grey. If you need a tone, it is sage or bone at an alpha.

## Typography

Three families, three jobs. Never mix the jobs.

| Family | Job | Weights used |
| --- | --- | --- |
| **Anton** | Big numbers and screen titles only. Always 400. | 400 |
| **Oswald** | All UI caps, labels, data lines, metrics, nav. The workhorse. | 400, 500, 600, 700 |
| **Archivo** | Body copy and sentence-case descriptive text only. | 400, 600 |

### Required font loading

The design uses **Oswald 400, 500, 600 and 700**. All four must be loaded.
With `font-synthesis: none` set globally, an unloaded weight does not fall back
gracefully — it silently renders at the wrong weight.

```ts
import '@fontsource/anton/400.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/500.css'   // required — 45 uses in the design
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'   // required — 60+ uses in the design
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/600.css'
```

### The type scale, as the design actually uses it

Most-used first. Values are `font: {weight} {size}/{line-height} {family}`.

| Spec | Role |
| --- | --- |
| `500 9px/1 Oswald` + `0.16em` | Micro caps label (metric cell headings) — the most common text in the app |
| `700 10px/1 Oswald` + `0.2em` | Section eyebrow |
| `700 11px/1 Oswald` + `0.2em` | Card eyebrow (`TOTAL STOCK`) |
| `600 13px/1 Oswald` + `0.04em` | Status bar clock |
| `600 12px/1 Oswald` | Data line, pill label |
| `700 12px/1 Oswald` + `0.14em` | Live/sync state |
| `600 19px/1 Oswald` | Metric value |
| `700 20px/1 Oswald` | Large metric |
| `400 42px/0.9 Anton` + `0.01em` | Hero figure (`1,284`) |
| `400 26–56px/1 Anton` | Screen titles and big numbers |
| `400 11–12px/1.3–1.5 Archivo` | Body copy, item descriptions |
| `600 14px/1.2 Archivo` | Item name |

### Casing

**The design's data vocabulary is upper case.** `BAR 1`, `HEALTHY`, `COUNT DUE`,
`TOTAL STOCK`, `LAST MOVEMENT 12 MIN AGO`, `48 BOTTLES`, `CRITICAL`.

Sentence case appears only in Archivo body copy and item names: `Kingfisher
Premium`, `Beer · 650 ml bottle`, `Bar 3 · Kingfisher low`.

Do not re-case label text. The casing is the design.

### Letter-spacing

Oswald caps always carry tracking. It is never zero:

| Context | Tracking |
| --- | --- |
| Micro caps (9px) | `0.16em` |
| Section eyebrow | `0.2em` |
| Live/sync state | `0.14em` |
| Data caps | `0.08em` – `0.12em` |
| Brand lockup | `0.16em` |
| Status bar | `0.04em` |

## Radii

The design's radius vocabulary is **soft**. Its five most common values:

| Radius | Use | Count |
| --- | --- | --- |
| `15px` | Metric grids, inner panels | 23 |
| `14px` | Rows, list items, buttons | 19 |
| `18px` | Cards, primary panels | 18 |
| `16px` | Alert cards | 14 |
| `999px` | Pills, filter chips, dots | 13 |
| `12px` | Small controls, icon buttons | 11 |
| `44px` | Phone frame only | 1 |

Values below `11px` are vanishingly rare in the design (a handful of 2–8px
cases for progress meters and hairline details). A flow screen built on a 3–7px
radius vocabulary is wrong.

## Material and motion

The design's surfaces are **glass**, not flat. There are **51** `backdrop-filter`
declarations in the design source. Panels are translucent over an ambient
gradient field, so the background shows through.

```css
/* Glass header */
background: rgba(13, 13, 18, 0.55);
backdrop-filter: blur(28px) saturate(160%);
-webkit-backdrop-filter: blur(28px) saturate(160%);

/* Glass card */
background: linear-gradient(160deg, rgba(23,24,31,0.94) 0%, rgba(13,13,18,0.90) 100%);
backdrop-filter: blur(20px) saturate(150%);
border: 1px solid rgba(166, 201, 180, 0.20);
box-shadow: inset 0 1px rgba(242,239,226,0.06), 0 12px 32px rgba(0,0,0,0.45);
```

The ambient field behind the app. **All three layers are required** — the
implementation currently ships two and drops the venom-green centre:

```css
background-image:
  radial-gradient(38% 30% at 22% 18%, rgba(0,245,165,0.20) 0%, transparent 70%),
  radial-gradient(34% 28% at 82% 72%, rgba(227,187,114,0.14) 0%, transparent 72%),
  radial-gradient(60% 45% at 50% 40%, rgba(8,176,120,0.10) 0%, transparent 74%);
```

The live dot pulses. This is not decoration — it is the signal that the app is
connected:

```css
animation: boaPulse 2.4s ease-in-out infinite;
box-shadow: 0 0 8px currentColor;
```

## Layout

- App frame: `390 × 844` CSS px, `44px` radius, on desktop review only.
- On a real phone the app fills the viewport. The fixed frame is a desktop
  review affordance, **not** the mobile layout.
- Status bar: `44px`, `padding: 0 24px 8px`, bottom-aligned.
- Header: `padding: 10px 16px 12px`, hairline bottom border, glass.
- Screen content: `padding: 14px 16px 24px`, `gap: 14px` in a column.
- Bottom nav: five tabs — Home, Warehouse, Bars, Activity, More.
- Flow screens hide the bottom nav and use a **sticky footer CTA bar**.

### Full-screen flows

These screens hide the bottom nav (from `design-script.jsx`):

```
issue · review · docket · accept · diff · received · waste · count · countDone · sku · mv
```

## Interaction model

The design is one state machine, and it must be implemented as one.

```js
state = { screen, stack, ... }

go(s)   // push current screen onto stack, navigate to s
back()  // pop the stack — NOT "go home"
tab(s)  // navigate to s and RESET the stack to empty
flash(msg)  // toast, auto-clears after 2600ms
```

`back()` returns to the screen you came from. A back button hardcoded to home is
a defect. Tab switches clear the stack.

Toasts expire after **2600 ms**. A toast that never clears is a leak.

Sheet and transient states that must exist: `incomingOpen`, `docketMade`,
`proposal`.

### Design-time props

The design exposes three switches that drive real conditional rendering:

| Prop | Default | Drives |
| --- | --- | --- |
| `offline` | `false` | Live-dot colour and label, sync label, pending-changes count |
| `blindCount` | `true` | Whether expected quantities are visible during a count |
| `role` | `Manager` | Manager-only surfaces and ₹ figures |

These are not demo toggles to ship as user-facing settings. They are the
conditional behaviour the real app must derive from real state.

## Screen inventory

All 22, with their design labels. See
[CURRENT-STATE.md](CURRENT-STATE.md) for build status.

| Key | Label | Purpose |
| --- | --- | --- |
| `home` | LIVE HOME | Total stock, alerts, bar status |
| `warehouse` | WAREHOUSE | Category groups, filters, search, stock actions |
| `sku` | SKU LEDGER | Per-SKU movement history |
| `issue` | ISSUE STOCK | Destination, SKU, quantity with case/bottle unit switch |
| `review` | REVIEW ISSUE | Confirm before committing |
| `docket` | DOCKET CREATED | QR, identity treatment, lines |
| `bars` | BARS | Four bars with leads, count ages, flags |
| `bar` | BAR 3 | Bar workspace: inventory, actions, incoming |
| `accept` | RECEIVE STOCK | Scan and accept custody |
| `diff` | REPORT DIFFERENCE | Short/damaged with mandatory reason |
| `received` | RECEIVED | Custody-complete confirmation |
| `waste` | RECORD WASTE | Three-tap waste capture |
| `count` | MID-EVENT COUNT | Sequential blind count with partial capture |
| `countDone` | COUNT SUBMITTED | Sealed, witnessed |
| `variance` | VARIANCE | Counted vs theoretical, per SKU |
| `activity` | ACTIVITY | Grouped ledger feed, five filters |
| `mv` | MOVEMENT | Movement detail with reverses/audit flag |
| `control` | CONTROL | Show-day board |
| `cowork` | COWORK | Assistant surface |
| `more` | MORE | Six destinations, sync state |
| `reports` | REPORTS | Six reports, period toggle, settlement cells |
| `rep` | REPORT | Individual report detail |

### Count screen partial capture

The count screen is the highest-risk screen in the app. Per SKU it must support
the design's three capture modes:

| SKU type | Partial unit | Step |
| --- | --- | --- |
| Bottled beer | none (full containers only) | 1 |
| Spirits | `ML BY WEIGHT` (gross − tare) | 50 |
| Keg / draught | `LITRES REMAINING` | 1 |

Inputs must start empty or at zero. **Never pre-filled with the expected
figure.**

## Accessibility

- Minimum tap target `44 × 44` px. The design's controls are `36px` visually but
  must carry padded hit areas.
- Keep visible focus indicators. Do not remove focus outlines.
- The app is used one-handed, in the dark, at speed, by temporary staff.

## Definition of done for any UI task

1. Every value traced to `design-markup.html` or `design-script.jsx`.
2. No colour outside the palette; no grey.
3. Radii from the soft vocabulary.
4. Oswald caps carry their tracking; casing matches the design.
5. Glass material and the ambient field preserved.
6. `back()` pops the stack.
7. No hardcoded fixture data in a screen file — data comes from the repository layer.
8. No invented content, metric, or affordance.
9. A screenshot of the built screen at `390 × 844`, compared against the same
   state in the design source, attached to the task.

Point 7 is load-bearing: a screen that hardcodes the design's sample figures can
pass a screenshot comparison while being entirely non-functional. That is how
this project's previous design QA passed two screens that never read the data
layer.

---

See also: [PRODUCT.md](PRODUCT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[CURRENT-STATE.md](CURRENT-STATE.md)

# Bangalore Open Air — Ritual

The design system for **Bangalore Open Air (BOA)**, India's longest-running outdoor metal
festival. Dark ritual meets Indian iconography: a poison-green glow bleeding out of near-black,
gold used sparingly and reverently. Loud, sacred, heavy — never clean-corporate.

Derived from the BOA 2026 poster art direction.

---

## ⚠️ Source & missing assets

- **Reference poster** now in `assets/poster.jpg` (the 2026 deity/Medusa-Kali poster). Used as the
  visual source of truth for the system.
- **Band photography** now in `assets/bands/` — one JPG per artist (`carcass`, `paradise-lost`,
  `1349`, `thy-art-is-murder`, `midhaven`, `the-ocean`, `nervosa`, `the-down-troddence`). Wired into
  the Artist Announcement template.
- **Official logo** now in `assets/boa-logo-2026.png` (transparent PNG, green-glow BANGALORE OPEN
  AIR wordmark). **Always use this logo** — never a type-rebuilt wordmark. The `LogoLockup`
  component and all templates render it.
- **No isolated deity/mascot cut-out or sponsor logo files** were provided (they live baked into
  `poster.jpg`). Supply transparent PNGs of the mascot and each sponsor lockup to use them cleanly.
- **Fonts are Google Fonts substitutions** (see Type substitutions below). Provide the licensed
  display face if the poster's lettering must match exactly.

---

## Content fundamentals

- **Voice:** ritualistic, reverent, heavy. Speaks to the scene as insiders — "the ritual returns",
  "answer the call". Sacred/occult register, never corporate hype.
- **Casing:** headlines and data lines are **UPPERCASE**. Body copy is sentence case.
- **Person:** addresses the audience directly but sparingly ("your pass", "get tickets") — mostly
  it proclaims rather than converses.
- **Data line format:** bold condensed caps with pipe separators, e.g.
  `SATURDAY | 10TH OCTOBER 2026 | BENGALURU, INDIA`.
- **Eyebrow badge:** `ROCK ✦ N ✦ ROLL ✦ ORIGINALS` — western/varsity caps with star dividers.
- **Numbers/urgency:** blunt and immediate — "PRICE RISES SOON", "PHASE 2 NOW LIVE".
- **Emoji:** none. The only glyph used decoratively is the star `✦` in the eyebrow badge and as a
  green accent divider.
- **Band names** are always set in their native lockup where available; never restyle a band's logo.

## Visual foundations

- **Colors:** ink-black base (`#0D0D12`), smoke-charcoal panels (`#1B1B24`). **Poison-green
  (`#00F5A5`) is primary** — glows, key linework, hover/active. **Ritual-gold (`#E3BB72`) is
  reserved** for headliner names, dates/venue, and CTA fills. Sage-bone (`#A6C9B4`) for muted
  text/skin, bone-white (`#F2EFE2`) for max contrast. The signature combo to protect is
  **poison-green + gold on ink-black.** Never recolour outside the token set.
- **Type:** Metal Mania display wordmark (festival name only), Anton heavy-condensed headlines,
  Oswald condensed data lines, Rye western eyebrow, Archivo grotesque body. Never set body copy in
  the display face.
- **Backgrounds:** near-black, never pure white. A radial **green aura** (`--bg-aura`) sits behind
  the hero subject; a **venom→ink wash** (`--bg-venom-wash`) protects text over photography. Grain
  and halftone dot textures (`--texture-grain`, `--texture-halftone`) add grunge.
- **The green glow is the identity.** Applied as layered box-shadows / text-shadows
  (`--glow-green-*`). Don't flatten it into a solid.
- **Corner radii:** mostly **sharp** (0–4px) — this brand is spiky, not soft. Only ticket-tier
  pills use the full pill radius. Cards use 8px max.
- **Borders:** hairline sage at low alpha for structure; poison-green or deep-gold for emphasis,
  usually 1.5–2px, often paired with a glow.
- **Shadows:** deep black panel shadows on ink; stickers get a hard offset drop shadow
  (`--shadow-sticker`) for a stamped, physical feel.
- **Motion:** restrained. `--ease-ritual` (a soft overshoot), fast 140ms presses that nudge down
  1px and scale to 0.99. No bounce, no infinite decorative loops on content.
- **Hover/press:** hover intensifies glow; press nudges down + scales slightly. No colour inversion.
- **Layout:** ritual layouts breathe — give the deity art air, don't crowd it with text. Ads mark
  platform **safe zones** (`--safe-top`, `--safe-bottom`) so nothing critical hides under UI.
- **Imagery vibe:** high-contrast, desaturated-toward-green, grainy. Real festival photography is the
  hero; deity illustration is the fallback. Never AI stock as hero.

## Iconography

- **No custom icon set** exists in the source. The brand is illustration-led, not icon-led.
- The only recurring glyph is the **four-point star `✦`** (Unicode U+2726), used as an eyebrow
  divider and green accent. Pipes `|` separate data-line items.
- If UI icons are ever needed (e.g. a ticket cart), use **Lucide** (CDN, 1.5–2px stroke) to match the
  linework weight — *flagged substitution*, not part of the original poster.
- Motifs (smoke tendrils, negative-space flames, filigree, skulls, snakes, deity mascot) are
  **illustration assets**, not icons — supply them as PNG/SVG art and place per the `Motif`/image-slot
  rules. Do not reconstruct them as hand-drawn SVG.

## Type substitutions (flagged)

| Role | Poster intent | Substitute (Google Fonts) |
|---|---|---|
| Display wordmark | spiky blackened-metal gothic | **Metal Mania** |
| Eyebrow badge | distressed western/varsity | **Rye** |
| Headline | bold condensed uppercase | **Anton** |
| Data line / UI caps | bold condensed | **Oswald** |
| Body | clean grotesque | **Archivo** |

---

## Index / manifest

**Root**
- `styles.css` — global entry (import this one file)
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`
- `readme.md` — this file · `SKILL.md` — Agent-Skills wrapper

**Components** (`window.BangaloreOpenAirRitual_1f354d`)
- `components/marks/` — **LogoLockup**, **Motif**
- `components/content/` — **HeadlineBlock**, **LineupBlock**, **DateVenueBar**, **SponsorStrip**
- `components/actions/` — **CTAButton**, **TicketBadge**, **PriceSticker**

**Templates** (`templates/`) — reusable social ad frames, duplicate & re-caption per campaign
- `ad-square/` — 1:1 · 1080×1080 (feed)
- `ad-portrait/` — 4:5 · 1080×1350 (feed, max real estate)
- `ad-story/` — 9:16 · 1080×1920 (Stories/Reels, with safe zones)
- `ad-link/` — 1.91:1 · 1200×628 (link ad)
- `artist-announce/` — **Artist Announcement** 1080×1350 · single-artist reveal; `Band` tweak swaps
  the real photo + name across all 8 confirmed acts (or drop your own). Assets in `assets/bands/`.

Each template ships 3 message variants: **lineup / headliner spotlight / price-urgency**, toggled
via a Tweak. One editable text layer per element for per-campaign captioning.

**Foundation cards** — `guidelines/*.card.html` populate the Design System tab (Colors, Type,
Spacing, Brand).

### Intentional additions
- **Motif** — a decorative atmosphere wrapper (aura + texture + wash). Added because the poster's
  "green glow + grunge" is a reusable layer, not a one-off; it keeps the signature consistent.

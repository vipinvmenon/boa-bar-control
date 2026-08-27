---
name: bangalore-open-air-design
description: Use this skill to generate well-branded interfaces and assets for Bangalore Open Air (BOA) — India's longest-running outdoor metal festival — for production or throwaway prototypes/mocks/ads. Contains the "Ritual" design guidelines, colors, type, fonts, motif library, reusable components, and social ad templates.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (ads, slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask a few questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Fast orientation
- **Tokens / global CSS:** `styles.css` (imports `tokens/*.css`). Link this one file.
- **Signature to protect:** poison-green (`#00F5A5`) + ritual-gold (`#E3BB72`) on ink-black (`#0D0D12`). Green glows; gold is reserved for headliners, dates, CTAs. Never recolour outside the token set. Never flatten the glow.
- **Components:** `components/{marks,content,actions}/` — LogoLockup, Motif, HeadlineBlock, LineupBlock, DateVenueBar, SponsorStrip, CTAButton, TicketBadge, PriceSticker.
- **Ad templates:** `templates/ad-{square,portrait,story,link}/` — duplicate and re-caption per campaign; each has 3 message variants (lineup / spotlight / price-urgency).
- **Type:** Metal Mania (display wordmark, festival name only) · Anton (headline) · Oswald (data line) · Rye (eyebrow) · Archivo (body). Never set body copy in the display face.

## Caveats (read before shipping)
- Fonts are Google Fonts **substitutions**; the logo is a **type-built approximation** (no official mark supplied). See readme.md "Missing assets".
- Real BOA festival photography is the intended hero — supply it into the template `<image-slot>`s. Deity/mascot illustration is the fallback; never AI stock as hero.

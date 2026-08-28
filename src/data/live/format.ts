/**
 * BAR-042 — display formatting for the live repository.
 *
 * The design renders quantities in a specific vocabulary: `12 cases`,
 * `288 bottles`, `240 L`, `46,500 ml`, `LAST MOVEMENT 12 MIN AGO`,
 * `Beer · 650 ml bottle`. The fixture repository gets these for free because the
 * design's own strings are transcribed in design-data.ts. The live repository has
 * to *produce* them, and every rule for doing so lives here — pure, so it can be
 * tested without a database, and in one place, so two screens cannot disagree.
 *
 * Every rule below was derived by reading every quantity the design actually
 * renders (references/design-source/design-script.jsx) and finding the single
 * rule that reproduces all of them. Where a row looked like an exception it was
 * not: see `quantityPair`.
 */

/** Category keys as constrained by boa_bar_sku.category_key. */
export type CategoryKey = 'bottled_beer' | 'draught_beer' | 'spirits' | 'mixers'

export type SkuShape = {
  categoryKey: CategoryKey
  containerType: string
  mlPerContainer: number
  unitsPerCase: number
  tareWeightG: number | null
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** `46500` -> `46,500`. The design uses Indian-English grouping's thousands. */
export function thousands(value: number): string {
  return new Intl.NumberFormat('en-IN', { useGrouping: true, maximumFractionDigits: 0 }).format(
    Math.round(value),
  )
}

/** `1.5` -> `1.5`, `12.0` -> `12`. The design writes `1.5 cases` and `12 cases`. */
export function trimDecimal(value: number, places = 1): string {
  const fixed = value.toFixed(places)
  return fixed.replace(/\.0+$/, '')
}

// ---------------------------------------------------------------------------
// Time, in the venue's timezone
// ---------------------------------------------------------------------------

/**
 * Every stamp the design shows is venue-local wall-clock: `19:43`, `counted
 * 17:40`, `ISSUED BY CHANDAN · 19:31`. The device's own timezone is irrelevant
 * and using it would put a crew member's phone clock on an excise record, so the
 * venue's timezone (boa_bar_venue.timezone) is threaded through explicitly.
 */
export function makeClock(timezone: string) {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })

  return {
    timezone,

    /** `2026-10-10T19:43:00+05:30` -> `19:43`. */
    time(iso: string | null | undefined): string {
      if (!iso) return '—'
      const at = new Date(iso)
      if (Number.isNaN(at.getTime())) return '—'
      return hhmm.format(at)
    },

    minutesBetween(iso: string | null | undefined, now: Date): number | null {
      if (!iso) return null
      const at = new Date(iso)
      if (Number.isNaN(at.getTime())) return null
      return Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000))
    },

    /**
     * `12 MIN AGO`, `1 H AGO`, `3 H AGO` — the three forms the design uses, and
     * it switches to hours at 60 minutes with no minutes component.
     */
    ago(iso: string | null | undefined, now: Date): string {
      const minutes = this.minutesBetween(iso, now)
      if (minutes === null) return 'NO MOVEMENT'
      if (minutes < 60) return `${minutes} MIN AGO`
      return `${Math.floor(minutes / 60)} H AGO`
    },
  }
}

export type Clock = ReturnType<typeof makeClock>

// ---------------------------------------------------------------------------
// SKU vocabulary
// ---------------------------------------------------------------------------

/**
 * `bottle` -> `BOTTLES`, `can` -> `CANS`, `keg` -> `KEGS`.
 *
 * `boa_bar_sku.container_type` is free text, so this normalises rather than
 * switching on an enum: an unexpected value pluralises to something readable
 * instead of throwing on an excise night.
 */
export function unitWord(containerType: string, plural = true): string {
  const base = containerType.trim().toLowerCase().replace(/s$/, '') || 'container'
  const word = plural ? `${base}s` : base
  return word.toUpperCase()
}

/** `Beer`, `Spirit`, `Mixer` — the design's four categories collapse to three words. */
export function categoryWord(categoryKey: CategoryKey): string {
  switch (categoryKey) {
    case 'bottled_beer':
    case 'draught_beer':
      return 'Beer'
    case 'spirits':
      return 'Spirit'
    case 'mixers':
      return 'Mixer'
  }
}

/**
 * `BEER`, `SPIRITS`, `MIXERS` — the warehouse screen's three groups. Bottled and
 * draught beer share one group in the design; they are separate category keys
 * because their variance tolerances differ by an order of magnitude (1–3% vs
 * 8–15%, spec §8).
 */
export function groupKey(categoryKey: CategoryKey): string {
  switch (categoryKey) {
    case 'bottled_beer':
    case 'draught_beer':
      return 'BEER'
    case 'spirits':
      return 'SPIRITS'
    case 'mixers':
      return 'MIXERS'
  }
}

export const GROUP_ORDER = ['BEER', 'SPIRITS', 'MIXERS'] as const

/** A keg is measured in litres everywhere; everything else in millilitres. */
export function isKeg(sku: Pick<SkuShape, 'categoryKey' | 'containerType'>): boolean {
  return sku.categoryKey === 'draught_beer' || /keg/i.test(sku.containerType)
}

/**
 * `Beer · 650 ml bottle`, `Spirit · 750 ml bottle`, `Beer · 30 L keg`.
 * Kegs state litres because `30000 ml keg` is not how anyone at a bar speaks.
 */
export function specLabel(sku: SkuShape): string {
  const measure = isKeg(sku)
    ? `${trimDecimal(sku.mlPerContainer / 1000)} L`
    : `${thousands(sku.mlPerContainer)} ml`
  return `${categoryWord(sku.categoryKey)} · ${measure} ${unitWord(sku.containerType, false).toLowerCase()}`
}

/**
 * The count screen's partial-capture mode, per specification §6: "count full
 * containers as integers and weigh partials".
 *
 * A keg is metered in litres, a spirit bottle is weighed against its tare, and a
 * bottled beer or a mixer has no meaningful partial — nobody weighs a half-drunk
 * Kingfisher. Returning `ml` for a spirit with no recorded tare weight would put
 * a stepper on screen with no way to use it, so that falls back to `none`.
 */
export function partialModeFor(sku: SkuShape): 'none' | 'ml' | 'litres' {
  if (isKeg(sku)) return 'litres'
  if (sku.categoryKey === 'spirits' && sku.tareWeightG !== null) return 'ml'
  return 'none'
}

export function partialStepFor(mode: 'none' | 'ml' | 'litres'): number {
  // 50 ml is roughly two pegs and is the smallest difference a venue scale
  // resolves reliably; 1 L is the smallest a keg flow meter reports.
  if (mode === 'ml') return 50
  if (mode === 'litres') return 1
  return 1
}

export function partialUnitFor(mode: 'none' | 'ml' | 'litres'): string {
  if (mode === 'ml') return 'ML BY WEIGHT'
  if (mode === 'litres') return 'LITRES REMAINING'
  return 'OPEN CONTAINERS'
}

/** `WEIGH · TARE 480 G` / `FLOW METER` — the method, so the counter needs no training sheet. */
export function partialHintFor(sku: SkuShape, mode: 'none' | 'ml' | 'litres'): string {
  if (mode === 'ml' && sku.tareWeightG !== null) {
    return `WEIGH · TARE ${trimDecimal(sku.tareWeightG, 0)} G`
  }
  if (mode === 'litres') return 'FLOW METER'
  return ''
}

// ---------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------

/**
 * The two-line quantity the warehouse screen shows per SKU.
 *
 * Reading every row the design renders, one rule reproduces all of them:
 *
 *   Kingfisher  288 bottles @ 24/case -> `12 cases`   / `288 bottles`
 *   Corona       48 bottles @ 24/case -> `2 cases`    / `48 bottles`
 *   Bira         36 cans    @ 24/case -> `1.5 cases`  / `36 cans`
 *   STOK          8 kegs               -> `8 kegs`     / `240 L`
 *   Old Monk     62 bottles            -> `62 bottles` / `46,500 ml`
 *   Coca-Cola    96 bottles @ 24/case -> `4 cases`    / `96 bottles`
 *   Tonic Water  12 bottles @ 24/case -> `12 bottles` / `2,400 ml`
 *
 * Tonic looks like an exception to the case rule but is not: it is below one
 * full case, and a manager reading `0.5 cases` learns less than one reading
 * `12 bottles`. So cases are used only at or above a full case. Spirits and kegs
 * are never expressed in cases — a spirit is issued and counted as bottles, and
 * a keg as a keg — which is also why the previous implementation's `1.5 cases`
 * could appear beside a container count that could not produce it.
 */
export function quantityPair(sku: SkuShape, containers: number): { primary: string; secondary: string } {
  const unit = unitWord(sku.containerType).toLowerCase()

  if (isKeg(sku)) {
    return {
      primary: `${thousands(containers)} ${unit}`,
      secondary: `${thousands((containers * sku.mlPerContainer) / 1000)} L`,
    }
  }

  if (sku.categoryKey === 'spirits') {
    return {
      primary: `${thousands(containers)} ${unit}`,
      secondary: `${thousands(containers * sku.mlPerContainer)} ml`,
    }
  }

  if (sku.unitsPerCase > 1 && containers >= sku.unitsPerCase) {
    return {
      primary: `${trimDecimal(containers / sku.unitsPerCase)} cases`,
      secondary: `${thousands(containers)} ${unit}`,
    }
  }

  return {
    primary: `${thousands(containers)} ${unit}`,
    secondary: `${thousands(containers * sku.mlPerContainer)} ml`,
  }
}

/**
 * A volume, in the unit that SKU is spoken about in. Used by the variance report,
 * where the design shows `96 L` for draught and `11,400 ml` for a spirit.
 */
export function volumeLabel(sku: SkuShape, ml: number): string {
  if (isKeg(sku)) return `${trimDecimal(ml / 1000)} L`
  return `${thousands(ml)} ml`
}

/** A signed figure with the design's true minus sign (U+2212), not a hyphen. */
export function signed(value: number, suffix = ''): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${thousands(Math.abs(value))}${suffix}`
}

export function signedPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

/** Upper-cased first name, as the ledger renders actors: `CHANDAN → RAHUL`. */
export function actorLabel(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  // Deliberately not "Unknown" or "Authenticated staff": a custody row with no
  // resolvable name is a data defect, and it should read as one (BAR-124).
  return trimmed ? trimmed.toUpperCase() : 'UNNAMED'
}

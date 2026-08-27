/**
 * BAR-042 — the repository interface.
 *
 * One interface, two implementations (fixture and live), returning identical
 * shapes. Screens never import Supabase, Dexie, or a store; they read from here
 * through a service or hook.
 *
 * The read models below are shaped by what the approved design's screens
 * actually display, not by the database tables. That is deliberate: the design
 * is the contract for the UI, and a screen that has to reshape data in JSX ends
 * up holding logic that belongs in the domain layer.
 *
 * Every field here exists because a screen in references/design-source/ renders
 * it. Where a field looks oddly specific — `lead`, `countedAt`, `flag` on a bar —
 * it is because the design shows exactly that, and the previous implementation
 * dropped it.
 */

export type Tone = 'green' | 'gold' | 'red' | 'muted'

/** The "AS OF 19:43" stamp every screen in the design carries. */
export type AsOf = {
  /** Display label, venue-local. Never a literal in a screen file. */
  label: string
  /** The instant the data describes, so staleness is computable. */
  at: string
}

// ---------------------------------------------------------------------------
// bars / bar
// ---------------------------------------------------------------------------

export type BarSummary = {
  id: string
  /** Upper case, as the design renders it: 'BAR 1'. */
  name: string
  containers: number
  /** Upper case: 'HEALTHY', 'COUNT DUE', 'LOW STOCK'. */
  status: string
  tone: Tone
  /** Bar lead's first name — the design shows 'Lead: Aditi · counted 17:40'. */
  lead: string
  /** Time of the last count, display form. */
  countedAt: string
  /** Gold flag on the right of the meta row, e.g. '1 DOCKET INCOMING'. */
  flag?: string
}

export type BarInventoryLine = {
  skuId: string
  name: string
  quantity: string
  unit: string
  tone: Tone
  /** 'RECEIVED 48 · WASTE 2 · RETURNED 0' — derived from the ledger. */
  movementSummary: string
}

export type IncomingDocket = {
  docketNo: string
  fromName: string
  toName: string
  summary: string
  ageLabel: string
}

export type BarDetail = {
  id: string
  name: string
  managerName: string
  asOf: AsOf
  categoryTotals: { label: string; containers: number }[]
  incoming?: IncomingDocket
  inventory: BarInventoryLine[]
}

// ---------------------------------------------------------------------------
// activity / movement
// ---------------------------------------------------------------------------

/** The design's five filter groups, in its order. */
export const ACTIVITY_GROUPS = ['All', 'Transfers', 'Counts', 'Waste', 'Adjustments'] as const
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]

export type LedgerEntry = {
  id: string
  group: Exclude<ActivityGroup, 'All'>
  at: string
  title: string
  detail: string
  /** Actor(s), upper case: 'CHANDAN → RAHUL'. */
  who: string
  tone: Tone
  /** Adjustments carry an AUDIT badge and a tinted row in the design. */
  flagged: boolean
}

export type MovementDetail = {
  id: string
  kindLabel: string
  tone: Tone
  title: string
  detail: string
  rows: { label: string; value: string; tone?: Tone }[]
}

// ---------------------------------------------------------------------------
// home
// ---------------------------------------------------------------------------

export type StockPosition = {
  totalContainers: number
  byArea: { label: string; containers: number }[]
  asOf: AsOf
}

export type Alert = {
  id: string
  level: 'CRITICAL' | 'WARNING'
  ageLabel: string
  title: string
  subtitle: string
  metric: string
  metricUnit: string
  /** Meter fill, 0–100. */
  meterPct: number
  meterNote: string
  actionLabel: string
  tone: Tone
  /** Screen key the CTA navigates to. */
  target: string
}

// ---------------------------------------------------------------------------
// warehouse / sku
// ---------------------------------------------------------------------------

export type CatalogueItem = {
  skuId: string
  name: string
  spec: string
  primary: string
  secondary: string
  lastMovement: string
  tone: Tone
}

export type CatalogueGroup = {
  key: string
  name: string
  totalLabel: string
  items: CatalogueItem[]
}

// ---------------------------------------------------------------------------
// session (more)
// ---------------------------------------------------------------------------

/**
 * Device and signed-in identity, shown on the More screen's sync card.
 *
 * Note these are independent of role: the design shows the MANAGER badge and
 * "SIGNED IN: RAHUL" together. Deriving the name from the role was an invention.
 * Comes from auth once BAR-137/BAR-141 land.
 */
export type SessionInfo = {
  deviceLabel: string
  signedInName: string
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

export interface Repository {
  /** Identifies which implementation is serving, for the UI to surface honestly. */
  readonly kind: 'fixture' | 'live'

  asOf(): Promise<AsOf>
  session(): Promise<SessionInfo>

  stockPosition(): Promise<StockPosition>
  alerts(): Promise<Alert[]>

  listBars(): Promise<BarSummary[]>
  barDetail(barId: string): Promise<BarDetail | null>

  catalogue(): Promise<CatalogueGroup[]>

  ledger(group?: ActivityGroup): Promise<LedgerEntry[]>
  movementDetail(id: string): Promise<MovementDetail | null>
}

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
// custody chain: review -> docket -> accept -> diff -> received
// ---------------------------------------------------------------------------

/** A labelled row, used by all four custody detail panels. */
export type DetailRow = { label: string; value: string; tone?: Tone }

/**
 * Everything the custody flow displays for one docket.
 *
 * Quantities the design derives (cases, litres, warehouse-after, short-by) are
 * NOT stored here — the screens compute them from `unitsPerCase`,
 * `mlPerContainer` and `expectedContainers`, so they stay correct when the
 * quantity changes. The previous implementation hardcoded such figures, which is
 * how "1.5 cases" appeared next to a container count that could not produce it.
 */
export type Custody = {
  docketNo: string
  /**
   * BAR-133. The receiving location's id, so the received screen's CTA can
   * navigate to the bar it just delivered to. Previously the screen carried the
   * literal `'bar-3'`, which is a fixture id: under live data every id is a UUID
   * and the button went nowhere.
   */
  toLocationId: string
  /** Design: 'AWAITING ACCEPTANCE'. */
  statusLabel: string
  fromName: string
  toName: string
  issuedBy: string
  issuedAt: string
  productName: string
  productSpec: string
  unitsPerCase: number
  mlPerContainer: number
  /** What the docket says was issued. */
  expectedContainers: number
  /** Warehouse position before the issue, for the review screen's after-figure. */
  warehouseBefore: number
  /** design-script.jsx `diffReasons`. */
  differenceReasons: string[]
  /** Who is receiving, for the receipt record. */
  acceptedBy: string
  acceptedAt: string
}

// ---------------------------------------------------------------------------
// count -> countDone -> variance
// ---------------------------------------------------------------------------

/**
 * How a partial (open) container is measured for one SKU. Specification §6:
 * "count full containers as integers and weigh partials".
 *
 * `none`  — bottled/canned beer, 1:1, nothing to weigh
 * `ml`    — spirits: (gross − tare) ≈ ml, so the SKU's tare weight is shown
 * `litres`— kegs: flow meter or weight
 */
export type PartialMode = 'none' | 'ml' | 'litres'

export type CountLine = {
  skuId: string
  name: string
  spec: string
  partial: PartialMode
  /** Increment for the partial stepper — 50 ml for spirits, 1 L for kegs. */
  partialStep: number
  /** Unit caption under the partial figure, e.g. 'ML BY WEIGHT'. */
  partialUnit: string
  /** Method hint, e.g. 'WEIGH · TARE 480 G'. */
  partialHint: string
}

export type CountSession = {
  /** BAR-133. The counted location's id, for the same reason as `Custody.toLocationId`. */
  locationId: string
  locationName: string
  /** 'MID-EVENT COUNT' */
  kindLabel: string
  /** 'BAR 3 · BLIND' */
  scopeLabel: string
  /** Total lines in the session — the design's session is 18. */
  totalLines: number
  /** Preset buttons for the full-container stepper. */
  presets: number[]
  lines: CountLine[]
  countedBy: string
  witnessedBy: string
  sealedAt: string
}

export type VarianceLine = {
  skuId: string
  name: string
  expected: string
  counted: string
  delta: string
  pct: string
  tone: Tone
  note: string
  /** The design tints the note gold when the variance is positive. */
  noteTone?: Tone
}

export type VarianceReport = {
  locationName: string
  /** 'AMBER' — the band, per spec §8's tolerance table. */
  bandLabel: string
  bandTone: Tone
  throughputLabel: string
  varianceLabel: string
  /** 'MID-EVENT COUNT 19:52 · COUNTED BY RAHUL · % OF THROUGHPUT' */
  basisLabel: string
  lines: VarianceLine[]
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

  custody(docketNo?: string): Promise<Custody>

  countSession(locationId?: string): Promise<CountSession>
  /**
   * Variance for a location. Manager-gated: spec §6 requires the expected
   * figure to reach a different person than the counter, and §13's access tier
   * puts variance behind management. Enforcement is in the database (ADR-005);
   * this signature exists so the UI can ask honestly.
   */
  variance(locationId?: string): Promise<VarianceReport>
}

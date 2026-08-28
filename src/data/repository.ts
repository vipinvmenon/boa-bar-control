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
  /**
   * BAR-146. **All** dockets awaiting acceptance at this bar, not one.
   *
   * This was a single optional docket, and `barDetail` picked the first with
   * `.find`. `listBars` meanwhile reported `2 DOCKETS INCOMING` correctly — so a
   * second docket issued to the same bar could not be opened, could not be
   * accepted, and its stock sat in `in_transit`, which no screen read. Stock that
   * had left the warehouse and could never arrive: exactly the case specification
   * §5 exists to resolve, and worse than not shipping the feature, because the
   * ledger says it exists.
   */
  incoming: IncomingDocket[]
  inventory: BarInventoryLine[]
}

/** A docket awaiting acceptance, for the awaiting-dockets list. */
export type AwaitingDocket = {
  /** The docket number, which is also what the routes are keyed by. */
  docketNo: string
  fromName: string
  toName: string
  summary: string
  ageLabel: string
  /** Past the acceptance SLA the design draws its meter against. */
  overdue: boolean
}

/**
 * Everything in custody between two locations right now.
 *
 * `inTransitContainers` exists because `in_transit` is a real location holding
 * real stock that no screen previously read (BAR-146). A figure nobody can see is
 * indistinguishable from stock that has gone missing.
 */
export type CustodyOverview = {
  dockets: AwaitingDocket[]
  inTransitContainers: number
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
// issue
// ---------------------------------------------------------------------------

export type IssueDestination = {
  id: string
  /** Display name in the design's data vocabulary, e.g. `BAR 3`. */
  name: string
}

export type IssueProduct = {
  skuId: string
  name: string
  /** Compact identity used by the review hero; the detail row keeps `name`. */
  reviewName: string
  /** Design form: `Beer · 650 ml · 24 per case`. */
  issueSpec: string
  unitsPerCase: number
  mlPerContainer: number
  /** The source location's current ledger-derived position. */
  warehouseContainers: number
  /** Display vocabulary from the SKU's container type. */
  containerUnitSingular: string
  containerUnitPlural: string
}

/** Everything needed to build an issue draft before a docket exists. */
export type IssueOptions = {
  fromLocationId: string
  fromName: string
  destinations: IssueDestination[]
  defaultDestinationId: string
  products: IssueProduct[]
  defaultProductId: string
  issuedBy: string
  issuedAt: string
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
  /**
   * BAR-044. The docket's primary key, which is what `boa_bar_accept_docket`
   * takes. `docketNo` is the human label printed on paper and shown on screen;
   * accepting by label would break the moment two venues existed.
   */
  docketId: string
  docketNo: string
  /** The SKU being moved, for the acceptance command. */
  skuId: string
  /** Source location id, for the issue command. */
  fromLocationId: string
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

export type CountKind = 'opening_warehouse' | 'opening_bar' | 'mid_event' | 'close_out'

export type CountSession = {
  /** BAR-133. The counted location's id, for the same reason as `Custody.toLocationId`. */
  locationId: string
  /** Which count this is, for the submit command. */
  countKind: CountKind
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
// commands — the write side
// ---------------------------------------------------------------------------

/**
 * BAR-044. Writes are on the repository, not on a Supabase call in a screen,
 * because `docs/ARCHITECTURE.md` puts one interface between the use cases and all
 * IO. The live implementation appends to the outbox; the fixture implementation
 * records in memory so the design walkthrough still works. Neither is reachable
 * from a screen except through a service in `src/services/`.
 */
export type DocketLineCommand = {
  skuId: string
  /** Containers. Millilitres are derived from the SKU, not supplied by the UI. */
  containers: number
}

export type CreateDocketCommand = {
  /**
   * Minted once per user action and reused on retry (BAR-069). Supplied by the
   * caller rather than generated here: a repository call happens once per attempt,
   * and a key minted per attempt defeats its own purpose.
   */
  idempotencyKey: string
  fromLocationId: string
  toLocationId: string
  lines: DocketLineCommand[]
}

export type AcceptDocketCommand = {
  idempotencyKey: string
  docketId: string
  /** What was actually received, per line. */
  lines: DocketLineCommand[]
  /** Required by the database when any line is short (BAR-058). */
  differenceReason?: string
}

/**
 * What a write returns.
 *
 * `posted` means the server has it and the docket number is real — minted
 * server-side under an advisory lock, so it exists nowhere else.
 *
 * `queued` means the write is durable in the outbox but has not posted. This is
 * the ordinary offline state, and it is NOT a failure: the distinction exists so a
 * screen can say "queued" rather than either claiming success or reporting loss.
 * A failure throws.
 */
export type WriteOutcome =
  | { status: 'posted'; docketId: string; docketNo: string; token?: string }
  | { status: 'queued'; outboxId: string }

export type CountLineCommand = {
  skuId: string
  fullContainers: number
  /** Millilitres in the open container, 0 when there is none. */
  partialMl: number
  /** The scale reading, kept as evidence where a partial was weighed. */
  grossWeightG?: number
}

export type SubmitCountCommand = {
  idempotencyKey: string
  locationId: string
  countKind: CountKind
  lines: CountLineCommand[]
}

/**
 * What submitting a count returns.
 *
 * Carries no expected figure and no variance, deliberately: the device that
 * submitted a blind count must not learn the expected position from the reply
 * (non-negotiable 3).
 */
export type CountWriteOutcome =
  | { status: 'posted'; countSessionId: string; lines: number }
  | { status: 'queued'; outboxId: string }

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

  /** Every docket awaiting acceptance, and what is sitting in transit (BAR-146). */
  custodyOverview(): Promise<CustodyOverview>

  /** Source, destinations and SKU positions for the issue-stock draft screen. */
  issueOptions(): Promise<IssueOptions>

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

  // -- commands -------------------------------------------------------------

  /** Issue stock: mints the docket and posts leg 1 (source -> in_transit). */
  createDocket(command: CreateDocketCommand): Promise<WriteOutcome>

  /** The second named person takes custody, posting leg 2 (in_transit -> destination). */
  acceptDocket(command: AcceptDocketCommand): Promise<WriteOutcome>

  /**
   * Record a blind count. Creates the session, writes the observed lines and
   * seals the ledger-derived expected position server-side (BAR-082/BAR-084).
   */
  submitCount(command: SubmitCountCommand): Promise<CountWriteOutcome>
}

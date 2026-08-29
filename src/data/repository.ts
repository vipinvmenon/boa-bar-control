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
  /**
   * BAR-145. The live submitted count for this location, if there is one — what a
   * new count would replace. Null when this is the first count of the location.
   *
   * Carries only an id, never a figure: knowing that an earlier count exists
   * discloses nothing about the position, which is what blind counting protects.
   */
  supersedesSessionId: string | null
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
// waste
// ---------------------------------------------------------------------------

export type WasteProduct = {
  skuId: string
  name: string
  spec: string
  containerUnitPlural: string
}

/**
 * What the waste screen needs.
 *
 * Deliberately carries **no on-hand position**. The design's waste screen shows
 * product, quantity and reason only — and a position figure here would be a
 * disclosure to a bar lead who may be mid-count at that same location, which is
 * exactly what blind counting forbids (non-negotiable 3). The quantity is bounded
 * server-side instead: `boa_bar_record_waste` refuses more than the location
 * holds.
 */
export type WasteOptions = {
  locationId: string
  locationName: string
  products: WasteProduct[]
  defaultProductId: string
  /** design-script.jsx:308, enforced identically in the database. */
  reasons: string[]
}

// ---------------------------------------------------------------------------
// receipt
// ---------------------------------------------------------------------------

/** What the receipt screen needs. Carries no position: a delivery adds stock,
 * and what was already there does not change what arrived. */
export type ReceiptOptions = {
  locationId: string
  locationName: string
  products: WasteProduct[]
  defaultProductId: string
}

export type ReceiptLineCommand = { skuId: string; containers: number }

export type RecordReceiptCommand = {
  idempotencyKey: string
  locationId: string
  /** Required by spec §4 — a receipt is posted against a delivery note. */
  supplier: string
  deliveryNote: string
  lines: ReceiptLineCommand[]
}

// ---------------------------------------------------------------------------
// paper fallback (BAR-092)
// ---------------------------------------------------------------------------

export type PrintSheetLine = {
  skuId: string
  name: string
  spec: string
  /** What the partial column is measured in for this SKU, or '' where there is none. */
  partialUnit: string
}

export type PrintSheet = {
  locationId: string
  locationName: string
  lines: PrintSheetLine[]
}

/**
 * Everything needed to print the paper fallback.
 *
 * Carries **no quantity of any kind** — not an expected figure, not a last count,
 * not a par level. A printed sheet is handed to the person counting, so a number
 * on it defeats blind counting exactly as a number on the screen would, and a
 * sheet cannot be un-printed once it is in a folder.
 */
export type PrintPack = {
  venueName: string
  eventDate: string
  /** When the pack was produced, so two versions in a folder can be told apart. */
  preparedAt: string
  sheets: PrintSheet[]
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

export type RecordWasteCommand = {
  idempotencyKey: string
  /** BAR-133. The bar that recorded it, never a default. */
  locationId: string
  skuId: string
  containers: number
  reason: string
}

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
  /** BAR-145. The count this one replaces. Requires `supersedeReason`. */
  supersedesSessionId?: string
  /** Why the earlier count was wrong. The database requires it when superseding. */
  supersedeReason?: string
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

  /** Products and reasons for the waste screen. Carries no position figure. */
  wasteOptions(locationId?: string): Promise<WasteOptions>

  /** Source location and products for the delivery screen (BAR-060). */
  receiptOptions(): Promise<ReceiptOptions>

  /** The printable paper fallback: one count sheet per location (BAR-092). */
  printPack(): Promise<PrintPack>

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
   * BAR-161. Open a count on a location. Creating the draft session is what
   * blinds this device to that location's position, so it must happen before the
   * counter is shown the sheet.
   *
   * Returns the session id. Not queued through the outbox: a blind that takes
   * effect three seconds late is not a blind.
   */
  openCount(locationId: string, countKind: CountKind): Promise<{ countSessionId: string }>

  /**
   * Record a blind count. Writes the observed lines, closes the open session and
   * seals the ledger-derived expected position server-side (BAR-082/BAR-084).
   */
  submitCount(command: SubmitCountCommand): Promise<CountWriteOutcome>

  /** Record waste against the recording location (BAR-063/BAR-133). */
  recordWaste(command: RecordWasteCommand): Promise<CountWriteOutcome>

  /** Record a delivery against its delivery note (BAR-060). */
  recordReceipt(command: RecordReceiptCommand): Promise<CountWriteOutcome>
}

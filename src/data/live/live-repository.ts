/**
 * BAR-042 — the live repository.
 *
 * The same interface the fixture repository implements, answered from the
 * database. Selected once at bootstrap (RepositoryProvider); never reached as a
 * fallback, and never falling back to fixtures itself. If a read fails it throws
 * and the screen shows an error, because the alternative — quietly serving the
 * design's sample stock — is the defect this whole project is recovering from
 * (BAR-067).
 *
 * Reads only. Every write goes through a command RPC (ADR-013), which is why the
 * `authenticated` role holds no INSERT on any table.
 *
 * Two rules govern everything below:
 *
 *   1. No figure is invented. Where the schema cannot yet produce something the
 *      design displays, this file omits it and says so in a comment — it does not
 *      substitute a plausible number. Those omissions are listed in
 *      docs/CURRENT-STATE.md rather than hidden here.
 *   2. Time is the server's, in the venue's timezone. A crew phone with a wrong
 *      clock must not be able to age a docket or stamp a count.
 */
import { openCountRpc, rpc, supabase } from '../../lib/supabase'
import {
  cacheReference,
  cacheSnapshot,
  NoCachedDataError,
  readCachedReference,
  readCachedSnapshot,
} from './cache'
import { enqueueCommand, OutboxPendingError, waitForCommand } from '../../lib/offline-db'
import { mlForContainers } from '../../domain/custody'
import {
  actorLabel,
  groupKey,
  GROUP_ORDER,
  isKeg,
  issueSpecLabel,
  makeClock,
  partialHintFor,
  partialModeFor,
  partialStepFor,
  partialUnitFor,
  quantityPair,
  signed,
  signedPct,
  specLabel,
  thousands,
  unitWord,
  volumeLabel,
  type Clock,
  type SkuShape,
} from './format'
import {
  COUNT_LINE_COLUMNS,
  COUNT_SESSION_COLUMNS,
  DOCKET_COLUMNS,
  DOCKET_LINE_COLUMNS,
  isEmpty,
  LOCATION_COLUMNS,
  MEMBERSHIP_COLUMNS,
  MOVEMENT_COLUMNS,
  MOVEMENT_LINE_COLUMNS,
  PERSON_COLUMNS,
  SKU_COLUMNS,
  unwrap,
  type CountLineRow,
  type CountSessionRow,
  type DocketLineRow,
  type DocketRow,
  type LocationRow,
  type MembershipRow,
  type MovementLineRow,
  type MovementRow,
  type PersonRow,
  type SkuRow,
  type SnapshotRow,
  type ToleranceBandRow,
} from './rows'
import type {
  AcceptDocketCommand,
  ActivityGroup,
  Alert,
  AsOf,
  BarDetail,
  BarInventoryLine,
  BarSummary,
  CatalogueGroup,
  CountKind,
  CountSession,
  CountWriteOutcome,
  Custody,
  CustodyOverview,
  IssueOptions,
  LedgerEntry,
  MovementDetail,
  CreateDocketCommand,
  Repository,
  SessionInfo,
  StockPosition,
  SubmitCountCommand,
  CreateInviteCommand,
  PrintPack,
  ReceiptOptions,
  SetMembershipCommand,
  Team,
  VenueRole,
  RecordReceiptCommand,
  RecordWasteCommand,
  RequestTopUpCommand,
  TopUpWriteOutcome,
  UpdateTopUpCommand,
  Tone,
  VarianceReport,
  WasteOptions,
  WriteOutcome,
} from '../repository'

export type LiveContext = {
  venueId: string
  userId: string
  /** boa_bar_venue.timezone. Never the device's. */
  timezone: string
  role: 'crew' | 'warehouse' | 'bar_lead' | 'manager' | 'auditor' | 'admin'
  /** The membership's assigned location, if it has one. */
  locationId: string | null
}

/**
 * How long a bar may go between counts before the bars list calls it due.
 *
 * ASSUMPTION, not derived from the specification: the spec fixes the count
 * *events* (opening, mid-event, close-out) but never states a maximum interval,
 * and the design's sample data shows a bar last counted at 15:10 flagged overdue
 * at 19:43. Two hours reproduces that. It needs the operating decision from the
 * user before 10 October — recorded in docs/CURRENT-STATE.md.
 */
export const COUNT_DUE_AFTER_MINUTES = 120

/**
 * The docket acceptance SLA the home screen's meter is drawn against. Taken from
 * the design, which labels that meter `30 MIN SLA` verbatim.
 */
export const DOCKET_SLA_MINUTES = 30

/** The count screen's full-container presets. A design constant, not data. */
const COUNT_PRESETS = [0, 6, 12, 24]

/**
 * design-script.jsx:308. Held here AND enforced by `boa_bar_record_waste`, so a
 * reason the database will reject is never offerable — the same reasoning as the
 * docket difference reasons.
 */
const WASTE_REASONS = ['Breakage', 'Spillage', 'Foam / line loss', 'Refused pour', 'Other']

/** Sales and comps are excluded from the activity feed: at festival volume they
 * would be thousands of rows and the design's feed shows none of them. They
 * remain in the ledger and in every calculation. */
const LEDGER_KINDS = ['receipt', 'issue', 'transfer', 'return', 'waste', 'adjustment'] as const

const REFERENCE_TTL_MS = 5 * 60_000
const SNAPSHOT_TTL_MS = 15_000

type Reference = {
  locations: LocationRow[]
  locationById: Map<string, LocationRow>
  skus: SkuRow[]
  skuById: Map<string, SkuRow>
  people: Map<string, PersonRow>
  memberships: MembershipRow[]
}

type Snapshot = {
  rows: SnapshotRow[]
  /** Server time, so ages and stamps do not depend on the device clock. */
  now: Date
}

function bandFor(category: string, percentage: number | null, bands: Map<string, [number, number]>): 'green' | 'amber' | 'red' {
  if (percentage === null) return 'amber'
  const [greenMax, amberMax] = bands.get(category) ?? [2, 5]
  const absolute = Math.abs(percentage)
  const onMagnitude = absolute <= greenMax ? 'green' : absolute <= amberMax ? 'amber' : 'red'
  return percentage > 0 && onMagnitude === 'green' ? 'amber' : onMagnitude
}

function client() {
  if (!supabase) {
    // Unreachable in practice: RepositoryProvider only builds a live repository
    // when the client exists. Kept so the failure is a message, not a crash.
    throw new Error('Live repository requires a configured Supabase client')
  }
  return supabase
}

function toSkuShape(sku: SkuRow): SkuShape {
  return {
    categoryKey: sku.category_key,
    containerType: sku.container_type,
    mlPerContainer: sku.ml_per_container,
    unitsPerCase: sku.units_per_case,
    tareWeightG: sku.tare_weight_g === null ? null : Number(sku.tare_weight_g),
  }
}

/** A small time-bounded cache, so one screen render does not fetch the snapshot
 * five times while a stale figure can never outlive a few seconds. */
function cached<T>(ttlMs: number, load: () => Promise<T>) {
  let value: { at: number; promise: Promise<T> } | null = null
  return (): Promise<T> => {
    const now = Date.now()
    if (value && now - value.at < ttlMs) return value.promise
    const promise = load().catch((error: unknown) => {
      // A failed load must not be cached, or a single network blip persists for
      // the whole TTL.
      value = null
      throw error
    })
    value = { at: now, promise }
    return promise
  }
}

export function createLiveRepository(context: LiveContext): Repository {
  const db = client()
  const clock: Clock = makeClock(context.timezone)
  const { venueId } = context

  async function toleranceBands(): Promise<Map<string, [number, number]>> {
    const rows = await db.rpc('boa_bar_tolerance_bands').then((r) => unwrap<ToleranceBandRow[]>('tolerance bands', r))
    return new Map(rows.map((row) => [row.category_key, [Number(row.green_max_pct), Number(row.amber_max_pct)] as [number, number]]))
  }

  // -------------------------------------------------------------------------
  // Reference data and the position snapshot
  // -------------------------------------------------------------------------

  /**
   * BAR-066 / BAR-067. Load reference data, cache it, and fall back to that cache
   * when the network fails.
   *
   * Never to fixtures. If the cache is empty this throws, and the screen shows an
   * error — a venue with no cached SKU list is a device that has never been online,
   * and inventing a catalogue for it is how the design's sample stock became live
   * festival inventory.
   */
  const reference = cached<Reference>(REFERENCE_TTL_MS, async () => {
    try {
      return await loadReference()
    } catch (networkError) {
      const cachedRef = await readCachedReference(venueId)
      if (!cachedRef) {
        console.warn('[boa] reference load failed and no cache exists', networkError)
        throw new NoCachedDataError('The SKU list and locations')
      }
      return shapeReference(cachedRef.locations, cachedRef.skus, cachedRef.people, cachedRef.memberships)
    }
  })

  function shapeReference(
    locations: LocationRow[],
    skus: SkuRow[],
    people: PersonRow[],
    memberships: MembershipRow[],
  ): Reference {
    return {
      locations,
      locationById: new Map(locations.map((l) => [l.id, l])),
      skus,
      skuById: new Map(skus.map((s) => [s.id, s])),
      people: new Map(people.map((p) => [p.user_id, p])),
      memberships,
    }
  }

  async function loadReference(): Promise<Reference> {
    const [locations, skus, people, memberships] = await Promise.all([
      db
        .from('boa_bar_location')
        .select(LOCATION_COLUMNS)
        .eq('venue_id', venueId)
        .eq('active', true)
        .order('code')
        .then((r) => unwrap<LocationRow[]>('locations', r)),
      db
        .from('boa_bar_sku')
        .select(SKU_COLUMNS)
        .eq('venue_id', venueId)
        .eq('active', true)
        .order('code')
        .then((r) => unwrap<SkuRow[]>('skus', r)),
      db
        .from('boa_bar_person')
        .select(PERSON_COLUMNS)
        .eq('venue_id', venueId)
        .then((r) => unwrap<PersonRow[]>('people', r)),
      db
        .from('boa_bar_membership')
        .select(MEMBERSHIP_COLUMNS)
        .eq('venue_id', venueId)
        .eq('active', true)
        .then((r) => unwrap<MembershipRow[]>('memberships', r)),
    ])

    // Cached on every successful load, which is what "cached on every sync" means
    // in practice: the app reloads reference data every five minutes anyway.
    await cacheReference(venueId, { locations, skus, people, memberships })
    return shapeReference(locations, skus, people, memberships)
  }

  /**
   * The position, with the same fallback.
   *
   * A cached position is a STALE position, and it is only safe to show one because
   * every screen carries the design's `AS OF hh:mm` stamp and this returns the
   * server time the snapshot was taken at — so a screen served from cache reads
   * "AS OF 19:43" while the clock says 21:00. If a screen ever drops that stamp,
   * this stops being safe.
   */
  const snapshot = cached<Snapshot>(SNAPSHOT_TTL_MS, async () => {
    try {
      return await loadSnapshot()
    } catch (networkError) {
      const cachedSnap = await readCachedSnapshot(venueId)
      if (!cachedSnap) {
        console.warn('[boa] snapshot load failed and no cache exists', networkError)
        throw new NoCachedDataError('The stock position')
      }
      return cachedSnap
    }
  })

  async function loadSnapshot(): Promise<Snapshot> {
    const [rows, status] = await Promise.all([
      db
        .rpc('boa_bar_inventory_snapshot', { p_venue_id: venueId })
        .then((r) => unwrap<SnapshotRow[]>('inventory snapshot', r)),
      db
        .rpc('boa_bar_sync_status', { p_venue_id: venueId })
        .then((r) => unwrap<{ server_time: string; latest_posted_at: string | null; movement_count: number }[]>(
          'sync status',
          r,
        )),
    ])
    const serverTime = status[0]?.server_time
    if (!serverTime) throw new Error('sync status returned no server time')
    await cacheSnapshot(venueId, rows, serverTime)
    return { rows, now: new Date(serverTime) }
  }

  /** First name, upper case, for a user id. */
  function who(ref: Reference, userId: string | null | undefined): string {
    if (!userId) return 'UNNAMED'
    return actorLabel(ref.people.get(userId)?.short_name)
  }

  function locationName(ref: Reference, id: string | null | undefined): string {
    if (!id) return 'UNKNOWN'
    return ref.locationById.get(id)?.name ?? 'UNKNOWN'
  }

  // -------------------------------------------------------------------------
  // Movement reads, shared by the ledger, the bar detail and variance
  // -------------------------------------------------------------------------

  async function movementLinesFor(movementIds: string[]): Promise<MovementLineRow[]> {
    if (isEmpty(movementIds)) return []
    return db
      .from('boa_bar_movement_line')
      .select(MOVEMENT_LINE_COLUMNS)
      .in('movement_id', movementIds)
      .then((r) => unwrap<MovementLineRow[]>('movement lines', r))
  }

  async function docketsById(ids: string[]): Promise<Map<string, DocketRow>> {
    if (isEmpty(ids)) return new Map()
    const rows = await db
      .from('boa_bar_docket')
      .select(DOCKET_COLUMNS)
      .in('id', ids)
      .then((r) => unwrap<DocketRow[]>('dockets', r))
    return new Map(rows.map((d) => [d.id, d]))
  }

  async function awaitingDockets(): Promise<DocketRow[]> {
    return db
      .from('boa_bar_docket')
      .select(DOCKET_COLUMNS)
      .eq('venue_id', venueId)
      .eq('status', 'awaiting')
      .order('issued_at', { ascending: true })
      .then((r) => unwrap<DocketRow[]>('awaiting dockets', r))
  }

  async function latestCountSessions(): Promise<CountSessionRow[]> {
    return db
      .from('boa_bar_count_session')
      .select(COUNT_SESSION_COLUMNS)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(80)
      .then((r) => unwrap<CountSessionRow[]>('count sessions', r))
  }

  /**
   * The ledger position of one location at an instant, summed from movement
   * lines. Deliberately NOT read from private.boa_bar_balance: that projection
   * only holds the position *now*, and a variance report compares against the
   * position at the moment the count was sealed. Summing the ledger is also the
   * definition of stock on this project (non-negotiable 2).
   */
  async function positionAt(locationId: string, atIso: string) {
    const movements = await db
      .from('boa_bar_movement')
      .select('id, occurred_at, kind')
      .eq('venue_id', venueId)
      .lte('occurred_at', atIso)
      .then((r) => unwrap<{ id: string; occurred_at: string; kind: MovementRow['kind'] }[]>('movements to date', r))

    const lines = await movementLinesFor(movements.map((m) => m.id))
    const kindById = new Map(movements.map((m) => [m.id, m.kind]))

    const position = new Map<string, { containers: number; ml: number }>()
    /** Volume that entered this location in the window — the denominator the
     * variance report can honestly use until POS import lands. */
    const receivedMl = new Map<string, number>()

    for (const line of lines) {
      if (line.location_id !== locationId) continue
      const current = position.get(line.sku_id) ?? { containers: 0, ml: 0 }
      current.containers += Number(line.container_delta)
      current.ml += Number(line.ml_delta)
      position.set(line.sku_id, current)

      const kind = kindById.get(line.movement_id)
      if (Number(line.ml_delta) > 0 && (kind === 'issue' || kind === 'receipt' || kind === 'transfer')) {
        receivedMl.set(line.sku_id, (receivedMl.get(line.sku_id) ?? 0) + Number(line.ml_delta))
      }
    }

    return { position, receivedMl }
  }

  // -------------------------------------------------------------------------
  // The interface
  // -------------------------------------------------------------------------

  return {
    kind: 'live',

    async asOf(): Promise<AsOf> {
      const { now } = await snapshot()
      return { label: clock.time(now.toISOString()), at: now.toISOString() }
    },

    async session(): Promise<SessionInfo> {
      const ref = await reference()
      const mine = ref.memberships.find((m) => m.user_id === context.userId && m.location_id)
      /**
       * The design shows a device identifier (`BAR-3-01`). There is no device
       * registry in the schema — nothing issues or records one — so the closest
       * true statement is the location this membership is posted to. A fabricated
       * `-01` suffix would look like a registered device and is not written.
       * Device registration is required by BAR-137 (shared devices) and is
       * recorded as outstanding.
       */
      const deviceLabel = mine?.location_id
        ? (ref.locationById.get(mine.location_id)?.code ?? 'UNPOSTED').toUpperCase()
        : 'UNPOSTED'
      return {
        deviceLabel,
        signedInName: who(ref, context.userId),
      }
    },

    async stockPosition(): Promise<StockPosition> {
      const { rows, now } = await snapshot()

      const order: { kind: LocationRow['kind']; label: string }[] = [
        { kind: 'warehouse', label: 'WAREHOUSE' },
        { kind: 'bar', label: 'BARS' },
        { kind: 'hospitality', label: 'HOSPITALITY' },
        { kind: 'lounge', label: 'LOUNGES' },
        { kind: 'in_transit', label: 'IN TRANSIT' },
      ]

      const byKind = new Map<string, number>()
      let total = 0
      for (const row of rows) {
        const containers = Number(row.containers)
        total += containers
        byKind.set(row.location_kind, (byKind.get(row.location_kind) ?? 0) + containers)
      }

      return {
        totalContainers: total,
        // Warehouse and bars always show, even at zero — a missing WAREHOUSE tile
        // reads as a layout change rather than as an empty warehouse. The other
        // kinds appear only where the venue actually uses them.
        byArea: order
          .filter((a) => a.kind === 'warehouse' || a.kind === 'bar' || (byKind.get(a.kind) ?? 0) !== 0)
          .map((a) => ({ label: a.label, containers: byKind.get(a.kind) ?? 0 })),
        asOf: { label: clock.time(now.toISOString()), at: now.toISOString() },
      }
    },

    async alerts(): Promise<Alert[]> {
      const [ref, snap, awaiting, counts] = await Promise.all([
        reference(),
        snapshot(),
        awaitingDockets(),
        latestCountSessions(),
      ])
      const now = snap.now
      const alerts: Alert[] = []

      /**
       * The design's third alert — `Bar 3 · Kingfisher low · 12 LEFT · RUN-OUT
       * ~20:10 · 26 MIN OF COVER` — is NOT produced here, and this is the single
       * most visible gap in the live read path.
       *
       * It needs two things the schema does not have: a par level or reorder
       * point per SKU per location (there is no such column), and a depletion
       * rate, which needs POS sales that only arrive with the import in M5.
       * Inventing either would put a run-out time on a manager's home screen
       * that no calculation stands behind. Recorded as outstanding rather than
       * approximated.
       */

      const oldest = awaiting[0]
      if (oldest) {
        const age = clock.minutesBetween(oldest.issued_at, now) ?? 0
        alerts.push({
          id: 'dockets-awaiting',
          level: age >= DOCKET_SLA_MINUTES ? 'CRITICAL' : 'WARNING',
          ageLabel: `OLDEST ${age} MIN`,
          title: awaiting.length === 1 ? 'Docket awaiting acceptance' : 'Dockets awaiting acceptance',
          subtitle: `${oldest.docket_no} ${locationName(ref, oldest.from_location_id)} → ${locationName(ref, oldest.to_location_id)}`,
          metric: String(awaiting.length),
          metricUnit: 'OPEN',
          meterPct: Math.min(100, Math.round((age / DOCKET_SLA_MINUTES) * 100)),
          meterNote: `${DOCKET_SLA_MINUTES} MIN SLA`,
          actionLabel: 'OPEN',
          tone: age >= DOCKET_SLA_MINUTES ? 'red' : 'gold',
          target: 'accept',
        })
      }

      const bars = ref.locations.filter((l) => l.kind === 'bar')
      for (const bar of bars) {
        const last = counts.find((c) => c.location_id === bar.id && c.submitted_at !== null)
        const age = last ? clock.minutesBetween(last.submitted_at, now) : null
        const late = age === null ? null : age - COUNT_DUE_AFTER_MINUTES
        if (late === null || late > 0) {
          alerts.push({
            id: `count-due-${bar.code}`,
            level: 'WARNING',
            ageLabel: last ? `LAST ${clock.time(last.submitted_at)}` : 'NEVER COUNTED',
            title: `${bar.name} count overdue`,
            subtitle: last
              ? `Last counted ${clock.time(last.submitted_at)} · ${who(ref, last.assigned_to)}`
              : 'No count has been submitted for this bar',
            metric: late === null ? '—' : String(late),
            metricUnit: late === null ? 'NO COUNT' : 'MIN LATE',
            meterPct: late === null ? 100 : Math.min(100, Math.round((late / COUNT_DUE_AFTER_MINUTES) * 100)),
            meterNote: `COUNT DUE EVERY ${COUNT_DUE_AFTER_MINUTES} MIN`,
            actionLabel: 'COUNT',
            tone: late === null ? 'red' : 'gold',
            target: 'count',
          })
        }
      }

      // Most urgent first: the home screen shows a short list.
      const severity = (a: Alert) => (a.level === 'CRITICAL' ? 0 : 1)
      return alerts.sort((a, b) => severity(a) - severity(b) || b.meterPct - a.meterPct)
    },

    async listBars(): Promise<BarSummary[]> {
      const [ref, snap, awaiting, counts] = await Promise.all([
        reference(),
        snapshot(),
        awaitingDockets(),
        latestCountSessions(),
      ])
      const now = snap.now

      const containersByLocation = new Map<string, number>()
      for (const row of snap.rows) {
        containersByLocation.set(
          row.location_id,
          (containersByLocation.get(row.location_id) ?? 0) + Number(row.containers),
        )
      }

      return ref.locations
        .filter((l) => l.kind === 'bar')
        .map((bar) => {
          const lead = ref.memberships.find((m) => m.role === 'bar_lead' && m.location_id === bar.id)
          const last = counts.find((c) => c.location_id === bar.id && c.submitted_at !== null)
          const age = last ? clock.minutesBetween(last.submitted_at, now) : null
          const countDue = age === null || age > COUNT_DUE_AFTER_MINUTES
          const incoming = awaiting.filter((d) => d.to_location_id === bar.id).length

          /**
           * The design's third status, `LOW STOCK`, is not produced: it needs a
           * par level per SKU per location and no such column exists. A bar
           * therefore reads HEALTHY or COUNT DUE, never LOW STOCK, until par
           * levels land. Colouring a bar red on a guessed threshold would send
           * crew to move stock that does not need moving.
           */
          const status = countDue ? 'COUNT DUE' : 'HEALTHY'
          const tone: Tone = countDue ? 'gold' : 'green'

          return {
            id: bar.id,
            name: bar.name.toUpperCase(),
            containers: containersByLocation.get(bar.id) ?? 0,
            status,
            tone,
            // A first name, as the design shows. Not the role, and not an email.
            lead: ref.people.get(lead?.user_id ?? '')?.short_name ?? 'UNASSIGNED',
            countedAt: last ? clock.time(last.submitted_at) : 'NEVER',
            flag: incoming > 0
              ? `${incoming} DOCKET${incoming === 1 ? '' : 'S'} INCOMING`
              : countDue
                ? 'MID-COUNT OVERDUE'
                : undefined,
          }
        })
    },

    async barDetail(barId: string): Promise<BarDetail | null> {
      const [ref, snap, awaiting] = await Promise.all([reference(), snapshot(), awaitingDockets()])
      const bar = ref.locationById.get(barId)
      if (!bar || bar.kind !== 'bar') return null

      const manager = ref.memberships.find((m) => m.role === 'bar_lead' && m.location_id === bar.id)
      const here = snap.rows.filter((r) => r.location_id === bar.id)

      const categoryTotals = GROUP_ORDER.map((group) => ({
        label: group,
        containers: here
          .filter((r) => groupKey(r.category_key) === group)
          .reduce((sum, r) => sum + Number(r.containers), 0),
      })).filter((g) => g.containers !== 0)

      // The design's per-line summary `RECEIVED 48 · WASTE 2 · RETURNED 0`, from
      // the ledger rather than from a stored counter.
      const movements = await db
        .from('boa_bar_movement')
        .select('id, kind')
        .eq('venue_id', venueId)
        .in('kind', ['receipt', 'issue', 'transfer', 'waste', 'return'])
        .then((r) => unwrap<{ id: string; kind: MovementRow['kind'] }[]>('bar movements', r))
      const kindById = new Map(movements.map((m) => [m.id, m.kind]))
      const lines = await movementLinesFor(movements.map((m) => m.id))

      const tally = new Map<string, { received: number; waste: number; returned: number }>()
      for (const line of lines) {
        if (line.location_id !== bar.id) continue
        const t = tally.get(line.sku_id) ?? { received: 0, waste: 0, returned: 0 }
        const kind = kindById.get(line.movement_id)
        const containers = Number(line.container_delta)
        if (containers > 0 && (kind === 'receipt' || kind === 'issue' || kind === 'transfer')) {
          t.received += containers
        }
        if (kind === 'waste') t.waste += Math.abs(containers)
        if (kind === 'return' && containers < 0) t.returned += Math.abs(containers)
        tally.set(line.sku_id, t)
      }

      const inventory: BarInventoryLine[] = here
        .filter((r) => Number(r.containers) !== 0 || tally.has(r.sku_id))
        .map((r) => {
          const sku = ref.skuById.get(r.sku_id)
          const shape = sku ? toSkuShape(sku) : null
          const t = tally.get(r.sku_id) ?? { received: 0, waste: 0, returned: 0 }
          return {
            skuId: r.sku_id,
            name: r.sku_name,
            quantity: thousands(Number(r.containers)),
            unit: shape && isKeg(shape) ? 'KEGS' : unitWord(r.container_type),
            // Tone needs a par level to be meaningful; see listBars.
            tone: 'muted' as Tone,
            movementSummary: `RECEIVED ${t.received} · WASTE ${t.waste} · RETURNED ${t.returned}`,
          }
        })

      // BAR-146: every docket awaiting acceptance here, not just the first.
      const incomingDockets = awaiting.filter((d) => d.to_location_id === bar.id)
      const incomingLines = incomingDockets.length
        ? await db
            .from('boa_bar_docket_line')
            .select(DOCKET_LINE_COLUMNS)
            .in('docket_id', incomingDockets.map((d) => d.id))
            .then((r) => unwrap<DocketLineRow[]>('docket lines', r))
        : []
      const incomingSummary: BarDetail['incoming'] = incomingDockets.map((docket) => {
        const own = incomingLines.filter((l) => l.docket_id === docket.id)
        const first = own[0]
        const extra = own.length > 1 ? ` +${own.length - 1} more` : ''
        return {
          docketNo: docket.docket_no,
          fromName: locationName(ref, docket.from_location_id),
          toName: locationName(ref, docket.to_location_id),
          summary: first
            ? `${first.issued_containers} × ${ref.skuById.get(first.sku_id)?.name ?? 'unknown SKU'}${extra}`
            : 'no lines',
          ageLabel: `${clock.minutesBetween(docket.issued_at, snap.now) ?? 0} MIN`,
        }
      })

      return {
        id: bar.id,
        name: bar.name.toUpperCase(),
        managerName: ref.people.get(manager?.user_id ?? '')?.short_name ?? 'Unassigned',
        asOf: { label: clock.time(snap.now.toISOString()), at: snap.now.toISOString() },
        categoryTotals,
        incoming: incomingSummary,
        inventory,
      }
    },

    async catalogue(): Promise<CatalogueGroup[]> {
      const [ref, snap] = await Promise.all([reference(), snapshot()])

      // The warehouse screen is the warehouse's own catalogue, so the figures are
      // the warehouse position — not the venue total, which would tell a
      // warehouse operator they have stock that is already out at a bar.
      const warehouseIds = new Set(ref.locations.filter((l) => l.kind === 'warehouse').map((l) => l.id))
      const containersBySku = new Map<string, number>()
      for (const row of snap.rows) {
        if (!warehouseIds.has(row.location_id)) continue
        containersBySku.set(row.sku_id, (containersBySku.get(row.sku_id) ?? 0) + Number(row.containers))
      }

      const lastMovement = await db
        .from('boa_bar_movement')
        .select('id, occurred_at')
        .eq('venue_id', venueId)
        .order('occurred_at', { ascending: false })
        .limit(400)
        .then((r) => unwrap<{ id: string; occurred_at: string }[]>('recent movements', r))
      const atById = new Map(lastMovement.map((m) => [m.id, m.occurred_at]))
      const recentLines = await movementLinesFor(lastMovement.map((m) => m.id))
      const lastBySku = new Map<string, string>()
      for (const line of recentLines) {
        const at = atById.get(line.movement_id)
        if (!at) continue
        const held = lastBySku.get(line.sku_id)
        if (!held || at > held) lastBySku.set(line.sku_id, at)
      }

      return GROUP_ORDER.map((group) => {
        const skus = ref.skus.filter((s) => groupKey(s.category_key) === group)
        const total = skus.reduce((sum, s) => sum + (containersBySku.get(s.id) ?? 0), 0)
        return {
          key: group,
          name: group,
          totalLabel: `${thousands(total)} CONTAINERS`,
          items: skus.map((sku) => {
            const shape = toSkuShape(sku)
            const containers = containersBySku.get(sku.id) ?? 0
            const pair = quantityPair(shape, containers)
            return {
              skuId: sku.id,
              name: sku.name,
              spec: specLabel(shape),
              primary: pair.primary,
              secondary: pair.secondary,
              lastMovement: `LAST MOVEMENT ${clock.ago(lastBySku.get(sku.id), snap.now)}`,
              // As with the bar lines: a tone here would be a par-level judgement.
              tone: 'muted' as Tone,
            }
          }),
        }
      }).filter((g) => g.items.length > 0)
    },

    async topUpRequests(): Promise<import('../repository').TopUpRequest[]> {
      const ref = await reference()
      const data = await rpc('boa_bar_list_top_up_requests', { p_venue_id: venueId }) as unknown as Array<Record<string, unknown>>
      return (data ?? []).map((row) => ({
        id: String(row.id),
        locationId: String(row.location_id),
        locationName: ref.locationById.get(String(row.location_id))?.name ?? String(row.location_id),
        skuId: String(row.sku_id),
        productName: ref.skuById.get(String(row.sku_id))?.name ?? String(row.sku_id),
        requestedContainers: Number(row.requested_containers),
        urgency: row.urgency as 'normal' | 'urgent', note: row.note as string | null,
        status: row.status as 'requested' | 'issued' | 'fulfilled' | 'cancelled',
        requestedBy: who(ref, String(row.requested_by)), requestedAt: String(row.requested_at),
      }))
    },

    /**
     * BAR-146. Everything in custody right now: the dockets awaiting acceptance,
     * and the containers sitting in `in_transit`.
     *
     * The in-transit figure is the point. `in_transit` is a real location holding
     * real stock, and no screen read it — so an unaccepted docket parked its whole
     * quantity somewhere invisible while the ledger said it existed.
     */
    async custodyOverview(): Promise<CustodyOverview> {
      const [ref, snap, awaiting] = await Promise.all([reference(), snapshot(), awaitingDockets()])

      const lines = awaiting.length
        ? await db
            .from('boa_bar_docket_line')
            .select(DOCKET_LINE_COLUMNS)
            .in('docket_id', awaiting.map((d) => d.id))
            .then((r) => unwrap<DocketLineRow[]>('awaiting docket lines', r))
        : []

      const transitIds = new Set(ref.locations.filter((l) => l.kind === 'in_transit').map((l) => l.id))
      const inTransitContainers = snap.rows
        .filter((row) => transitIds.has(row.location_id))
        .reduce((sum, row) => sum + Number(row.containers), 0)

      return {
        dockets: awaiting.map((docket) => {
          const own = lines.filter((l) => l.docket_id === docket.id)
          const first = own[0]
          const extra = own.length > 1 ? ` +${own.length - 1} more` : ''
          const age = clock.minutesBetween(docket.issued_at, snap.now) ?? 0
          return {
            docketNo: docket.docket_no,
            fromName: locationName(ref, docket.from_location_id).toUpperCase(),
            toName: locationName(ref, docket.to_location_id).toUpperCase(),
            summary: first
              ? `${first.issued_containers} × ${ref.skuById.get(first.sku_id)?.name ?? 'unknown SKU'}${extra}`
              : 'no lines',
            ageLabel: `${age} MIN`,
            overdue: age >= DOCKET_SLA_MINUTES,
          }
        }),
        inTransitContainers,
      }
    },

    /** BAR-144. Who has access, and what this caller may change. */
    async team(): Promise<Team> {
      const ref = await reference()
      const canManage = context.role === 'manager' || context.role === 'admin'
      const canGrantManagement = context.role === 'admin'
      const canInvite = Boolean(await rpc('boa_bar_can_invite', {}))

      const invites = canInvite
        ? await db
            .from('boa_bar_invite')
            .select('code, display_name, role, claimed_by, expires_at')
            .eq('venue_id', venueId)
            .order('created_at', { ascending: false })
            .limit(25)
            .then((r) =>
              unwrap<{ code: string; display_name: string; role: VenueRole; claimed_by: string | null; expires_at: string }[]>(
                'invites',
                r,
              ),
            )
        : []

      return {
        canManage,
        canInvite,
        canGrantManagement,
        locations: ref.locations
          .filter((l) => l.kind !== 'in_transit')
          .map((l) => ({ id: l.id, name: l.name.toUpperCase() })),
        members: ref.memberships.map((m) => ({
          userId: m.user_id,
          name: ref.people.get(m.user_id)?.display_name ?? 'UNNAMED',
          role: m.role,
          locationName: m.location_id ? (ref.locationById.get(m.location_id)?.name ?? null) : null,
          isSelf: m.user_id === context.userId,
        })),
        invites: invites.map((i) => ({
          code: i.code,
          name: i.display_name,
          role: i.role,
          claimed: i.claimed_by !== null,
          expiresLabel: clock.time(i.expires_at),
        })),
      }
    },

    async createInvite(command: CreateInviteCommand): Promise<{ code: string; name: string }> {
      const result = (await rpc('boa_bar_create_invite', {
        p_payload: {
          venue_id: venueId,
          role: command.role,
          location_id: command.locationId ?? null,
          display_name: command.displayName,
        },
      })) as { code?: string; display_name?: string } | null
      if (!result?.code) throw new Error('The invite could not be created')
      return { code: result.code, name: result.display_name ?? command.displayName }
    },

    async claimInvite(code: string): Promise<{ name: string; role: VenueRole }> {
      const result = (await rpc('boa_bar_claim_invite', { p_code: code })) as
        | { display_name?: string; role?: VenueRole }
        | null
      if (!result?.role) throw new Error('That code is not valid')
      return { name: result.display_name ?? '', role: result.role }
    },

    async setMembership(command: SetMembershipCommand): Promise<void> {
      await rpc('boa_bar_set_membership', {
        p_payload: {
          venue_id: venueId,
          user_id: command.userId,
          role: command.role ?? null,
          location_id: command.locationId ?? null,
          active: command.active,
        },
      })
    },

    /**
     * BAR-092. The paper fallback pack.
     *
     * Deliberately contains no quantities. It is produced from the SKU catalogue
     * and the location list only — the same read a count sheet on screen gets —
     * so printing it cannot leak a position the counter is not meant to see.
     */
    async printPack(): Promise<PrintPack> {
      const [ref, snap] = await Promise.all([reference(), snapshot()])
      const venue = await db
        .from('boa_bar_venue')
        .select('name, event_date')
        .eq('id', venueId)
        .limit(1)
        .then((r) => unwrap<{ name: string; event_date: string }[]>('venue', r))

      const countable = ref.locations.filter((l) => l.kind !== 'in_transit')

      return {
        venueName: venue[0]?.name ?? 'BOA 2026',
        eventDate: venue[0]?.event_date ?? '',
        preparedAt: clock.time(snap.now.toISOString()),
        sheets: countable.map((location) => ({
          locationId: location.id,
          locationName: location.name.toUpperCase(),
          lines: ref.skus.map((sku) => {
            const shape = toSkuShape(sku)
            const mode = partialModeFor(shape)
            return {
              skuId: sku.id,
              name: sku.name,
              spec: specLabel(shape),
              partialUnit: mode === 'ml' ? 'ml' : mode === 'litres' ? 'L' : '',
            }
          }),
        })),
      }
    },

    /** BAR-060. The warehouse and its catalogue; a delivery adds to it. */
    async receiptOptions(): Promise<ReceiptOptions> {
      const ref = await reference()
      const warehouse = ref.locations.find((l) => l.kind === 'warehouse')
      if (!warehouse) throw new Error('No active warehouse is configured for this venue')
      return {
        locationId: warehouse.id,
        locationName: warehouse.name.toUpperCase(),
        products: ref.skus.map((sku) => {
          const shape = toSkuShape(sku)
          return {
            skuId: sku.id,
            name: sku.name,
            spec: specLabel(shape),
            containerUnitPlural: unitWord(sku.container_type),
          }
        }),
        defaultProductId: ref.skus[0]?.id ?? '',
      }
    },

    /** design-script.jsx:308. Also enforced by boa_bar_record_waste. */
    async wasteOptions(locationId?: string): Promise<WasteOptions> {
      const ref = await reference()
      const target = locationId ?? context.locationId
      if (!target) throw new Error('Waste must be recorded against a location')
      const location = ref.locationById.get(target)
      if (!location) throw new Error('Unknown location')

      return {
        locationId: location.id,
        locationName: location.name.toUpperCase(),
        products: ref.skus.map((sku) => {
          const shape = toSkuShape(sku)
          return {
            skuId: sku.id,
            name: sku.name,
            spec: specLabel(shape),
            containerUnitPlural: unitWord(sku.container_type),
          }
        }),
        defaultProductId: ref.skus[0]?.id ?? '',
        reasons: WASTE_REASONS,
      }
    },

    async issueOptions(): Promise<IssueOptions> {
      const [ref, snap] = await Promise.all([reference(), snapshot()])
      const assigned = context.locationId ? ref.locationById.get(context.locationId) : undefined
      const source = assigned?.kind === 'warehouse'
        ? assigned
        : ref.locations.find((location) => location.kind === 'warehouse')
      if (!source) throw new Error('No active warehouse is configured for this venue')

      const destinations = ref.locations
        .filter((location) => location.kind === 'bar' || location.kind === 'hospitality')
        .map((location) => ({ id: location.id, name: location.name.toUpperCase() }))
      if (destinations.length === 0) throw new Error('No issue destination is configured for this venue')

      const containersBySku = new Map<string, number>()
      for (const row of snap.rows) {
        if (row.location_id !== source.id) continue
        containersBySku.set(row.sku_id, (containersBySku.get(row.sku_id) ?? 0) + Number(row.containers))
      }

      const products = ref.skus.map((sku) => {
        const shape = toSkuShape(sku)
        return {
          skuId: sku.id,
          name: sku.name,
          reviewName: sku.name,
          issueSpec: issueSpecLabel(shape),
          unitsPerCase: sku.units_per_case,
          mlPerContainer: sku.ml_per_container,
          warehouseContainers: containersBySku.get(sku.id) ?? 0,
          containerUnitSingular: unitWord(sku.container_type, false),
          containerUnitPlural: unitWord(sku.container_type),
        }
      })
      if (products.length === 0) throw new Error('No active SKU is configured for this venue')

      const assignedDestination = assigned && destinations.some((destination) => destination.id === assigned.id)
        ? assigned.id
        : destinations[0]?.id
      const firstStocked = products.find((product) => product.warehouseContainers > 0)

      return {
        fromLocationId: source.id,
        fromName: source.name.toUpperCase(),
        destinations,
        defaultDestinationId: assignedDestination ?? destinations[0]!.id,
        products,
        defaultProductId: firstStocked?.skuId ?? products[0]!.skuId,
        issuedBy: who(ref, context.userId),
        issuedAt: clock.time(snap.now.toISOString()),
      }
    },

    async ledger(group: ActivityGroup = 'All'): Promise<LedgerEntry[]> {
      const ref = await reference()

      const movements = await db
        .from('boa_bar_movement')
        .select(MOVEMENT_COLUMNS)
        .eq('venue_id', venueId)
        .in('kind', LEDGER_KINDS)
        .order('occurred_at', { ascending: false })
        .limit(60)
        .then((r) => unwrap<MovementRow[]>('ledger movements', r))

      const [lines, dockets, counts] = await Promise.all([
        movementLinesFor(movements.map((m) => m.id)),
        docketsById(movements.map((m) => m.docket_id).filter((id): id is string => Boolean(id))),
        latestCountSessions(),
      ])

      const linesByMovement = new Map<string, MovementLineRow[]>()
      for (const line of lines) {
        const held = linesByMovement.get(line.movement_id) ?? []
        held.push(line)
        linesByMovement.set(line.movement_id, held)
      }

      const entries: (LedgerEntry & { sortAt: string })[] = []

      for (const movement of movements) {
        const own = linesByMovement.get(movement.id) ?? []
        const first = own[0]
        const sku = first ? ref.skuById.get(first.sku_id) : undefined
        const skuName = sku?.name ?? 'unknown SKU'
        const docket = movement.docket_id ? dockets.get(movement.docket_id) : undefined
        const leg = typeof movement.metadata?.leg === 'string' ? movement.metadata.leg : null
        // The design shows the docket's own from -> to, not the in_transit legs
        // the ledger actually records. Both are true; the docket's is what the
        // reader means by "where did it go".
        const route = docket
          ? `${locationName(ref, docket.from_location_id)} → ${locationName(ref, docket.to_location_id)}`
          : locationName(ref, first?.location_id)
        const containers = own
          .filter((l) => Number(l.container_delta) > 0)
          .reduce((sum, l) => sum + Number(l.container_delta), 0)
        const extra = new Set(own.map((l) => l.sku_id)).size > 1
          ? ` +${new Set(own.map((l) => l.sku_id)).size - 1} more`
          : ''

        let title: string
        let detail: string
        let tone: Tone = 'muted'
        let entryGroup: Exclude<ActivityGroup, 'All'> = 'Transfers'
        let flagged = false
        let actor = who(ref, movement.actor_id)

        switch (movement.kind) {
          case 'receipt':
            title = 'Stock received'
            detail = `${route} · ${containers} ${skuName}${extra}`
            break
          case 'issue':
            if (leg === 'receipt' && docket) {
              const short = docket.status === 'accepted_short'
              title = `Docket ${docket.docket_no} accepted${short ? ' short' : ''}`
              detail = `${route} · ${containers} ${skuName}${extra}${short && docket.difference_reason ? ` · ${docket.difference_reason}` : ''}`
              tone = short ? 'gold' : 'green'
              // Both named parties, which is the whole point of a custody record.
              actor = `${who(ref, docket.issued_by)} → ${who(ref, docket.accepted_by)}`
            } else {
              title = 'Stock issued'
              detail = `${route} · ${containers} ${skuName}${extra}`
            }
            break
          case 'transfer':
            title = 'Stock transferred'
            detail = `${route} · ${containers} ${skuName}${extra}`
            break
          case 'return':
            title = 'Stock returned'
            detail = `${route} · ${containers} ${skuName}${extra}`
            break
          case 'waste': {
            const wasted = own.reduce((sum, l) => sum + Math.abs(Number(l.container_delta)), 0)
            title = 'Waste recorded'
            detail = `${route} · ${wasted} ${skuName}${extra}${movement.reason ? ` · ${movement.reason}` : ''}`
            tone = 'red'
            entryGroup = 'Waste'
            break
          }
          case 'adjustment': {
            const delta = own.reduce((sum, l) => sum + Number(l.container_delta), 0)
            title = 'Adjustment'
            detail = `${route} · ${signed(delta)} ${skuName}${extra}${movement.reason ? ` · reason: ${movement.reason}` : ''}`
            tone = 'red'
            entryGroup = 'Adjustments'
            // Every adjustment carries the audit badge. An adjustment is somebody
            // changing stock without a physical event, which is exactly what the
            // next morning's review exists to look at.
            flagged = true
            break
          }
          default:
            continue
        }

        entries.push({
          id: movement.id,
          group: entryGroup,
          at: clock.time(movement.occurred_at),
          title,
          detail,
          who: actor,
          tone,
          flagged,
          sortAt: movement.occurred_at,
        })
      }

      // Counts are not movements — a count observes stock, it does not change it —
      // so they are unioned in from their own table rather than being derived
      // from the ledger.
      for (const count of counts.slice(0, 20)) {
        const kindLabel = countKindLabel(count.count_kind)
        const submitted = count.status !== 'draft' && count.submitted_at
        entries.push({
          id: `count:${count.id}`,
          group: 'Counts',
          at: clock.time(submitted ? count.submitted_at : count.created_at),
          title: submitted ? `${kindLabel} submitted` : `${kindLabel} started`,
          detail: `${locationName(ref, count.location_id)} · blind`,
          who: who(ref, count.assigned_to),
          tone: 'muted',
          flagged: false,
          sortAt: (submitted ? count.submitted_at : count.created_at) ?? count.created_at,
        })
      }

      entries.sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0))
      const visible: LedgerEntry[] = entries.map((entry) => ({
        id: entry.id,
        group: entry.group,
        at: entry.at,
        title: entry.title,
        detail: entry.detail,
        who: entry.who,
        tone: entry.tone,
        flagged: entry.flagged,
      }))
      return group === 'All' ? visible : visible.filter((e) => e.group === group)
    },

    async movementDetail(id: string): Promise<MovementDetail | null> {
      const ref = await reference()

      const movements = await db
        .from('boa_bar_movement')
        .select(MOVEMENT_COLUMNS)
        .eq('venue_id', venueId)
        .eq('id', id)
        .limit(1)
        .then((r) => unwrap<MovementRow[]>('movement', r))
      const movement = movements[0]
      if (!movement) return null

      const lines = await movementLinesFor([movement.id])
      const docket = movement.docket_id ? (await docketsById([movement.docket_id])).get(movement.docket_id) : undefined
      const first = lines[0]
      const sku = first ? ref.skuById.get(first.sku_id) : undefined
      const containers = lines
        .filter((l) => Number(l.container_delta) > 0)
        .reduce((sum, l) => sum + Number(l.container_delta), 0)
      const ml = lines.filter((l) => Number(l.ml_delta) > 0).reduce((sum, l) => sum + Number(l.ml_delta), 0)
      const adjustmentDelta = lines.reduce((sum, l) => sum + Number(l.container_delta), 0)
      const isAdjustment = movement.kind === 'adjustment'

      const rows: MovementDetail['rows'] = [{ label: 'Movement ID', value: movement.id.slice(0, 8).toUpperCase() }]

      if (isAdjustment) {
        rows.push({ label: 'Signed delta', value: `${signed(adjustmentDelta)} ${sku ? unitWord(sku.container_type) : 'CONTAINERS'}`, tone: 'red' })
        rows.push({ label: 'Reason', value: (movement.reason ?? 'NO REASON RECORDED').toUpperCase() })
        rows.push({ label: 'Entered by', value: `${who(ref, movement.actor_id)} · ${clock.time(movement.occurred_at)}` })
        if (movement.reverses_movement_id) {
          rows.push({ label: 'Reverses', value: movement.reverses_movement_id.slice(0, 8).toUpperCase() })
        }
        rows.push({ label: 'Audit flag', value: 'REVIEW NEXT MORNING', tone: 'red' })
      } else {
        rows.push({ label: 'Type', value: movement.kind.toUpperCase(), tone: 'green' })
        rows.push({ label: 'Containers', value: `${thousands(containers)} ${sku ? unitWord(sku.container_type) : 'CONTAINERS'}` })
        rows.push({ label: 'Volume', value: `${thousands(ml)} ML` })
        if (docket) {
          rows.push({ label: 'Issued by', value: `${who(ref, docket.issued_by)} · ${clock.time(docket.issued_at)}` })
          if (docket.accepted_by) {
            rows.push({ label: 'Accepted by', value: `${who(ref, docket.accepted_by)} · ${clock.time(docket.accepted_at)}` })
          }
        } else {
          rows.push({ label: 'Recorded by', value: `${who(ref, movement.actor_id)} · ${clock.time(movement.occurred_at)}` })
        }
        rows.push({ label: 'Source', value: movement.source.toUpperCase() })
      }

      const route = docket
        ? `${locationName(ref, docket.from_location_id)} → ${locationName(ref, docket.to_location_id)}`
        : locationName(ref, first?.location_id)

      return {
        id: movement.id,
        kindLabel: isAdjustment
          ? 'ADJUSTMENT · AUDIT'
          : `${movement.kind.toUpperCase()}${docket ? ` · ${docket.status.replace('_', ' ').toUpperCase()}` : ''}`,
        tone: isAdjustment ? 'red' : docket?.status === 'accepted' ? 'green' : 'muted',
        title: isAdjustment
          ? `ADJUSTMENT ${signed(adjustmentDelta)} ${(sku?.name ?? '').toUpperCase()}`.trim()
          : docket
            ? `DOCKET ${docket.docket_no} ${docket.status.replace('_', ' ').toUpperCase()}`
            : `${movement.kind.toUpperCase()} ${thousands(containers)}`,
        detail: `${route}${sku ? ` · ${containers} ${sku.name}` : ''}`,
        rows,
      }
    },

    async custody(docketNo?: string): Promise<Custody> {
      const [ref, snap] = await Promise.all([reference(), snapshot()])

      let query = db.from('boa_bar_docket').select(DOCKET_COLUMNS).eq('venue_id', venueId)
      if (docketNo) {
        query = query.eq('docket_no', docketNo)
      } else if (context.locationId) {
        // With no docket named, the one that matters to this device is the one
        // coming to this location.
        query = query.eq('to_location_id', context.locationId).eq('status', 'awaiting')
      } else {
        query = query.eq('status', 'awaiting')
      }
      const dockets = await query
        .order('issued_at', { ascending: false })
        .limit(1)
        .then((r) => unwrap<DocketRow[]>('custody docket', r))

      const docket = dockets[0]
      if (!docket) {
        throw new Error(docketNo ? `Docket ${docketNo} was not found` : 'No docket is awaiting acceptance')
      }

      const lines = await db
        .from('boa_bar_docket_line')
        .select(DOCKET_LINE_COLUMNS)
        .eq('docket_id', docket.id)
        .then((r) => unwrap<DocketLineRow[]>('custody docket lines', r))

      const first = lines[0]
      if (!first) throw new Error(`Docket ${docket.docket_no} has no lines`)
      const sku = ref.skuById.get(first.sku_id)
      if (!sku) throw new Error(`Docket ${docket.docket_no} references an unknown SKU`)
      const shape = toSkuShape(sku)

      /**
       * NOTE — the design's custody screens show ONE product per docket, so this
       * read model carries one. `boa_bar_docket_line` is correctly many-to-one,
       * and a multi-line docket created outside this app would display only its
       * first line here. Multi-line custody screens are not in the design and are
       * recorded as an open question rather than invented.
       */

      // Warehouse position before the issue. The dispatch leg has already been
      // posted, so the position now is the position before, less what went out.
      const sourceNow = snap.rows
        .filter((r) => r.location_id === docket.from_location_id && r.sku_id === first.sku_id)
        .reduce((sum, r) => sum + Number(r.containers), 0)

      const statusLabel =
        docket.status === 'awaiting'
          ? 'AWAITING ACCEPTANCE'
          : docket.status === 'accepted'
            ? 'ACCEPTED'
            : docket.status === 'accepted_short'
              ? 'ACCEPTED SHORT'
              : 'CANCELLED'

      return {
        docketId: docket.id,
        docketNo: docket.docket_no,
        skuId: first.sku_id,
        fromLocationId: docket.from_location_id,
        toLocationId: docket.to_location_id,
        statusLabel,
        fromName: locationName(ref, docket.from_location_id).toUpperCase(),
        toName: locationName(ref, docket.to_location_id).toUpperCase(),
        issuedBy: who(ref, docket.issued_by),
        issuedAt: clock.time(docket.issued_at),
        productName: sku.name,
        productSpec: specLabel(shape),
        unitsPerCase: sku.units_per_case,
        mlPerContainer: sku.ml_per_container,
        expectedContainers: first.issued_containers,
        warehouseBefore: sourceNow + first.issued_containers,
        /**
         * The four reasons in design-script.jsx `diffReasons`. Held here rather
         * than in the screen because the accept RPC validates against the same
         * vocabulary — a reason the database rejects must not be offerable.
         */
        differenceReasons: ['Short on pallet', 'Breakage in transit', 'Miscount at issue', 'Other'],
        acceptedBy: docket.accepted_by ? who(ref, docket.accepted_by) : '',
        acceptedAt: docket.accepted_at ? clock.time(docket.accepted_at) : '',
      }
    },

    /**
     * BAR-082. The count sheet for a location.
     *
     * There is no longer a draft-session prerequisite: `boa_bar_submit_count`
     * creates the session at submit time, so a counter can start counting without
     * anybody having provisioned a session first. That matters operationally —
     * the previous version returned an empty sheet with "NO COUNT SESSION OPEN"
     * and no way to open one, so a bar lead could not count at all.
     *
     * BLIND, enforced by omission. Nothing on this read model carries an expected
     * quantity, and the SKU list is the venue's full active catalogue rather than
     * "the SKUs with stock here" — the presence or absence of a line is itself a
     * disclosure of the expected position for the location being counted
     * (non-negotiable 3).
     */
    async countSession(locationId?: string): Promise<CountSession> {
      const ref = await reference()
      const target = locationId ?? context.locationId
      const locationLabel = (target ? locationName(ref, target) : 'NO LOCATION').toUpperCase()

      // BAR-145. The live submitted count for this location, if any — what a new
      // count would replace. Only the id is read; no figure crosses this boundary.
      let supersedesSessionId: string | null = null
      if (target) {
        const live = await db
          .from('boa_bar_count_session')
          .select('id')
          .eq('venue_id', venueId)
          .eq('location_id', target)
          .not('submitted_at', 'is', null)
          .is('superseded_by_session_id', null)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .then((r) => unwrap<{ id: string }[]>('live count session', r))
        supersedesSessionId = live[0]?.id ?? null
      }

      const lines = ref.skus.map((sku) => {
        const shape = toSkuShape(sku)
        const mode = partialModeFor(shape)
        return {
          skuId: sku.id,
          name: sku.name,
          spec: specLabel(shape),
          partial: mode,
          tareWeightG: shape.tareWeightG,
          partialStep: partialStepFor(mode),
          partialUnit: partialUnitFor(mode),
          partialHint: partialHintFor(shape, mode),
        }
      })

      // Which count this is remains an open operating question: the schema
      // distinguishes opening, mid-event and close-out, but nothing in the app
      // tells the counter which one they are doing. `mid_event` is the one taken
      // repeatedly during the night and so the safe default; scheduling the others
      // is BAR-150.
      const countKind: CountKind = 'mid_event'

      return {
        locationId: target ?? '',
        countKind,
        supersedesSessionId,
        locationName: locationLabel,
        kindLabel: countKindLabel(countKind).toUpperCase(),
        scopeLabel: `${locationLabel} · BLIND`,
        totalLines: lines.length,
        presets: COUNT_PRESETS,
        lines,
        countedBy: who(ref, context.userId),
        /**
         * The design shows a witness beside the counter. There is no witness
         * column on boa_bar_count_session — `reviewed_by` is the manager's later
         * review, a different person doing a different thing — so this is left
         * empty rather than filled with the reviewer. The two-person seal is a
         * specification requirement and the missing column is BAR-163.
         */
        witnessedBy: '',
        sealedAt: '',
      }
    },

    async variance(locationId?: string): Promise<VarianceReport> {
      const [ref, bands] = await Promise.all([reference(), toleranceBands()])
      const target = locationId ?? context.locationId
      if (!target) throw new Error('Variance needs a location')

      // BAR-145. The LIVE count, not merely the latest: a superseded count is
      // still submitted and still has a seal, and reporting variance against a
      // count somebody has already corrected is worse than reporting none.
      const sessions = await db
        .from('boa_bar_count_session')
        .select(COUNT_SESSION_COLUMNS)
        .eq('venue_id', venueId)
        .eq('location_id', target)
        .not('submitted_at', 'is', null)
        .is('superseded_by_session_id', null)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .then((r) => unwrap<CountSessionRow[]>('variance session', r))

      const session = sessions[0]
      const locationLabel = locationName(ref, target).toUpperCase()
      if (!session || !session.submitted_at) {
        return {
          locationName: locationLabel,
          bandLabel: 'NO COUNT',
          bandTone: 'muted',
          throughputLabel: '—',
          varianceLabel: '—',
          basisLabel: 'NO SUBMITTED COUNT FOR THIS LOCATION',
          lines: [],
        }
      }

      const [countLines, ledger] = await Promise.all([
        db
          .from('boa_bar_count_line')
          .select(COUNT_LINE_COLUMNS)
          .eq('count_session_id', session.id)
          .then((r) => unwrap<CountLineRow[]>('count lines', r)),
        positionAt(target, session.submitted_at),
      ])

      let worst: 'green' | 'amber' | 'red' = 'green'
      let totalVarianceMl = 0
      let totalReceiptsMl = 0

      const lines = countLines
        .map((line) => {
          const sku = ref.skuById.get(line.sku_id)
          if (!sku) return null
          const shape = toSkuShape(sku)

          const expected = ledger.position.get(line.sku_id) ?? { containers: 0, ml: 0 }
          const countedMl = line.full_containers * sku.ml_per_container + Number(line.partial_ml)
          const deltaMl = countedMl - expected.ml
          const receiptsMl = ledger.receivedMl.get(line.sku_id) ?? 0
          const pct = receiptsMl > 0 ? (deltaMl / receiptsMl) * 100 : null

          totalVarianceMl += deltaMl
          totalReceiptsMl += receiptsMl

          const band = bandFor(sku.category_key, pct, bands)
          if (band === 'red' || (band === 'amber' && worst === 'green')) worst = band
          const [greenMax, amberMax] = bands.get(sku.category_key) ?? [2, 5]

          const note =
            deltaMl > 0
              ? 'Positive — check for a missed receipt or a wrong-SKU ring-up'
              : pct === null
                ? 'No receipts in the window — a percentage cannot be computed'
                : band === 'green'
                  ? 'Within tolerance'
                  : `Band ${greenMax}–${amberMax}% · above tolerance, investigate`

          return {
            skuId: line.sku_id,
            name: sku.name,
            expected: volumeLabel(shape, expected.ml),
            counted: volumeLabel(shape, countedMl),
            delta: signed(isKeg(shape) ? Math.round(deltaMl / 1000) : deltaMl, isKeg(shape) ? ' L' : ' ml'),
            pct: signedPct(pct),
            tone: (band === 'green' ? 'green' : band === 'amber' ? 'gold' : 'red') as Tone,
            note,
            noteTone: (deltaMl > 0 ? 'gold' : undefined) as Tone | undefined,
          }
        })
        .filter((line): line is NonNullable<typeof line> => line !== null)

      const overallPct = totalReceiptsMl > 0 ? (totalVarianceMl / totalReceiptsMl) * 100 : null

      return {
        locationName: locationName(ref, session.location_id).toUpperCase(),
        bandLabel: worst === 'green' ? 'GREEN' : worst === 'amber' ? 'AMBER' : 'RED',
        bandTone: worst === 'green' ? 'green' : worst === 'amber' ? 'gold' : 'red',
        throughputLabel: `${thousands(totalReceiptsMl / 1000)} L`,
        varianceLabel: signedPct(overallPct),
        /**
         * The denominator is stated, not assumed. The specification defines
         * variance as a percentage of *throughput*, which means volume dispensed —
         * and that is unknowable until POS import lands (M5), because sales are
         * the only movements that record dispensing. Until then the honest
         * denominator is volume received into the location over the window, and
         * this label says exactly that so nobody reads it as a sales figure.
         */
        basisLabel: `${countKindLabel(session.count_kind).toUpperCase()} ${clock.time(session.submitted_at)} · COUNTED BY ${who(ref, session.assigned_to)} · % OF RECEIPTS (NO POS DATA)`,
        lines,
      }
    },

    // -----------------------------------------------------------------------
    // commands
    // -----------------------------------------------------------------------

    /**
     * BAR-044. Appends to the outbox, then waits briefly for the drain.
     *
     * It does not call the RPC directly. `docs/OFFLINE-SYNC.md` rule 5: every
     * write goes to the outbox, online or offline, with no fast path that skips
     * it — that is what makes losing signal ordinary rather than exceptional. The
     * short wait is how an online action still gets a real docket number while
     * obeying that rule: the number is minted server-side under an advisory lock,
     * so it exists nowhere else and cannot be predicted here.
     *
     * If the wait elapses the write is still durable and still going to post; the
     * outcome says `queued` and the caller must not report it as either success or
     * loss.
     */
    async createDocket(command: CreateDocketCommand): Promise<WriteOutcome> {
      const ref = await reference()
      const outboxId = await enqueueCommand({
        kind: 'create_docket',
        idempotencyKey: command.idempotencyKey,
        payload: {
          venue_id: venueId,
          actor_id: context.userId,
          from_location_id: command.fromLocationId,
          to_location_id: command.toLocationId,
          top_up_request_id: command.topUpRequestId,
          idempotency_key: command.idempotencyKey,
          source: 'pwa',
          lines: command.lines.map((line) => {
            const sku = ref.skuById.get(line.skuId)
            if (!sku) throw new Error(`Unknown SKU ${line.skuId}`)
            return {
              sku_id: line.skuId,
              containers: line.containers,
              // Derived here, from the SKU, rather than accepted from the UI: a
              // container count and a volume that disagree is a corrupt docket.
              ml: mlForContainers(line.containers, sku.ml_per_container),
            }
          }),
        },
      })
      return settle(outboxId)
    },

    async acceptDocket(command: AcceptDocketCommand): Promise<WriteOutcome> {
      const ref = await reference()
      const outboxId = await enqueueCommand({
        kind: 'accept_docket',
        idempotencyKey: command.idempotencyKey,
        payload: {
          actor_id: context.userId,
          idempotency_key: command.idempotencyKey,
          docket_id: command.docketId,
          difference_reason: command.differenceReason ?? null,
          source: 'pwa',
          lines: command.lines.map((line) => {
            const sku = ref.skuById.get(line.skuId)
            if (!sku) throw new Error(`Unknown SKU ${line.skuId}`)
            return {
              sku_id: line.skuId,
              containers: line.containers,
              ml: mlForContainers(line.containers, sku.ml_per_container),
            }
          }),
        },
      })
      return settle(outboxId)
    },

    /** BAR-060. A delivery, against its delivery note. */
    async recordReceipt(command: RecordReceiptCommand): Promise<CountWriteOutcome> {
      const outboxId = await enqueueCommand({
        kind: 'record_receipt',
        idempotencyKey: command.idempotencyKey,
        payload: {
          venue_id: venueId,
          actor_id: context.userId,
          location_id: command.locationId,
          supplier: command.supplier,
          delivery_note: command.deliveryNote,
          idempotency_key: command.idempotencyKey,
          source: 'pwa',
          lines: command.lines.map((line) => ({ sku_id: line.skuId, containers: line.containers })),
        },
      })
      try {
        const result = (await waitForCommand(outboxId)) as { movement_id?: string; lines?: number } | null
        if (result?.movement_id) {
          return { status: 'posted', countSessionId: result.movement_id, lines: Number(result.lines ?? command.lines.length) }
        }
        return { status: 'queued', outboxId }
      } catch (error) {
        if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
        throw error
      }
    },

    /**
     * BAR-063 / BAR-133. Waste, against the location passed in — never a default.
     */
    async recordWaste(command: RecordWasteCommand): Promise<CountWriteOutcome> {
      if (!command.locationId) throw new Error('Waste needs a location')
      const outboxId = await enqueueCommand({
        kind: 'record_waste',
        idempotencyKey: command.idempotencyKey,
        payload: {
          venue_id: venueId,
          actor_id: context.userId,
          location_id: command.locationId,
          sku_id: command.skuId,
          containers: command.containers,
          reason: command.reason,
          idempotency_key: command.idempotencyKey,
          source: 'pwa',
        },
      })
      try {
        const result = (await waitForCommand(outboxId)) as { movement_id?: string } | null
        if (result?.movement_id) {
          return { status: 'posted', countSessionId: result.movement_id, lines: 1 }
        }
        return { status: 'queued', outboxId }
      } catch (error) {
        if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
        throw error
      }
    },

    async requestTopUp(command: RequestTopUpCommand): Promise<TopUpWriteOutcome> {
      const outboxId = await enqueueCommand({
        kind: 'request_top_up',
        idempotencyKey: command.idempotencyKey,
        payload: {
          venue_id: venueId,
          location_id: command.locationId,
          sku_id: command.skuId,
          requested_containers: command.requestedContainers,
          urgency: command.urgency,
          note: command.note,
          idempotency_key: command.idempotencyKey,
        },
      })
      try {
        const result = (await waitForCommand(outboxId)) as { request_id?: string } | null
        if (result?.request_id) return { status: 'posted', requestId: result.request_id }
        return { status: 'queued', outboxId }
      } catch (error) {
        if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
        throw error
      }
    },

    async updateTopUp(command: UpdateTopUpCommand): Promise<TopUpWriteOutcome> {
      const outboxId = await enqueueCommand({
        kind: 'update_top_up', idempotencyKey: command.idempotencyKey,
        payload: { request_id: command.requestId, status: command.status },
      })
      try {
        const result = await waitForCommand(outboxId) as { request_id?: string } | null
        return result?.request_id ? { status: 'posted', requestId: result.request_id } : { status: 'queued', outboxId }
      } catch (error) {
        if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
        throw error
      }
    },

    /**
     * BAR-161. Opening a count blinds this device to the location's position.
     * Direct, not queued — see `openCountRpc`.
     */
    async openCount(locationId: string, countKind: CountKind): Promise<{ countSessionId: string }> {
      if (!locationId) throw new Error('A count needs a location')
      const result = (await openCountRpc({
        venue_id: venueId,
        location_id: locationId,
        count_kind: countKind,
      })) as { count_session_id?: string } | null
      if (!result?.count_session_id) throw new Error('The count could not be opened')
      return { countSessionId: result.count_session_id }
    },

    /**
     * BAR-082. One command for the whole count: the RPC creates the session,
     * writes the observed lines and seals the expected position.
     *
     * Through the outbox like every other write, so a count taken in a dead spot
     * is durable on the device and posts when signal returns — which is the
     * ordinary case at a festival bar, not an edge case.
     */
    async submitCount(command: SubmitCountCommand): Promise<CountWriteOutcome> {
      if (!command.locationId) throw new Error('A count needs a location')
      const outboxId = await enqueueCommand({
        kind: 'submit_count',
        idempotencyKey: command.idempotencyKey,
        payload: {
          venue_id: venueId,
          actor_id: context.userId,
          location_id: command.locationId,
          count_kind: command.countKind,
          idempotency_key: command.idempotencyKey,
          supersedes_session_id: command.supersedesSessionId ?? null,
          supersede_reason: command.supersedeReason ?? null,
          lines: command.lines.map((line) => ({
            sku_id: line.skuId,
            full_containers: line.fullContainers,
            partial_ml: line.partialMl,
            gross_weight_g: line.grossWeightG ?? null,
          })),
        },
      })

      try {
        const result = (await waitForCommand(outboxId)) as
          | { count_session_id?: string; lines?: number }
          | null
        if (result?.count_session_id) {
          return {
            status: 'posted',
            countSessionId: result.count_session_id,
            lines: Number(result.lines ?? command.lines.length),
          }
        }
        return { status: 'queued', outboxId }
      } catch (error) {
        if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
        throw error
      }
    },
  }
}

/**
 * Turn a queued outbox entry into an outcome.
 *
 * A rejection propagates: a write the server refused must reach the user, never a
 * toast claiming success (`docs/OFFLINE-SYNC.md` rule 3).
 */
async function settle(outboxId: string): Promise<WriteOutcome> {
  try {
    const result = (await waitForCommand(outboxId)) as
      | { docket_id?: string; docket_no?: string; token?: string }
      | null
    if (result?.docket_id && result?.docket_no) {
      return {
        status: 'posted',
        docketId: result.docket_id,
        docketNo: result.docket_no,
        token: result.token,
      }
    }
    // Posted, but the reply did not carry a docket. Reporting a number we do not
    // have would be worse than reporting it as queued.
    return { status: 'queued', outboxId }
  } catch (error) {
    if (error instanceof OutboxPendingError) return { status: 'queued', outboxId }
    throw error
  }
}

function countKindLabel(kind: CountSessionRow['count_kind']): string {
  switch (kind) {
    case 'opening_warehouse':
      return 'Opening warehouse count'
    case 'opening_bar':
      return 'Opening bar count'
    case 'mid_event':
      return 'Mid-event count'
    case 'close_out':
      return 'Close-out count'
  }
}

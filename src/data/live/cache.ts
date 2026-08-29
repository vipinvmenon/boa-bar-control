/**
 * BAR-066 / BAR-067 — the reference cache.
 *
 * `referenceCache` was declared in Dexie on day one and never written to, so a
 * failed live load had nothing to fall back on. This writes it on every successful
 * load and reads it when the network fails.
 *
 * **It never falls back to fixtures.** That path is what rendered the design's
 * sample stock as live festival inventory, and there is no code here that can
 * produce it: if the cache is empty the read throws, and the screen shows an error
 * (BAR-047) rather than a plausible number.
 *
 * ### Why caching the position is safe, and where it is not
 *
 * A cached position is a *stale* position, and showing one as current is the
 * defect this project exists to prevent. It is safe here for one specific reason:
 * every screen in the design carries an `AS OF hh:mm` stamp, and the cached
 * snapshot carries the server time it was taken at. A screen served from cache
 * therefore says "AS OF 19:43" while the clock reads 21:00 — which is what an
 * as-of stamp is for. Remove that stamp from a screen and this stops being safe.
 *
 * Where it is NOT safe is blind counting. A snapshot cached before a count was
 * opened still contains the position of the location now being counted, so
 * serving it back would defeat the enforcement added in BAR-161 — the database
 * withholds it, and then the device hands it over from its own pocket. Hence
 * `blindedLocationIds` below: cached rows for any location this device has an open
 * count on are dropped on read.
 */
import { offlineDb, readDraft } from '../../lib/offline-db'
import type { LocationRow, MembershipRow, PersonRow, SkuRow, SnapshotRow } from './rows'

type CachedReferencePayload = {
  locations: LocationRow[]
  skus: SkuRow[]
  people: PersonRow[]
  memberships: MembershipRow[]
}

type CachedSnapshotPayload = {
  rows: SnapshotRow[]
  /** The server time the snapshot was taken at, so staleness stays visible. */
  at: string
}

const referenceKey = (venueId: string) => `ref:${venueId}`
const snapshotKey = (venueId: string) => `snap:${venueId}`

async function write(key: string, value: unknown): Promise<void> {
  try {
    await offlineDb.referenceCache.put({ key, value, refreshedAt: Date.now() })
  } catch (error) {
    // A cache write failing is not a reason to fail the read that succeeded. It is
    // a reason to say so, because the next offline load will be worse for it.
    console.warn('[boa] could not write the reference cache', error)
  }
}

async function read(key: string): Promise<unknown> {
  const row = await offlineDb.referenceCache.get(key)
  return row?.value
}

export async function cacheReference(venueId: string, payload: CachedReferencePayload): Promise<void> {
  await write(referenceKey(venueId), payload)
}

/**
 * Shape-checked rather than cast. A cache written by an older build has different
 * columns, and serving that as live reference data would produce wrong names on a
 * custody record.
 */
export function isReferencePayload(raw: unknown): raw is CachedReferencePayload {
  if (!raw || typeof raw !== 'object') return false
  const p = raw as Partial<CachedReferencePayload>
  return (
    Array.isArray(p.locations) && Array.isArray(p.skus) &&
    Array.isArray(p.people) && Array.isArray(p.memberships)
  )
}

export async function readCachedReference(venueId: string): Promise<CachedReferencePayload | null> {
  const raw = await read(referenceKey(venueId))
  return isReferencePayload(raw) ? raw : null
}

export async function cacheSnapshot(venueId: string, rows: SnapshotRow[], at: string): Promise<void> {
  await write(snapshotKey(venueId), { rows, at } satisfies CachedSnapshotPayload)
}

export function isSnapshotPayload(raw: unknown): raw is CachedSnapshotPayload {
  if (!raw || typeof raw !== 'object') return false
  const p = raw as Partial<CachedSnapshotPayload>
  return Array.isArray(p.rows) && typeof p.at === 'string'
}

/**
 * The locations this device is blinded on, from the local count drafts.
 *
 * The database already withholds these (BAR-161). This stops the cache handing
 * back what the database refused — the position of a bar somebody on this device
 * is part-way through counting.
 */
async function blindedLocationIds(rows: SnapshotRow[]): Promise<Set<string>> {
  const blinded = new Set<string>()
  const locationIds = new Set(rows.map((row) => row.location_id))
  await Promise.all(
    [...locationIds].map(async (id) => {
      const draft = await readDraft(`count:${id}`)
      if (draft) blinded.add(id)
    }),
  )
  return blinded
}

export async function readCachedSnapshot(
  venueId: string,
): Promise<{ rows: SnapshotRow[]; now: Date } | null> {
  const raw = await read(snapshotKey(venueId))
  if (!isSnapshotPayload(raw)) return null

  const at = new Date(raw.at)
  if (Number.isNaN(at.getTime())) return null

  const blinded = await blindedLocationIds(raw.rows)
  return { rows: withoutBlindedLocations(raw.rows, blinded), now: at }
}

/**
 * Drop cached rows for a location this device is counting.
 *
 * Dropped entirely, not zeroed — the same reasoning as the snapshot RPC. A zero
 * row is itself a claim about the position, and a counter shown zeroes would
 * reasonably enter zeroes.
 */
export function withoutBlindedLocations(rows: SnapshotRow[], blinded: Set<string>): SnapshotRow[] {
  if (blinded.size === 0) return rows
  return rows.filter((row) => !blinded.has(row.location_id))
}

/** Thrown when the network failed and there is nothing cached to fall back on. */
export class NoCachedDataError extends Error {
  constructor(what: string) {
    super(
      `${what} could not be loaded and this device has no cached copy. Connect once to load it — nothing is shown rather than a figure that might be wrong.`,
    )
    this.name = 'NoCachedDataError'
  }
}

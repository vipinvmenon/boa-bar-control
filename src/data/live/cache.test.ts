/**
 * BAR-066 / BAR-067 — what the cache will and will not serve.
 *
 * These cover the two ways a cache can do real damage: serving a payload it does
 * not understand, and serving back a position the database deliberately withheld.
 * The Dexie IO around them needs a browser and is covered by BAR-114.
 */
import { describe, expect, it } from 'vitest'
import { isReferencePayload, isSnapshotPayload, withoutBlindedLocations } from './cache'
import type { SnapshotRow } from './rows'

function row(locationId: string, skuId: string): SnapshotRow {
  return {
    location_id: locationId,
    location_code: locationId,
    location_name: locationId.toUpperCase(),
    location_kind: 'bar',
    sku_id: skuId,
    sku_code: skuId,
    sku_name: skuId,
    category_key: 'bottled_beer',
    container_type: 'bottle',
    ml_per_container: 650,
    containers: 48,
    ml: 31_200,
    value_minor: 0,
    updated_at: '2026-10-10T14:13:00Z',
  }
}

describe('withoutBlindedLocations', () => {
  const rows = [row('bar-3', 'kf'), row('bar-3', 'corona'), row('bar-1', 'kf')]

  it('drops every row for a location being counted on this device', () => {
    // The database already withholds these (BAR-161). This stops the cache handing
    // back what the database refused.
    const kept = withoutBlindedLocations(rows, new Set(['bar-3']))
    expect(kept).toHaveLength(1)
    expect(kept[0]!.location_id).toBe('bar-1')
  })

  it('drops them rather than zeroing them', () => {
    // A zero row is itself a claim about the position, and a counter shown zeroes
    // would reasonably enter zeroes.
    const kept = withoutBlindedLocations(rows, new Set(['bar-3']))
    expect(kept.some((r) => r.location_id === 'bar-3')).toBe(false)
  })

  it('returns everything when nothing is being counted', () => {
    expect(withoutBlindedLocations(rows, new Set())).toHaveLength(3)
  })

  it('does not mutate the cached rows', () => {
    const before = rows.length
    withoutBlindedLocations(rows, new Set(['bar-3']))
    expect(rows).toHaveLength(before)
  })
})

describe('payload validation', () => {
  const reference = { locations: [], skus: [], people: [], memberships: [] }

  it('accepts a complete reference payload', () => {
    expect(isReferencePayload(reference)).toBe(true)
  })

  it('rejects one missing a table — an older build wrote a different shape', () => {
    // Serving that as live reference data would put wrong names on a custody
    // record, which is worse than having no cache at all.
    expect(isReferencePayload({ locations: [], skus: [], people: [] })).toBe(false)
    expect(isReferencePayload({ ...reference, skus: 'not an array' })).toBe(false)
  })

  it('rejects rubbish', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      expect(isReferencePayload(bad)).toBe(false)
    }
  })

  it('requires a snapshot to carry the instant it was taken at', () => {
    // Without it the AS OF stamp would show "now", and a stale position shown as
    // current is the defect this whole project exists to prevent.
    expect(isSnapshotPayload({ rows: [], at: '2026-10-10T14:13:00Z' })).toBe(true)
    expect(isSnapshotPayload({ rows: [] })).toBe(false)
    expect(isSnapshotPayload({ at: '2026-10-10T14:13:00Z' })).toBe(false)
  })
})

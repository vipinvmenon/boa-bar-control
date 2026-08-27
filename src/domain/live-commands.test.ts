import { describe, expect, it } from 'vitest'
import { buildQueuedMovement } from './live-commands'

const base = {
  venueId: 'venue', idempotencyKey: 'key', businessDate: '2026-10-10', occurredAt: '2026-10-10T14:00:00Z',
  skuId: 'sku', containerQuantity: 24, mlQuantity: 15_600,
}

describe('offline live commands', () => {
  it('builds a balanced issue without deriving away exact units', () => {
    const command = buildQueuedMovement({ ...base, kind: 'issue', fromLocationId: 'warehouse', toLocationId: 'transit' })
    expect(command.lines.reduce((sum, line) => sum + line.container_delta, 0)).toBe(0)
    expect(command.lines.reduce((sum, line) => sum + line.ml_delta, 0)).toBe(0)
    expect(command.lines[0]).toMatchObject({ container_delta: -24, ml_delta: -15_600 })
  })

  it('builds waste as a one-sided signed depletion', () => {
    const command = buildQueuedMovement({ ...base, kind: 'waste', fromLocationId: 'bar-3', reason: 'Breakage' })
    expect(command.lines).toHaveLength(1)
    expect(command.lines[0]).toMatchObject({ container_delta: -24, ml_delta: -15_600 })
  })

  it('rejects a custody movement without distinct locations', () => {
    expect(() => buildQueuedMovement({ ...base, kind: 'transfer', fromLocationId: 'bar-3', toLocationId: 'bar-3' })).toThrow(/distinct/)
  })
})

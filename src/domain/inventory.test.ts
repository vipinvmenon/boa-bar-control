import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  applyIdempotently,
  derivePositions,
  mlFromGrossWeight,
  reverseMovement,
  theoreticalClosing,
  variance,
  varianceBand,
  weightedAverageCost,
  type InventoryMovement,
} from './inventory'

const movement: InventoryMovement = {
  id: 'mv-1',
  idempotencyKey: 'd7cc7e40-8341-4a96-aafa-a1c0ab37fd04',
  kind: 'transfer',
  occurredAt: '2026-10-10T14:01:00.000Z',
  businessDate: '2026-10-10',
  actorName: 'Chandan',
  lines: [
    {
      id: 'line-1',
      movementId: 'mv-1',
      skuId: 'kingfisher',
      locationId: 'warehouse',
      containerDelta: -48,
      mlDelta: -31_200,
      valueDeltaMinor: -96_000,
    },
    {
      id: 'line-2',
      movementId: 'mv-1',
      skuId: 'kingfisher',
      locationId: 'bar-3',
      containerDelta: 48,
      mlDelta: 31_200,
      valueDeltaMinor: 96_000,
    },
  ],
}

describe('inventory ledger', () => {
  it('replays the same idempotency key once', () => {
    expect(applyIdempotently([movement], movement)).toHaveLength(1)
  })

  it('reversal nets every position to zero', () => {
    const reversed = reverseMovement(movement, {
      id: 'mv-2',
      idempotencyKey: '4e65fdf1-e276-4d91-b4a3-a005ba7cb9ef',
      actorName: 'Salman',
      occurredAt: '2026-10-10T14:03:00.000Z',
    })
    for (const position of derivePositions([movement, reversed])) {
      expect(position.containers).toBe(0)
      expect(position.ml).toBe(0)
      expect(position.valueMinor).toBe(0)
    }
  })

  it('transfer sums to zero across locations', () => {
    expect(movement.lines.reduce((sum, line) => sum + line.mlDelta, 0)).toBe(0)
    expect(movement.lines.reduce((sum, line) => sum + line.containerDelta, 0)).toBe(0)
  })

  it('reversal property holds for arbitrary exact quantities', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (quantity) => {
        const candidate = structuredClone(movement)
        candidate.lines[0]!.mlDelta = -quantity
        candidate.lines[1]!.mlDelta = quantity
        const reversed = reverseMovement(candidate, {
          id: 'mv-3',
          idempotencyKey: '2f10ee1b-c5d1-4492-bc11-08cbed7af950',
          actorName: 'Auditor',
          occurredAt: '2026-10-10T14:04:00.000Z',
        })
        return derivePositions([candidate, reversed]).every((position) => position.ml === 0)
      }),
    )
  })
})

describe('audit calculations', () => {
  it('uses the spec identity for theoretical closing', () => {
    expect(
      theoreticalClosing({
        openingMl: 1000,
        receivedMl: 500,
        issuedOutMl: 200,
        receivedInMl: 100,
        soldMl: 600,
        compedMl: 50,
        wastedMl: 25,
        returnedMl: 75,
      }),
    ).toBe(650)
  })

  it('calculates variance against throughput and handles no throughput', () => {
    expect(variance({ countedClosingMl: 84000, theoreticalClosingMl: 96000, throughputMl: 96000 }))
      .toEqual({ varianceMl: -12000, variancePct: -12.5 })
    expect(variance({ countedClosingMl: 10, theoreticalClosingMl: 0, throughputMl: 0 }))
      .toEqual({ varianceMl: 10, variancePct: null })
  })

  it('uses category tolerance bands symmetrically', () => {
    expect(varianceBand('bottled_beer', -0.8)).toBe('green')
    expect(varianceBand('bottled_beer', 2.4)).toBe('amber')
    expect(varianceBand('bottled_beer', -4)).toBe('red')
  })

  // BAR-087. Spec section 8: stock does not appear. A positive variance means a
  // missed receipt, a wrong-SKU ring-up, or a bad count — the first two being the
  // shapes a concealed loss takes — so it is never within tolerance.
  it('never grades a positive variance green, at any magnitude', () => {
    expect(varianceBand('bottled_beer', 0.5)).toBe('amber')
    expect(varianceBand('spirits', 1.2)).toBe('amber')
    expect(varianceBand('draught_beer', 4)).toBe('amber')
    expect(varianceBand('mixers', 0.9)).toBe('amber')
  })

  it('still grades the mirror-image negative variance green', () => {
    // The asymmetry is the point: the same magnitude is normal shrinkage one way
    // and unexplained appearance the other.
    expect(varianceBand('bottled_beer', -0.5)).toBe('green')
    expect(varianceBand('spirits', -1.2)).toBe('green')
    expect(varianceBand('draught_beer', -4)).toBe('green')
  })

  it('still grades a positive variance red on magnitude', () => {
    // Flooring at amber must not cap it there.
    expect(varianceBand('bottled_beer', 5)).toBe('red')
    expect(varianceBand('draught_beer', 20)).toBe('red')
  })

  it('treats an exact zero as green, not as a positive', () => {
    expect(varianceBand('bottled_beer', 0)).toBe('green')
  })

  it('bands an uncomputable percentage amber, never green', () => {
    expect(varianceBand('bottled_beer', null)).toBe('amber')
  })

  it('converts gross minus tare to ml and never produces negative stock', () => {
    expect(mlFromGrossWeight(1_030, 480)).toBe(550)
    expect(mlFromGrossWeight(300, 480)).toBe(0)
  })

  it('calculates weighted average cost in minor units', () => {
    expect(
      weightedAverageCost({
        currentQuantity: 10,
        currentValueMinor: 20_000,
        receivedQuantity: 10,
        receivedUnitCostMinor: 3_000,
      }),
    ).toBe(2_500)
  })
})

import { z } from 'zod'

export const movementKinds = [
  'receipt',
  'issue',
  'transfer',
  'return',
  'sale',
  'comp',
  'waste',
  'adjustment',
] as const

export type MovementKind = (typeof movementKinds)[number]

export type LocationKind =
  | 'warehouse'
  | 'bar'
  | 'hospitality'
  | 'lounge'
  | 'in_transit'

export type Unit = 'ml' | 'each'

export type InventoryLine = {
  id: string
  movementId: string
  skuId: string
  locationId: string
  containerDelta: number
  mlDelta: number
  valueDeltaMinor: number
}

export type InventoryMovement = {
  id: string
  idempotencyKey: string
  kind: MovementKind
  occurredAt: string
  businessDate: string
  fromLocationId?: string
  toLocationId?: string
  actorName: string
  acceptedBy?: string
  docketId?: string
  reason?: string
  reversesMovementId?: string
  lines: InventoryLine[]
}

export type Position = {
  skuId: string
  locationId: string
  containers: number
  ml: number
  valueMinor: number
}

export type VarianceBand = 'green' | 'amber' | 'red'

export const movementInputSchema = z.object({
  idempotencyKey: z.uuid(),
  kind: z.enum(movementKinds),
  occurredAt: z.iso.datetime(),
  businessDate: z.iso.date(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  actorName: z.string().min(1),
  acceptedBy: z.string().optional(),
  docketId: z.string().optional(),
  reason: z.string().optional(),
  reversesMovementId: z.string().optional(),
  lines: z.array(
    z.object({
      id: z.string().min(1),
      movementId: z.string().min(1),
      skuId: z.string().min(1),
      locationId: z.string().min(1),
      containerDelta: z.number().int(),
      mlDelta: z.number().int(),
      valueDeltaMinor: z.number().int(),
    }),
  ).min(1),
})

export function derivePositions(movements: InventoryMovement[]): Position[] {
  const positions = new Map<string, Position>()

  for (const movement of movements) {
    for (const line of movement.lines) {
      const key = `${line.locationId}:${line.skuId}`
      const existing = positions.get(key) ?? {
        skuId: line.skuId,
        locationId: line.locationId,
        containers: 0,
        ml: 0,
        valueMinor: 0,
      }
      positions.set(key, {
        ...existing,
        containers: existing.containers + line.containerDelta,
        ml: existing.ml + line.mlDelta,
        valueMinor: existing.valueMinor + line.valueDeltaMinor,
      })
    }
  }

  return [...positions.values()].sort((a, b) =>
    `${a.locationId}:${a.skuId}`.localeCompare(`${b.locationId}:${b.skuId}`),
  )
}

export function applyIdempotently(
  existing: InventoryMovement[],
  incoming: InventoryMovement,
): InventoryMovement[] {
  if (existing.some((movement) => movement.idempotencyKey === incoming.idempotencyKey)) {
    return existing
  }
  return [...existing, incoming]
}

export function reverseMovement(
  movement: InventoryMovement,
  input: { id: string; idempotencyKey: string; actorName: string; occurredAt: string },
): InventoryMovement {
  return {
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    kind: 'adjustment',
    occurredAt: input.occurredAt,
    businessDate: input.occurredAt.slice(0, 10),
    actorName: input.actorName,
    reason: `Reversal of ${movement.id}`,
    reversesMovementId: movement.id,
    lines: movement.lines.map((line, index) => ({
      ...line,
      id: `${input.id}:${index}`,
      movementId: input.id,
      containerDelta: -line.containerDelta,
      mlDelta: -line.mlDelta,
      valueDeltaMinor: -line.valueDeltaMinor,
    })),
  }
}

export function theoreticalClosing(input: {
  openingMl: number
  receivedMl: number
  issuedOutMl: number
  receivedInMl: number
  soldMl: number
  compedMl: number
  wastedMl: number
  returnedMl: number
}): number {
  return (
    input.openingMl +
    input.receivedMl -
    input.issuedOutMl +
    input.receivedInMl -
    input.soldMl -
    input.compedMl -
    input.wastedMl -
    input.returnedMl
  )
}

export function variance(input: {
  countedClosingMl: number
  theoreticalClosingMl: number
  throughputMl: number
}): { varianceMl: number; variancePct: number | null } {
  const varianceMl = input.countedClosingMl - input.theoreticalClosingMl
  return {
    varianceMl,
    variancePct:
      Math.abs(input.throughputMl) < 0.001
        ? null
        : (varianceMl / Math.abs(input.throughputMl)) * 100,
  }
}

const tolerance: Record<string, [number, number]> = {
  bottled_beer: [1, 3],
  draught_beer: [8, 15],
  spirits: [3, 8],
  mixers: [2, 5],
}

/**
 * The tolerance band edges for a category, as [greenMax, amberMax] percentages.
 *
 * Exported because the variance report has to *state* the band it judged a line
 * against — "Draught band 8-15%" in the design. A report that shows a colour
 * without the threshold behind it cannot be argued with, and the whole point of
 * the variance screen is that a manager can argue with it.
 */
export function toleranceFor(category: string): [number, number] {
  return tolerance[category] ?? [2, 5]
}

/**
 * BAR-087 — the band for a signed variance percentage.
 *
 * The magnitude is judged against the category's tolerance (spec section 8), but
 * the SIGN is not symmetric and must not be treated as such.
 *
 * A negative variance is expected: stock shrinks through spillage, overpour, line
 * purge and foam, and the tolerance table exists to say how much of that is
 * normal for each category. A POSITIVE variance is different in kind. Stock does
 * not appear. More was counted than the ledger can account for, which means a
 * receipt was never recorded, a sale was rung against the wrong SKU, or the count
 * itself is wrong — and the first two are the shapes a concealed loss takes.
 * Grading that green tells a manager the one line they should look at is fine.
 *
 * So a positive variance is floored at amber. It can still be red on magnitude;
 * it can never be green. This is why the function takes a signed percentage
 * rather than an absolute one, and why the previous version — which called
 * `Math.abs` and then banded — graded `+0.5%` on bottled beer, `+1.2%` on spirits
 * and `+4%` on draught as within tolerance.
 */
export function varianceBand(category: string, percentage: number | null): VarianceBand {
  // No throughput in the window means no percentage, and an unknown position is
  // not a clean one.
  if (percentage === null) return 'amber'

  const [greenMax, amberMax] = toleranceFor(category)
  const absolute = Math.abs(percentage)
  const onMagnitude: VarianceBand = absolute <= greenMax ? 'green' : absolute <= amberMax ? 'amber' : 'red'

  if (percentage > 0 && onMagnitude === 'green') return 'amber'
  return onMagnitude
}

export function mlFromGrossWeight(grossWeightG: number, tareWeightG: number): number {
  if (!Number.isFinite(grossWeightG) || !Number.isFinite(tareWeightG)) {
    throw new Error('Gross and tare weights must be finite numbers')
  }
  if (grossWeightG < 0 || tareWeightG < 0) {
    throw new Error('Gross and tare weights cannot be negative')
  }
  if (grossWeightG < tareWeightG) {
    throw new Error(`Gross weight cannot be below the ${tareWeightG} g tare`)
  }
  return Math.round(grossWeightG - tareWeightG)
}

export function weightedAverageCost(input: {
  currentQuantity: number
  currentValueMinor: number
  receivedQuantity: number
  receivedUnitCostMinor: number
}): number | null {
  const quantity = input.currentQuantity + input.receivedQuantity
  if (quantity <= 0) return null
  return Math.round(
    (input.currentValueMinor + input.receivedQuantity * input.receivedUnitCostMinor) /
      quantity,
  )
}

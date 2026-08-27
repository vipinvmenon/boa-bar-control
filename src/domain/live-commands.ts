import type { MovementKind } from './inventory'

export type QueuedMovementPayload = {
  venue_id: string
  idempotency_key: string
  kind: Extract<MovementKind, 'issue' | 'transfer' | 'waste'>
  business_date: string
  occurred_at: string
  source: 'pwa_offline_outbox'
  reason?: string
  metadata: Record<string, unknown>
  lines: Array<{
    sku_id: string
    location_id: string
    container_delta: number
    ml_delta: number
    value_delta_minor: number
  }>
}

export function buildQueuedMovement(input: {
  venueId: string
  idempotencyKey: string
  kind: QueuedMovementPayload['kind']
  businessDate: string
  occurredAt: string
  skuId: string
  containerQuantity: number
  mlQuantity: number
  fromLocationId?: string
  toLocationId?: string
  reason?: string
  metadata?: Record<string, unknown>
}): QueuedMovementPayload {
  if (!Number.isInteger(input.containerQuantity) || input.containerQuantity < 0) throw new Error('Container quantity must be a non-negative integer')
  if (!Number.isInteger(input.mlQuantity) || input.mlQuantity <= 0) throw new Error('Millilitres must be a positive integer')
  if (input.kind === 'waste' && (!input.fromLocationId || input.toLocationId)) throw new Error('Waste must remove stock from exactly one location')
  if (input.kind !== 'waste' && (!input.fromLocationId || !input.toLocationId || input.fromLocationId === input.toLocationId)) throw new Error('Custody movement requires distinct from/to locations')
  const lines: QueuedMovementPayload['lines'] = []
  if (input.fromLocationId) lines.push({ sku_id: input.skuId, location_id: input.fromLocationId, container_delta: -input.containerQuantity, ml_delta: -input.mlQuantity, value_delta_minor: 0 })
  if (input.toLocationId) lines.push({ sku_id: input.skuId, location_id: input.toLocationId, container_delta: input.containerQuantity, ml_delta: input.mlQuantity, value_delta_minor: 0 })
  return {
    venue_id: input.venueId,
    idempotency_key: input.idempotencyKey,
    kind: input.kind,
    business_date: input.businessDate,
    occurred_at: input.occurredAt,
    source: 'pwa_offline_outbox',
    reason: input.reason,
    metadata: input.metadata ?? {},
    lines,
  }
}

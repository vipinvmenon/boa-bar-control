import { enqueueMovement } from './offline-db'
import { supabase } from './supabase'
import type { ActivityItem, StockItem } from './demo-store'
import { buildQueuedMovement } from '../domain/live-commands'

export type LiveLocation = { id: string; code: string; name: string; kind: string }
export type LiveContext = { venueId: string; locations: LiveLocation[] }
export type LiveSnapshot = { stock: StockItem[]; activity: ActivityItem[]; context: LiveContext }

type PositionRow = {
  location_id: string
  location_code: string
  location_name: string
  location_kind: string
  sku_id: string
  sku_code: string
  sku_name: string
  category_key: StockItem['categoryKey']
  container_type: string
  ml_per_container: number
  containers: number
  ml: number
}

export async function loadLiveSnapshot(venueId: string): Promise<LiveSnapshot> {
  if (!supabase) throw new Error('Supabase is not configured')
  const [{ data: locations, error: locationError }, { data: skus, error: skuError }, { data: positions, error: positionError }, { data: movements, error: movementError }] = await Promise.all([
    supabase.from('boa_bar_location').select('id, code, name, kind').eq('venue_id', venueId).eq('active', true),
    supabase.from('boa_bar_sku').select('id, code, name, category_key, container_type, ml_per_container').eq('venue_id', venueId).eq('active', true),
    supabase.rpc('boa_bar_inventory_snapshot', { p_venue_id: venueId }),
    supabase.from('boa_bar_movement').select('id, kind, occurred_at, reason, source').eq('venue_id', venueId).order('occurred_at', { ascending: false }).limit(40),
  ])
  if (locationError) throw locationError
  if (skuError) throw skuError
  if (positionError) throw positionError
  if (movementError) throw movementError
  const liveLocations = (locations ?? []) as LiveLocation[]
  const positionRows = (positions ?? []) as PositionRow[]
  const stock = (skus ?? []).map((sku) => {
    const warehouse = positionRows.find((row) => row.sku_id === sku.id && row.location_kind === 'warehouse')?.containers ?? 0
    const bar3 = positionRows.find((row) => row.sku_id === sku.id && row.location_code === 'bar_3')?.containers ?? 0
    const categoryKey = sku.category_key as StockItem['categoryKey']
    return {
      id: sku.id,
      name: sku.name,
      category: categoryKey.replaceAll('_', ' '),
      categoryKey,
      container: sku.container_type,
      mlPerContainer: sku.ml_per_container,
      warehouse: Number(warehouse),
      bar3: Number(bar3),
      status: bar3 <= 12 ? 'critical' as const : bar3 <= 24 ? 'watch' as const : 'healthy' as const,
    }
  })
  const activity = (movements ?? []).map((movement) => ({
    id: movement.id,
    at: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(movement.occurred_at)),
    kind: movement.kind.toUpperCase(),
    title: `${movement.kind.replaceAll('_', ' ')} posted`,
    detail: movement.reason ?? `Source · ${movement.source}`,
    actor: 'Authenticated staff',
    tone: movement.kind === 'waste' || movement.kind === 'adjustment' ? 'red' as const : movement.kind === 'receipt' ? 'green' as const : 'gold' as const,
  }))
  return { stock, activity, context: { venueId, locations: liveLocations } }
}

export function locationFor(context: LiveContext, value: string) {
  const normalized = value.toLowerCase().replaceAll(' ', '_').replaceAll('·', '')
  return context.locations.find((location) => location.code === normalized || value.toLowerCase().startsWith(location.name.toLowerCase()) || location.name.toLowerCase().startsWith(value.toLowerCase().split(' · ')[0]!))
}

export async function queueLiveMovement(input: {
  context: LiveContext
  kind: 'issue' | 'transfer' | 'waste'
  skuId: string
  containerQuantity: number
  mlQuantity: number
  fromLocationId?: string
  toLocationId?: string
  reason?: string
  metadata?: Record<string, unknown>
}) {
  const idempotencyKey = crypto.randomUUID()
  const occurredAt = new Date().toISOString()
  const payload = buildQueuedMovement({
    venueId: input.context.venueId,
    idempotencyKey,
    kind: input.kind,
    businessDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    occurredAt,
    skuId: input.skuId,
    containerQuantity: input.containerQuantity,
    mlQuantity: input.mlQuantity,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    reason: input.reason,
    metadata: input.metadata,
  })
  return enqueueMovement({
    idempotencyKey,
    payload,
  })
}

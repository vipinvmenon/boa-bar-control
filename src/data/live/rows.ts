/**
 * BAR-042 — the raw row shapes the live repository reads, and the guard that
 * turns a Supabase error into a throw.
 *
 * Column lists are written out in full at every call site rather than `select('*')`:
 * an explicit list is the only thing that fails loudly when a migration renames a
 * column, and `*` on these tables would also pull columns the client has no
 * business holding.
 */
import type { PostgrestError } from '@supabase/supabase-js'

export type LocationRow = {
  id: string
  code: string
  name: string
  kind: 'warehouse' | 'bar' | 'hospitality' | 'lounge' | 'in_transit'
  parent_id: string | null
}
export const LOCATION_COLUMNS = 'id, code, name, kind, parent_id'

export type SkuRow = {
  id: string
  code: string
  name: string
  category_key: 'bottled_beer' | 'draught_beer' | 'spirits' | 'mixers'
  container_type: string
  ml_per_container: number
  units_per_case: number
  tare_weight_g: number | null
}
export const SKU_COLUMNS =
  'id, code, name, category_key, container_type, ml_per_container, units_per_case, tare_weight_g'

export type PersonRow = { user_id: string; display_name: string; short_name: string }
export const PERSON_COLUMNS = 'user_id, display_name, short_name'

export type MembershipRow = {
  user_id: string
  role: 'crew' | 'warehouse' | 'bar_lead' | 'manager' | 'auditor' | 'admin'
  location_id: string | null
}
export const MEMBERSHIP_COLUMNS = 'user_id, role, location_id'

export type ToleranceBandRow = {
  category_key: string
  green_max_pct: number
  amber_max_pct: number
  effective_from: string
}

export type SnapshotRow = {
  location_id: string
  location_code: string
  location_name: string
  location_kind: LocationRow['kind']
  sku_id: string
  sku_code: string
  sku_name: string
  category_key: SkuRow['category_key']
  container_type: string
  ml_per_container: number
  containers: number
  ml: number
  value_minor: number
  updated_at: string
}

export type DocketRow = {
  id: string
  docket_no: string
  from_location_id: string
  to_location_id: string
  status: 'awaiting' | 'accepted' | 'accepted_short' | 'cancelled'
  issued_by: string
  issued_at: string
  accepted_by: string | null
  accepted_at: string | null
  difference_reason: string | null
}
export const DOCKET_COLUMNS =
  'id, docket_no, from_location_id, to_location_id, status, issued_by, issued_at, accepted_by, accepted_at, difference_reason'

export type DocketLineRow = {
  docket_id: string
  sku_id: string
  issued_containers: number
  issued_ml: number
  accepted_containers: number | null
  accepted_ml: number | null
}
export const DOCKET_LINE_COLUMNS =
  'docket_id, sku_id, issued_containers, issued_ml, accepted_containers, accepted_ml'

export type MovementRow = {
  id: string
  kind: 'receipt' | 'issue' | 'transfer' | 'return' | 'sale' | 'comp' | 'waste' | 'adjustment'
  occurred_at: string
  actor_id: string
  source: string
  reason: string | null
  docket_id: string | null
  reverses_movement_id: string | null
  metadata: Record<string, unknown>
}
export const MOVEMENT_COLUMNS =
  'id, kind, occurred_at, actor_id, source, reason, docket_id, reverses_movement_id, metadata'

export type MovementLineRow = {
  movement_id: string
  sku_id: string
  location_id: string
  container_delta: number
  ml_delta: number
}
export const MOVEMENT_LINE_COLUMNS =
  'movement_id, sku_id, location_id, container_delta, ml_delta'

export type CountSessionRow = {
  id: string
  location_id: string
  count_kind: 'opening_warehouse' | 'opening_bar' | 'mid_event' | 'close_out'
  status: 'draft' | 'submitted' | 'reviewed'
  assigned_to: string
  submitted_at: string | null
  reviewed_by: string | null
  created_at: string
}
export const COUNT_SESSION_COLUMNS =
  'id, location_id, count_kind, status, assigned_to, submitted_at, reviewed_by, created_at'

export type CountLineRow = {
  count_session_id: string
  sku_id: string
  full_containers: number
  partial_ml: number
  gross_weight_g: number | null
}
export const COUNT_LINE_COLUMNS =
  'count_session_id, sku_id, full_containers, partial_ml, gross_weight_g'

/**
 * Supabase reports failure in the result body rather than by rejecting. A `data`
 * read that ignores `error` therefore silently becomes an empty array — which on
 * this project would render an empty bar as a counted-and-correct bar. Every read
 * goes through here.
 */
export function unwrap<T>(
  label: string,
  result: { data: T | null; error: PostgrestError | null },
): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`, { cause: result.error })
  }
  if (result.data === null) {
    throw new Error(`${label}: no data and no error — refusing to treat this as empty`)
  }
  return result.data
}

/** `.in('id', [])` is a malformed filter in PostgREST, so guard the empty case. */
export function isEmpty(ids: readonly string[]): boolean {
  return ids.length === 0
}

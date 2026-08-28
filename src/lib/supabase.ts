import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && publishableKey)

/**
 * BAR-139. A production build that is not configured for Supabase would
 * otherwise fall through to fixture data and, before this fix, label itself
 * LIVE. Twenty staff could work a full shift against invented stock and nobody
 * would know until the next morning. Demo data is a development affordance
 * only, so refuse to start a production build without real configuration.
 */
export const configError: string | null = (() => {
  if (isSupabaseConfigured) return null
  if (!import.meta.env.PROD) return null
  const missing = [!url && 'VITE_SUPABASE_URL', !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY']
    .filter(Boolean)
    .join(' and ')
  return `Not configured for live data: ${missing} is missing. This build cannot be used to record stock.`
})()

export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * BAR-044. The command RPCs, per ADR-013. These are the ONLY write path — the
 * `authenticated` role holds no INSERT on any table, so there is nothing else
 * they could be.
 *
 * Called from the outbox drain and nowhere else: `docs/OFFLINE-SYNC.md` rule 5
 * says every write goes to the outbox, online or offline, with no fast path that
 * skips it. A screen or a service that called one of these directly would be able
 * to report success before the write was durable.
 */
export async function createDocketRpc(payload: unknown) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('boa_bar_create_docket', { p_payload: payload })
  if (error) throw error
  return data
}

export async function acceptDocketRpc(payload: unknown) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('boa_bar_accept_docket', { p_payload: payload })
  if (error) throw error
  return data
}

export async function submitCountRpc(payload: unknown) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('boa_bar_submit_count', { p_payload: payload })
  if (error) throw error
  return data
}

export async function submitMovement(payload: unknown) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('boa_bar_submit_movement', {
    p_payload: payload,
  })
  if (error) throw error
  return data
}

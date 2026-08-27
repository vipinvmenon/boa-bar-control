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

export async function submitMovement(payload: unknown) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('boa_bar_submit_movement', {
    p_payload: payload,
  })
  if (error) throw error
  return data
}

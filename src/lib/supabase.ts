import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && publishableKey)

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

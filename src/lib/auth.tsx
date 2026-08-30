/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, rpc, supabase } from './supabase'

export type VenueMembership = {
  venueId: string
  venueCode: string
  venueName: string
  /**
   * boa_bar_venue.timezone. The live repository needs it: every stamp the design
   * shows is venue-local wall-clock, and a crew phone set to the wrong timezone
   * must not be able to put a wrong time on an excise record (BAR-042).
   */
  venueTimezone: string
  role: 'crew' | 'warehouse' | 'bar_lead' | 'manager' | 'auditor' | 'admin'
  locationId?: string
  locationName?: string
}

type AuthState = {
  mode: 'demo' | 'live'
  loading: boolean
  user: User | null
  session: Session | null
  memberships: VenueMembership[]
  activeMembership: VenueMembership | null
  error?: string
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** Redeem a membership invite before any venue membership exists (BAR-143). */
  claimInvite: (code: string) => Promise<{ name: string; role: VenueMembership['role'] }>
  setActiveVenue: (venueId: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [memberships, setMemberships] = useState<VenueMembership[]>([])
  const [activeVenueId, setActiveVenueId] = useState<string>()
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setError(undefined)
      if (nextSession) window.dispatchEvent(new CustomEvent('boa:auth-ready'))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !session?.user) {
      setMemberships([])
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      const { data: membershipRows, error: membershipError } = await client
        .from('boa_bar_membership')
        .select('venue_id, role, location_id')
        .eq('user_id', session.user.id)
        .eq('active', true)
      if (membershipError) throw membershipError
      const venueIds = [...new Set((membershipRows ?? []).map((row) => row.venue_id as string))]
      const locationIds = [...new Set((membershipRows ?? []).map((row) => row.location_id as string | null).filter(Boolean))] as string[]
      const [{ data: venues, error: venueError }, { data: locations, error: locationError }] = await Promise.all([
        venueIds.length ? client.from('boa_bar_venue').select('id, code, name, timezone').in('id', venueIds) : Promise.resolve({ data: [], error: null }),
        locationIds.length ? client.from('boa_bar_location').select('id, name').in('id', locationIds) : Promise.resolve({ data: [], error: null }),
      ])
      if (venueError) throw venueError
      if (locationError) throw locationError
      const next = (membershipRows ?? []).map((row) => ({
        venueId: row.venue_id as string,
        venueCode: (venues ?? []).find((venue) => venue.id === row.venue_id)?.code ?? 'venue',
        venueName: (venues ?? []).find((venue) => venue.id === row.venue_id)?.name ?? 'BOA Bar Control',
        // Falls back to the event's own timezone rather than the device's: a
        // missing column must not silently reinterpret every timestamp.
        venueTimezone: (venues ?? []).find((venue) => venue.id === row.venue_id)?.timezone ?? 'Asia/Kolkata',
        role: row.role as VenueMembership['role'],
        locationId: (row.location_id as string | null) ?? undefined,
        locationName: (locations ?? []).find((location) => location.id === row.location_id)?.name,
      }))
      if (!active) return
      setMemberships(next)
      setActiveVenueId((current) => current && next.some((item) => item.venueId === current) ? current : next[0]?.venueId)
      setError(undefined)
      setLoading(false)
    }
    void load().catch((caught) => {
      if (!active) return
      setError(caught instanceof Error ? caught.message : 'Unable to load venue access')
      setLoading(false)
    })
    return () => { active = false }
  }, [session?.user])

  const value = useMemo<AuthState>(() => ({
    mode: isSupabaseConfigured ? 'live' : 'demo',
    loading,
    user: session?.user ?? null,
    session,
    memberships,
    activeMembership: memberships.find((item) => item.venueId === activeVenueId) ?? memberships[0] ?? null,
    error,
    signInWithEmail: async (email) => {
      if (!supabase) return
      setLoading(true)
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      setLoading(false)
      if (signInError) throw signInError
    },
    signOut: async () => {
      if (!supabase) return
      // A shared phone must be handable to the next person even in a dead spot.
      // Local scope clears this device's session without requiring a network
      // round-trip; server-side sessions remain governed by their expiry.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
    },
    claimInvite: async (code) => {
      const result = (await rpc('boa_bar_claim_invite', { p_code: code })) as
        | { display_name?: string; role?: VenueMembership['role'] }
        | null
      if (!result?.role) throw new Error('That code is not valid')
      return { name: result.display_name ?? '', role: result.role }
    },
    setActiveVenue: setActiveVenueId,
  }), [activeVenueId, error, loading, memberships, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

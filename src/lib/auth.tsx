/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, rpc, supabase } from './supabase'
import { clearUserCache, offlineDb } from './offline-db'
import { canUseCachedMemberships } from './auth-offline'

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

function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown }
  return candidate.status === 401 || candidate.status === 403 || candidate.code === '401' || candidate.code === '403'
}

async function readCachedMemberships(userId: string): Promise<VenueMembership[] | null> {
  const cached = await offlineDb.referenceCache.get(`auth:memberships:${userId}`)
  return cached?.value && Array.isArray(cached.value) ? cached.value as VenueMembership[] : null
}

type AuthState = {
  mode: 'demo' | 'live'
  loading: boolean
  user: User | null
  session: Session | null
  memberships: VenueMembership[]
  activeMembership: VenueMembership | null
  /**
   * BAR-165. Whether we yet know what this user can reach. `loading` does not
   * answer that — see `membershipsFor`.
   */
  membershipsReady: boolean
  error?: string
  signInWithEmail: (email: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
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
  /**
   * BAR-165. The user id whose memberships have been resolved — from the cache,
   * from the server, or by failing.
   *
   * `loading` cannot answer "do we know what this person can reach yet". It is
   * lowered by whoever established the session, and the membership load only
   * raises it again on the next render, so there is a frame in between where a
   * signed-in user has an empty membership list and nothing is loading. The gate
   * read that frame as "no venue access" and flashed the rejection screen at
   * somebody who had just signed in correctly — on every cold start with a
   * session, and every time a code was verified.
   *
   * An id rather than a boolean, so a session change invalidates it on its own
   * rather than needing to be reset in the right order.
   */
  const [membershipsFor, setMembershipsFor] = useState<string | null>(null)

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
      setMembershipsFor(null)
      return
    }
    const userId = session.user.id
    let active = true
    const load = async () => {
      setLoading(true)
      const cacheKey = `auth:memberships:${session.user.id}`
      const restore = (cached: VenueMembership[]) => {
        if (!active) return false
        setMemberships(cached)
        setActiveVenueId((current) => current && cached.some((item) => item.venueId === current) ? current : cached[0]?.venueId)
        setError(undefined)
        setMembershipsFor(userId)
        setLoading(false)
        return true
      }
      // BAR-068. A cold start in a dead spot must be able to reach the already
      // signed-in venue. Only use a cached membership with a still-valid JWT;
      // sign-out clears this cache before the device changes hands.
      if (canUseCachedMemberships({ online: navigator.onLine, expiresAt: session.expires_at })) {
        const cached = await readCachedMemberships(session.user.id)
        if (cached && restore(cached)) return
      }
      try {
        const { data: membershipRows, error: membershipError } = await client
          .from('boa_bar_membership')
          .select('venue_id, role, location_id')
          .eq('user_id', session.user.id)
          .eq('active', true)
          // BAR-128. A user can hold more than one active role; stable ordering
          // keeps the selected venue deterministic across refreshes and devices.
          .order('venue_id', { ascending: true })
          .order('role', { ascending: true })
          .order('location_id', { ascending: true, nullsFirst: true })
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
        await offlineDb.referenceCache.put({ key: cacheKey, value: next, refreshedAt: Date.now() })
        setActiveVenueId((current) => current && next.some((item) => item.venueId === current) ? current : next[0]?.venueId)
        setError(undefined)
        setMembershipsFor(userId)
        setLoading(false)
      } catch (caught) {
        // `navigator.onLine` can be true on a phone that can reach its local
        // network but not Supabase. Treat a failed membership read as offline
        // only when it is not an explicit auth/permission rejection.
        if (!isAuthFailure(caught) && canUseCachedMemberships({ online: false, expiresAt: session.expires_at })) {
          const cached = await readCachedMemberships(session.user.id)
          if (cached && restore(cached)) return
        }
        throw caught
      }
    }
    void load().catch((caught) => {
      if (!active) return
      setError(caught instanceof Error ? caught.message : 'Unable to load venue access')
      // Resolved by failing. The gate must show the rejection with its reason
      // rather than a skeleton that never ends.
      setMembershipsFor(userId)
      setLoading(false)
    })
    return () => { active = false }
  }, [session?.user, session?.expires_at])

  const value = useMemo<AuthState>(() => ({
    mode: isSupabaseConfigured ? 'live' : 'demo',
    loading,
    /** False while a signed-in user's memberships have not been resolved yet. */
    membershipsReady: !session?.user || membershipsFor === session.user.id,
    user: session?.user ?? null,
    session,
    memberships,
    activeMembership: memberships.find((item) => item.venueId === activeVenueId) ?? memberships[0] ?? null,
    error,
    /**
     * BAR-165. Deliberately does NOT touch `loading`.
     *
     * `loading` means "we do not yet know who you are", and it makes `AuthGate`
     * render a skeleton in place of whatever was on screen. Requesting a code
     * does not change who you are — but flipping the flag around the request
     * unmounted the sign-in screen and remounted it fresh, so the moment the code
     * was sent the person was thrown back to the address step to do it again.
     * The request's in-flight state belongs to its own button.
     */
    signInWithEmail: async (email) => {
      if (!supabase) return
      const { error: signInError } = await supabase.auth.signInWithOtp({ email })
      if (signInError) throw signInError
    },
    verifyEmailOtp: async (email, token) => {
      if (!supabase) return
      setLoading(true)
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      setLoading(false)
      if (verifyError) throw verifyError
    },
    signOut: async () => {
      if (!supabase) return
      // A shared phone must be handable to the next person even in a dead spot.
      // Local scope clears this device's session without requiring a network
      // round-trip; server-side sessions remain governed by their expiry.
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) throw signOutError
      } finally {
        // BAR-137. A shared phone must not retain the previous person's
        // membership or unfinished form data after sign-out, even if the
        // auth request reports an error.
        await clearUserCache()
      }
    },
    claimInvite: async (code) => {
      const result = (await rpc('boa_bar_claim_invite', { p_code: code })) as
        | { display_name?: string; role?: VenueMembership['role'] }
        | null
      if (!result?.role) throw new Error('That code is not valid')
      return { name: result.display_name ?? '', role: result.role }
    },
    setActiveVenue: setActiveVenueId,
  }), [activeVenueId, error, loading, memberships, membershipsFor, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

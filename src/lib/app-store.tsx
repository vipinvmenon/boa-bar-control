/* eslint-disable react-refresh/only-export-components */
/**
 * Session state that is not data: toasts, the caller's role, and how the outbox
 * is doing.
 *
 * This replaces `demo-store.tsx`, which was 365 lines and did four jobs — a
 * reducer, a fixture set, an optimistic write engine and a live data adapter.
 * Three of them are gone:
 *
 *   - the FIXTURE SET is the repository's job (BAR-042/BAR-043);
 *   - the WRITE ENGINE is the service layer's (BAR-044). Its three actions
 *     (`issue`, `accept`, `waste`) each ended in `void queueLiveMovement(...)`,
 *     an unawaited promise that swallowed any throw while the UI toasted
 *     success — BAR-071, the "no silent write loss" defect — and the waste one
 *     posted to `bar_3` whatever bar you were standing in (BAR-133). All three
 *     were unreachable by the time they were deleted;
 *   - the LIVE ADAPTER (`src/lib/live-repository.ts`) was a second live data path
 *     alongside `src/data/live/`, so the app had two answers to "what is the
 *     stock" and the older one hardcoded `bar_3` (BAR-164).
 *
 * What is left is genuinely session state, and it is derived from real sources
 * rather than from demo toggles:
 *
 *   `role`      from the signed-in membership, not a switch (BAR-077)
 *   `offline`   from the browser, not a switch (BAR-073)
 *   `pending`   from the outbox
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useAuth } from './auth'
import { getQueueSummary } from './offline-db'

/**
 * Two tiers, because that is what the screens gate on. The seven real roles live
 * on the membership; this is the derived question "may this person see money and
 * variance". Spec §13's access tiers are BAR-132.
 */
export type StaffRole = 'Crew' | 'Manager'

type AppStore = {
  role: StaffRole
  /** The real membership role, for anything that needs more than the two tiers. */
  venueRole: string | null
  activeVenueName?: string
  /** True when the browser says there is no connection. Not a toggle. */
  offline: boolean
  /** Writes sitting in the outbox, and writes that have given up. */
  pending: number
  failed: number
  lastFailureId?: string
  lastFailureKind?: string
  /** Exact server refusal for the newest retained dead letter (BAR-135). */
  lastFailure?: string
  toast?: string
  flash: (message: string) => void
}

const AppStoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const auth = useAuth()
  const [toast, setToast] = useState<string>()
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [queue, setQueue] = useState<{
    pending: number
    failed: number
    lastFailureId?: string
    lastFailureKind?: string
    lastFailure?: string
  }>({
    pending: 0,
    failed: 0,
    lastFailureId: undefined,
  })

  /**
   * BAR-073. Real connectivity, from the browser's own events, replacing a
   * hand-operated demo switch that shipped as a user-facing control. It is still
   * only a hint — `navigator.onLine` reports the network interface, not whether
   * Supabase is reachable — but a wrong hint the user cannot fake is better than a
   * toggle that made the state meaningless.
   */
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // The outbox depth, so the shell can say how much work is unsent.
  useEffect(() => {
    let active = true
    const refresh = () => {
      void getQueueSummary().then((summary) => {
        if (active) setQueue(summary)
      })
    }
    refresh()
    window.addEventListener('boa:queue-change', refresh)
    const timer = window.setInterval(refresh, 5_000)
    return () => {
      active = false
      window.removeEventListener('boa:queue-change', refresh)
      window.clearInterval(timer)
    }
  }, [])

  const flash = useCallback((message: string) => {
    setToast(message)
    // 2600 ms, the design's own duration (BAR-041). Every toast expires, including
    // ones raised while another is showing.
    window.setTimeout(() => setToast((current) => (current === message ? undefined : current)), 2600)
  }, [])

  const venueRole = auth.activeMembership?.role ?? null

  const value = useMemo<AppStore>(
    () => ({
      // Derived from the membership the database issued, never from a control in
      // the UI. A client-side role check is an affordance; the database is the
      // control (non-negotiable 7).
      role: venueRole === 'manager' || venueRole === 'admin' || venueRole === 'auditor' ? 'Manager' : 'Crew',
      venueRole,
      activeVenueName: auth.activeMembership?.venueName,
      offline,
      pending: queue.pending,
      failed: queue.failed,
      lastFailureId: queue.lastFailureId,
      lastFailureKind: queue.lastFailureKind,
      lastFailure: queue.lastFailure,
      toast,
      flash,
    }),
    [venueRole, auth.activeMembership?.venueName, offline, queue.pending, queue.failed, queue.lastFailureId, queue.lastFailureKind, queue.lastFailure, toast, flash],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider')
  return store
}

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
  /**
   * BAR-165. The membership's fixed location, when it has one.
   *
   * A bar lead or a warehouse hand is posted to a location and every write they
   * make belongs to it. A manager, admin or auditor is not, and their writes need
   * a location chosen in the route — so a destination that resolves its location
   * from the membership is only offered to somebody who has one.
   */
  activeLocationId?: string
  /** True when the browser says there is no connection. Not a toggle. */
  offline: boolean
  /** Writes sitting in the outbox, and writes that have given up. */
  pending: number
  failed: number
  /** The drain is paused on an auth failure; the pending row is retained. */
  authStopped: boolean
  authFailureId?: string
  authFailureKind?: string
  authFailure?: string
  lastFailureId?: string
  lastFailureKind?: string
  /** Exact server refusal for the newest retained dead letter (BAR-135). */
  lastFailure?: string
  toast?: Toast
  /**
   * BAR-168. A write that reports nothing is a write people record twice. The
   * optional action is how a queued movement can be taken back inside its own
   * window, so routine stock entry needs no confirmation dialogue at all.
   */
  flash: (message: string, action?: ToastAction) => void
  dismissToast: () => void
}

export type ToastAction = { label: string; run: () => void }
export type Toast = { id: number; message: string; action?: ToastAction }

const AppStoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const auth = useAuth()
  const [toast, setToast] = useState<Toast>()
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [queue, setQueue] = useState<{
    pending: number
    failed: number
    authStopped: boolean
    authFailureId?: string
    authFailureKind?: string
    authFailure?: string
    lastFailureId?: string
    lastFailureKind?: string
    lastFailure?: string
  }>({
    pending: 0,
    failed: 0,
    authStopped: false,
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

  /**
   * BAR-168. Two durations, not one.
   *
   * 2600 ms was the design's duration (BAR-041) for a message that only had to be
   * read. A message that has to be read *and acted on* — an undo — cannot expire
   * in the time it takes to put a phone back in a pocket and take it out again,
   * so it gets 7 s. A plain confirmation gets 4.5 s: still brief, but long enough
   * to be read by somebody who is holding a crate.
   *
   * The id is what expires, so a toast raised while another is showing replaces
   * it cleanly and neither timer can clear the wrong message.
   */
  const flash = useCallback((message: string, action?: ToastAction) => {
    const id = Date.now() + Math.random()
    setToast({ id, message, action })
    window.setTimeout(
      () => setToast((current) => (current?.id === id ? undefined : current)),
      action ? 7_000 : 4_500,
    )
  }, [])

  const dismissToast = useCallback(() => setToast(undefined), [])

  const venueRole = auth.activeMembership?.role ?? null

  const value = useMemo<AppStore>(
    () => ({
      // Derived from the membership the database issued, never from a control in
      // the UI. A client-side role check is an affordance; the database is the
      // control (non-negotiable 7).
      role: venueRole === 'manager' || venueRole === 'admin' || venueRole === 'auditor' ? 'Manager' : 'Crew',
      venueRole,
      activeVenueName: auth.activeMembership?.venueName,
      activeLocationId: auth.activeMembership?.locationId,
      offline,
      pending: queue.pending,
      failed: queue.failed,
      authStopped: queue.authStopped,
      authFailureId: queue.authFailureId,
      authFailureKind: queue.authFailureKind,
      authFailure: queue.authFailure,
      lastFailureId: queue.lastFailureId,
      lastFailureKind: queue.lastFailureKind,
      lastFailure: queue.lastFailure,
      toast,
      flash,
      dismissToast,
    }),
    [venueRole, auth.activeMembership?.venueName, auth.activeMembership?.locationId, offline, queue.pending, queue.failed, queue.authStopped, queue.authFailureId, queue.authFailureKind, queue.authFailure, queue.lastFailureId, queue.lastFailureKind, queue.lastFailure, toast, flash, dismissToast],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider')
  return store
}

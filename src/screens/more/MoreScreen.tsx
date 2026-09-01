/**
 * BAR-104 — the More screen, rebuilt to the approved design.
 *
 * Values from the `isMore` branch of
 * references/design-source/design-markup.html:1069-1105, and the six menu items
 * from design-script.jsx's `moreItems`. Compare against references/ui/more.png.
 *
 * The previous version was a different screen, not a drifted one:
 *   - a 'CONTROLS & SETTLEMENT' eyebrow and an Anton title, where the design has
 *     a bordered header with a green role badge on the right
 *   - a profile panel with a name and shield icon, which the design does not have
 *   - three menu items with lucide icons, where the design has six with no icons
 *   - a 'DEMO CONTROLS' panel exposing role and connection toggles as product
 *     controls, which the design does not have anywhere
 *   - no SYNC STATE card, the one surface telling staff whether their work is
 *     saved — the single most important thing on this screen during an event
 *   - no build stamp
 *
 * The sync card is not decoration. Specification §10 requires the app to work
 * offline and to say so; this is where a bar lead checks whether the queue has
 * drained before they go home.
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../../lib/app-store'
import { useAuth } from '../../lib/auth'
import { clearUserCache, resolveFailedCommand } from '../../lib/offline-db'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

type MoreItem = {
  label: string
  sub: string
  managerOnly?: boolean
  go?: string
  available?: boolean
}

// design-script.jsx `moreItems`, in the design's order.
const ITEMS: MoreItem[] = [
  { label: 'CONTROL', sub: 'Live board · run-out projections · open dockets', managerOnly: true, available: false },
  { label: 'COUNTS', sub: 'Opening · mid-event · close-out, per location', go: '/count' },
  { label: 'VARIANCE', sub: 'Counted vs theoretical · tolerance bands', managerOnly: true, go: '/variance' },
  { label: 'REPORTS', sub: 'Excise return · stock settlement · sales per hour', go: '/reports' },
  { label: 'TEAM', sub: 'Invite staff · manage venue access', managerOnly: true, go: '/team' },
  // BAR-092. The fallback pack is the concrete settings action needed before
  // load-in; keeping it behind a toast made the already-built print route
  // unreachable from the product shell.
  { label: 'SETTINGS', sub: 'Device · sync · printed fallback sheets', go: '/print' },
]

const FAILED_ACTION: Record<string, string> = {
  movement: 'Movement',
  create_docket: 'Docket issue',
  accept_docket: 'Docket acceptance',
  submit_count: 'Count submission',
  record_waste: 'Waste entry',
  record_receipt: 'Stock receipt',
}

export function MoreScreen() {
  const store = useAppStore()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const offline = store.offline
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const [resolvingFailure, setResolvingFailure] = useState(false)
  const buildId = import.meta.env.VITE_RELEASE || 'dev'
  const session = useRepositoryQuery(['session'], (r) => r.session())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  const signOut = async () => {
    setSigningOut(true)
    setSignOutError(undefined)
    try {
      await clearUserCache()
      queryClient.clear()
      await auth.signOut()
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out')
      setSigningOut(false)
    }
  }

  const resolveFailure = async () => {
    if (!store.lastFailureId) return
    setResolvingFailure(true)
    try {
      await resolveFailedCommand(store.lastFailureId)
      store.flash('FAILED ACTION RESOLVED · QUEUE UNBLOCKED')
    } catch (error) {
      store.flash(error instanceof Error ? error.message : 'Could not resolve failed action')
    } finally {
      setResolvingFailure(false)
    }
  }

  // BAR-074. An expired JWT stops replay without consuming an attempt. Give the
  // person a direct recovery path; resolving the row would otherwise discard the
  // queued write's chance to post after they authenticate again.
  const reauthenticate = async () => {
    setSigningOut(true)
    setSignOutError(undefined)
    try {
      await auth.signOut()
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not start sign-in again')
      setSigningOut(false)
    }
  }

  const activate = (item: MoreItem) => {
    if (item.managerOnly && store.role !== 'Manager') {
      store.flash('MANAGER ACCESS REQUIRED')
      return
    }
    if (item.available === false) return
    if (item.go) {
      void navigate({ to: item.go })
      return
    }
  }

  return (
    <div className="section-screen">
      <header className="section-head">
        <h1 className="section-head-title">More</h1>
        <span className="more-role">{store.role.toUpperCase()}</span>
      </header>

      <div className="section-body more-body">
        <div className="more-list">
          {ITEMS.map((item) => (
            <button
              className="more-row"
              key={item.label}
              onClick={() => activate(item)}
              aria-disabled={item.available === false}
            >
              <div>
                <span className="more-row-label">{item.label}</span>
                <span className="more-row-sub">{item.sub}{item.available === false ? ' · NOT IN V1' : ''}</span>
              </div>
              {item.available !== false ? <ChevronRight size={16} strokeWidth={2} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>

        <section className="sync-card">
          <div className="sync-card-top">
            <span className="sync-card-eyebrow">SYNC STATE</span>
            <span className={`sync-card-badge ${store.authStopped || store.failed > 0 ? 'failed' : offline ? 'offline' : ''}`}>
              {store.authStopped
                ? '! SIGN IN AGAIN'
                : store.failed > 0
                ? `! ${store.failed} NOT SENT`
                : offline
                  ? '○ OFFLINE'
                  : '✓ SYNCED'}
            </span>
          </div>
          <p className="sync-card-copy">
            {store.authStopped
              ? `${store.pending} action${store.pending === 1 ? '' : 's'} retained on this device because your session needs to be renewed. Sign in again to retry them. Nothing is posted until the server confirms it.`
              : store.failed > 0
              ? `${store.failed} action${store.failed === 1 ? '' : 's'} needs attention. ${store.lastFailureKind ? `${FAILED_ACTION[store.lastFailureKind] ?? 'Write'}: ` : ''}${store.lastFailure ?? 'The server refused the write.'} It is retained on this device; later writes wait until it is resolved.`
              : offline
              ? `${store.pending} action${store.pending === 1 ? '' : 's'} queued on this device. They are recorded locally and will post in order when the network returns. Nothing is lost.`
              : `All movements posted. Last sync ${asOf.data?.label ?? '—'}. The device keeps a local copy of the SKU list and this bar’s ledger.`}
          </p>
          <div className="sync-card-grid">
            <div>
              <span>DEVICE</span>
              <strong>{session.data?.deviceLabel ?? '—'}</strong>
            </div>
            <div>
              <span>SIGNED IN</span>
              <strong>{session.data?.signedInName ?? '—'}</strong>
            </div>
          </div>
          {store.failed > 0 ? <button className="flow-cta-ghost sync-resolve" onClick={() => void resolveFailure()} disabled={resolvingFailure}>
            {resolvingFailure ? 'Resolving…' : 'Resolve failed action'}
          </button> : null}
          {store.authStopped ? <button className="flow-cta-ghost sync-resolve" onClick={() => void reauthenticate()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign in again to retry'}
          </button> : null}
        </section>

        {signOutError ? <p className="flow-error" role="alert">NOT SIGNED OUT · {signOutError}</p> : null}
        <button className="flow-cta-ghost sync-signout" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>

        <p className="more-build">BOA BAR INVENTORY · BUILD {buildId} · BOA 2026</p>
      </div>
    </div>
  )
}

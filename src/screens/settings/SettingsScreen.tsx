/**
 * BAR-165 — Settings.
 *
 * **Not a design screen.** The approved design's More has a SETTINGS row whose
 * handler is `flash('SETTINGS')` — the design never drew the destination. The
 * implementation pointed it at `/print`, so the row said "Device · sync · printed
 * fallback sheets" and delivered only the third of those.
 *
 * This screen is the honest destination: everything the app actually knows about
 * this device and this session, in one place, built from the existing tokens.
 * Nothing here is invented — every value already existed, scattered between the
 * More screen and nowhere.
 *
 * The SYNC STATE card moved here from MoreScreen. It is the one surface telling
 * staff whether their work is saved (specification §10), and it kept company on
 * More with six navigation rows, which made More neither a menu nor a status
 * screen.
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../lib/app-store'
import { useAuth } from '../../lib/auth'
import { clearUserCache, resolveFailedCommand } from '../../lib/offline-db'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

/** Which queued command failed, in the words a bar lead would use. */
const FAILED_ACTION: Record<string, string> = {
  movement: 'Movement',
  create_docket: 'Docket issue',
  accept_docket: 'Docket acceptance',
  submit_count: 'Count submission',
  record_waste: 'Waste entry',
  record_receipt: 'Stock receipt',
  request_top_up: 'Top-up request',
  update_top_up: 'Top-up update',
}

export function SettingsScreen() {
  const store = useAppStore()
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const offline = store.offline
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const [resolvingFailure, setResolvingFailure] = useState(false)
  const buildId = import.meta.env.VITE_RELEASE || 'dev'
  const session = useRepositoryQuery(['session'], (r) => r.session())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  /**
   * BAR-137's sequence, unchanged: clear the user-scoped cache and the in-memory
   * query data BEFORE the sign-out, and use a local-scope Supabase sign-out so it
   * works without a network round-trip. Unsent outbox commands are deliberately
   * retained.
   *
   * BAR-165 adds only the confirmation. This is a shared device: one mis-tap used
   * to end somebody else's shift and drop their cached reference data.
   */
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
      setConfirmSignOut(false)
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

  return (
    <div className="section-screen">
      <header className="section-head">
        <div className="count-head-left">
          <button className="flow-back" onClick={() => void navigate({ to: '/more' })} aria-label="Back to more">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="section-head-title">Settings</h1>
        </div>
      </header>

      <div className="section-body more-body">
        {/*
          BAR-165. Twenty temporary staff share a handful of phones. "Who is this
          phone signed in as" was answerable only from a DEVICE / SIGNED IN grid
          at the bottom of the sync card, which is not where anybody looks.
        */}
        <section className="sync-card">
          <div className="sync-card-top">
            <span className="sync-card-eyebrow">SIGNED IN</span>
            <span className="more-role">{store.role.toUpperCase()}</span>
          </div>
          <div className="sync-card-grid">
            <div>
              <span>PERSON</span>
              <strong>{session.data?.signedInName ?? '—'}</strong>
            </div>
            <div>
              <span>DEVICE</span>
              <strong>{session.data?.deviceLabel ?? '—'}</strong>
            </div>
          </div>
          <div className="sync-card-grid">
            <div>
              <span>VENUE</span>
              <strong>{store.activeVenueName ?? '—'}</strong>
            </div>
          </div>
        </section>

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
          {store.failed > 0 ? (
            <button className="flow-cta-ghost sync-resolve" onClick={() => void resolveFailure()} disabled={resolvingFailure}>
              {resolvingFailure ? 'Resolving…' : 'Resolve failed action'}
            </button>
          ) : null}
          {store.authStopped ? (
            <button className="flow-cta-ghost sync-resolve" onClick={() => void reauthenticate()} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign in again to retry'}
            </button>
          ) : null}
        </section>

        {/*
          BAR-092. The paper pack is the fallback for the festival network
          failing. It lives behind its own row rather than being what SETTINGS
          silently meant.
        */}
        <div className="more-list">
          <button className="more-row" onClick={() => void navigate({ to: '/print' })}>
            <div>
              <span className="more-row-label">PAPER FALLBACK</span>
              <span className="more-row-sub">Print count sheets and a blank docket · before load-in</span>
            </div>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {signOutError ? <p className="flow-error" role="alert">NOT SIGNED OUT · {signOutError}</p> : null}

        {confirmSignOut ? (
          <>
            <p className="settings-signout-warn">
              Signing out clears this device's cached SKU list and any count in progress. Work already
              queued is kept and will post when somebody signs in again.
            </p>
            <button
              className="flow-cta-ghost is-active"
              onClick={() => void signOut()}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Confirm sign out'}
            </button>
            <button className="flow-cta-ghost" onClick={() => setConfirmSignOut(false)} disabled={signingOut}>
              Keep me signed in
            </button>
          </>
        ) : (
          <button className="flow-cta-ghost" onClick={() => setConfirmSignOut(true)}>Sign out</button>
        )}

        <p className="more-build">BOA BAR INVENTORY · BUILD {buildId} · BOA 2026</p>
      </div>
    </div>
  )
}

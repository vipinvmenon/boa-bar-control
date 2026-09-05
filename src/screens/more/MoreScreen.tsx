import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, ClipboardCheck, FileText, LockKeyhole, LogOut, PackageCheck, RefreshCw, Scale, UserPlus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAppStore } from '../../lib/app-store'
import { useAuth } from '../../lib/auth'
import { clearUserCache, resolveFailedCommand } from '../../lib/offline-db'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

type MoreItem = { label: string; sub: string; go: string; icon: LucideIcon; managerOnly?: boolean; needsLocation?: boolean }

const FAILED_ACTION: Record<string, string> = {
  movement: 'Movement', create_docket: 'Docket issue', accept_docket: 'Docket acceptance', submit_count: 'Count submission',
  record_waste: 'Waste entry', record_receipt: 'Stock receipt', request_top_up: 'Top-up request', update_top_up: 'Top-up update',
}

const OPERATIONS: MoreItem[] = [
  { label: 'IN CUSTODY', sub: 'Dockets issued and not yet accepted', go: '/dockets', icon: PackageCheck },
  { label: 'COUNTS', sub: 'Open a blind count for your location', go: '/count', icon: ClipboardCheck, needsLocation: true },
  { label: 'VARIANCE', sub: 'Counted vs theoretical · tolerance bands', go: '/variance', icon: Scale, managerOnly: true },
]

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  const second = words[1] ?? ''
  if (second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
  return name.trim().slice(0, 2).toUpperCase() || '—'
}

export function MoreScreen() {
  const store = useAppStore()
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useRepositoryQuery(['session'], (r) => r.session())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const [resolvingFailure, setResolvingFailure] = useState(false)
  const fixtureCapture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fixture')
  const isManager = store.role === 'Manager' || fixtureCapture
  /**
   * BAR-171. This used to compare `auth.user.email` against two literal personal
   * addresses in client code. On the night nobody else could enrol a walk-up, and
   * the workaround — signing in as one of those two accounts — destroys
   * attribution on every movement made afterwards, which is the whole point of
   * the custody model.
   *
   * The gate is now the membership role the database already enforces on the
   * invite path; this stays a usability affordance, never a control
   * (non-negotiable 7). It reads `venueRole`, not the derived `store.role`,
   * because `store.role` folds `auditor` into `Manager` — an auditor may read
   * variance but must not enrol crew.
   */
  const canInvite = fixtureCapture || store.venueRole === 'manager' || store.venueRole === 'admin'
  const canManageTeam = canInvite || isManager
  const operations = OPERATIONS.filter((item) => (!item.managerOnly || isManager) && (!item.needsLocation || Boolean(store.activeLocationId)))
  const personName = session.data?.signedInName ?? auth.user?.email?.split('@')[0] ?? 'Staff'

  const signOut = async () => {
    setSigningOut(true); setSignOutError(undefined)
    try { await clearUserCache(); queryClient.clear(); await auth.signOut() }
    catch (error) { setSignOutError(error instanceof Error ? error.message : 'Could not sign out'); setSigningOut(false); setConfirmSignOut(false) }
  }

  const resolveFailure = async () => {
    if (!store.lastFailureId) return
    setResolvingFailure(true)
    try { await resolveFailedCommand(store.lastFailureId); store.flash('FAILED ACTION RESOLVED · QUEUE UNBLOCKED') }
    catch (error) { store.flash(error instanceof Error ? error.message : 'Could not resolve failed action') }
    finally { setResolvingFailure(false) }
  }

  const reauthenticate = async () => {
    setSigningOut(true); setSignOutError(undefined)
    try { await auth.signOut() }
    catch (error) { setSignOutError(error instanceof Error ? error.message : 'Could not start sign-in again'); setSigningOut(false) }
  }

  const syncLabel = store.authStopped ? 'SIGN IN AGAIN' : store.failed > 0 ? `${store.failed} NOT SENT` : store.offline ? `${store.pending} QUEUED` : 'SYNCED'
  const failedActionLabel = FAILED_ACTION[store.lastFailureKind ?? ''] ?? 'Write'
  const syncCopy = store.authStopped
    ? `${store.pending} retained action${store.pending === 1 ? '' : 's'} · renew this session to retry`
    : store.failed > 0
      ? `${failedActionLabel} needs attention`
      : store.offline ? 'Saved on this device · will post when the network returns' : `Last sync ${asOf.data?.label ?? '—'} · all movements posted`

  const renderItem = (item: MoreItem) => {
    const Icon = item.icon
    return <button className="more-row" key={item.label} onClick={() => void navigate({ to: item.go })}>
      <Icon className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" />
      <span className="more-row-main"><span className="more-row-label">{item.label}</span><span className="more-row-sub">{item.sub}</span></span>
      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  }

  return <div className="section-screen">
    <header className="section-head"><h1 className="section-head-title">More</h1></header>
    <div className="section-body more-body more-index-body">
      <div className="more-profile">
        <span className="settings-avatar" aria-hidden="true">{initials(personName)}</span>
        <span className="settings-identity-copy"><strong>{personName}</strong><small>{store.role.toUpperCase()}</small></span>
      </div>

      {operations.length > 0 && <section className="settings-group"><h2>OPERATIONS</h2><div className="more-list settings-list">{operations.map(renderItem)}</div></section>}

      {canManageTeam && <section className="settings-group"><h2>TEAM ACCESS</h2><div className="more-list settings-list">
        {canInvite && <button className="more-row" onClick={() => void navigate({ to: '/settings/invite' })}><UserPlus className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">INVITE CREW</span><span className="more-row-sub">Invite by email · assign role and location</span></span><ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>}
        <button className="more-row" onClick={() => void navigate({ to: '/team' })}><Users className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">TEAM MEMBERS</span><span className="more-row-sub">Review roles and locations</span></span><ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>
      </div></section>}

      <section className="settings-group"><h2>DEVICE &amp; CONTINUITY</h2><div className="more-list settings-list">
        <div className={`more-row settings-status-row ${store.authStopped || store.failed > 0 ? 'has-failure' : ''}`}><RefreshCw className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">SYNC STATE</span><span className="more-row-sub">{syncCopy}</span>{store.failed > 0 && <span className="settings-status-note">Retained on this device</span>}</span><span className={`sync-card-badge ${store.authStopped || store.failed > 0 ? 'failed' : store.offline ? 'offline' : ''}`}>{syncLabel}{!store.authStopped && store.failed === 0 && !store.offline ? <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" /> : null}</span></div>
        {(store.failed > 0 || store.authStopped) && <div className="settings-status-action"><button className="flow-cta-ghost" onClick={() => void (store.authStopped ? reauthenticate() : resolveFailure())} disabled={signingOut || resolvingFailure}>{store.authStopped ? 'Sign in again to retry' : resolvingFailure ? 'Resolving…' : 'Resolve failed action'}</button></div>}
        <button className="more-row" onClick={() => void navigate({ to: '/print' })}><FileText className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">PAPER FALLBACK</span><span className="more-row-sub">Print count sheets &amp; a blank docket</span></span><ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>
      </div></section>

      <section className="settings-group"><h2>ACCOUNT</h2><div className="more-list settings-list">
        <button className="more-row" onClick={() => void navigate({ to: '/settings/password' })}><LockKeyhole className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">CHANGE PASSWORD</span><span className="more-row-sub">Update your account password</span></span><ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>
        <button className="more-row settings-signout-row" onClick={() => setConfirmSignOut(true)}><LogOut className="more-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><span className="more-row-main"><span className="more-row-label">SIGN OUT</span><span className="more-row-sub">Sign out of BOA Bar Control</span></span><ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>
      </div></section>

      {signOutError ? <p className="flow-error" role="alert">NOT SIGNED OUT · {signOutError}</p> : null}
      {/* BAR-182. danger: this wipes the cache and any count in progress off a phone that is passed between crew, and the counted lines are not recoverable from the server. */}
      {confirmSignOut && <ConfirmDialog title="Sign out of BOA?" tone="danger" confirmLabel="Sign out" cancelLabel="Keep me signed in" onCancel={() => setConfirmSignOut(false)} onConfirm={() => void signOut()} busy={signingOut}><p>Cached SKU data and any count in progress will be cleared from this device. Queued work will be kept.</p></ConfirmDialog>}
    </div>
  </div>
}

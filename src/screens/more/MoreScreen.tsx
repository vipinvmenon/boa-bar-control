/**
 * BAR-104 / BAR-165 — the More screen.
 *
 * The design's version (references/ui/more.png, `moreItems` in design-script.jsx)
 * is six rows: CONTROL, COUNTS, VARIANCE, REPORTS, COWORK, SETTINGS. Four of
 * those six destinations do not exist in V1, which the design could not have
 * known, and the first implementation rendered them anyway — CONTROL swallowing
 * its tap in silence, REPORTS dead-ending non-managers, VARIANCE and TEAM
 * answering with a toast.
 *
 * The rule since BAR-165: **a row is rendered only if it navigates somewhere
 * real, for the person holding the phone.** Two more corrections on review:
 *
 *   - COUNTS pointed at `/count`, which resolves its location from the
 *     membership. A manager holds none, so it was changed to `/bars` — which is
 *     the BARS tab in the navigation two inches below, so the row did nothing a
 *     tap on BARS did not already do. It is now offered only to somebody whose
 *     membership carries a location, where it opens *their* count sheet directly
 *     and is a genuine shortcut.
 *   - IN CUSTODY was reachable only from a home alert, which exists only while
 *     a docket is awaiting acceptance. Stock that has left the warehouse and not
 *     arrived is the case specification §5 exists to resolve; it needs a
 *     permanent way in.
 *
 * What remains is a menu of what the bottom navigation cannot reach. Approved
 * deviation from the design — see docs/DECISIONS.md ADR-015.
 */
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../../lib/app-store'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

type MoreItem = {
  label: string
  sub: string
  go: string
  /** Manager, admin or auditor only. */
  managerOnly?: boolean
  /** Only for a membership posted to a location — it resolves one. */
  needsLocation?: boolean
}

const ITEMS: MoreItem[] = [
  {
    label: 'IN CUSTODY',
    sub: 'Dockets issued and not yet accepted · what is in transit',
    go: '/dockets',
  },
  {
    label: 'COUNTS',
    sub: 'Open a blind count for your location',
    go: '/count',
    needsLocation: true,
  },
  {
    label: 'VARIANCE',
    sub: 'Counted vs theoretical · tolerance bands',
    go: '/variance',
    managerOnly: true,
  },
  {
    label: 'TEAM',
    sub: 'Invite staff · manage venue access',
    go: '/team',
    managerOnly: true,
  },
  {
    label: 'SETTINGS',
    sub: 'Signed-in person · device · sync · printed fallback sheets',
    go: '/settings',
  },
]

export function MoreScreen() {
  const store = useAppStore()
  const navigate = useNavigate()
  const offline = store.offline
  const session = useRepositoryQuery(['session'], (r) => r.session())

  const isManager = store.role === 'Manager'
  const items = ITEMS.filter((item) => (
    (!item.managerOnly || isManager) && (!item.needsLocation || Boolean(store.activeLocationId))
  ))

  return (
    <div className="section-screen">
      <header className="section-head">
        <h1 className="section-head-title">More</h1>
        <span className="more-role">{store.role.toUpperCase()}</span>
      </header>

      <div className="section-body more-body">
        <div className="more-list">
          {items.map((item) => (
            <button className="more-row" key={item.label} onClick={() => void navigate({ to: item.go })}>
              <div>
                <span className="more-row-label">{item.label}</span>
                <span className="more-row-sub">{item.sub}</span>
              </div>
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/*
          BAR-165. One row at the foot, not two.

          Who the phone is signed in as and whether its work has been sent were
          two rows that opened the same screen — a duplicate destination, and the
          identity sat above a menu it is not part of. It is now a single row at
          the bottom, where an account belongs, carrying the queue's state as a
          badge rather than as a second tap.

          The badge is not a control. Specification §10 requires the app to say
          whether work is saved, and a bar lead has to be able to read that
          without opening anything.
        */}
        <button className="more-identity" onClick={() => void navigate({ to: '/settings' })}>
          <span className="more-identity-label">SIGNED IN</span>
          <strong>{session.data?.signedInName ?? '—'}</strong>
          <small>{store.activeVenueName ?? 'BOA 2026'}</small>
          <span className="more-identity-right">
            <span className={`sync-card-badge ${store.authStopped || store.failed > 0 ? 'failed' : offline ? 'offline' : ''}`}>
              {store.authStopped
                ? '! SIGN IN AGAIN'
                : store.failed > 0
                ? `! ${store.failed} NOT SENT`
                : offline
                  ? `○ OFFLINE · ${store.pending} QUEUED`
                  : '✓ SYNCED'}
            </span>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>

        <p className="more-build">BOA BAR INVENTORY · BUILD {import.meta.env.VITE_RELEASE || 'dev'} · BOA 2026</p>
      </div>
    </div>
  )
}

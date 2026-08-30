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
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../../lib/app-store'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

type MoreItem = {
  label: string
  sub: string
  managerOnly?: boolean
  go?: string
  todo?: string
}

// design-script.jsx `moreItems`, in the design's order.
const ITEMS: MoreItem[] = [
  { label: 'CONTROL', sub: 'Live board · run-out projections · open dockets', managerOnly: true, todo: 'CONTROL BOARD IS BAR-100' },
  { label: 'COUNTS', sub: 'Opening · mid-event · close-out, per location', go: '/count' },
  { label: 'VARIANCE', sub: 'Counted vs theoretical · tolerance bands', managerOnly: true, todo: 'VARIANCE SCREEN IS BAR-086' },
  { label: 'REPORTS', sub: 'Excise return · stock settlement · sales per hour', go: '/reports' },
  { label: 'COWORK', sub: 'Inventory assistant', todo: 'COWORK IS BAR-103' },
  { label: 'SETTINGS', sub: 'Device · sync · printed fallback sheets', todo: 'SETTINGS' },
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
  const navigate = useNavigate()
  const offline = store.offline
  const session = useRepositoryQuery(['session'], (r) => r.session())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  const activate = (item: MoreItem) => {
    if (item.managerOnly && store.role !== 'Manager') {
      store.flash('MANAGER ACCESS REQUIRED')
      return
    }
    if (item.go) {
      void navigate({ to: item.go })
      return
    }
    store.flash(item.todo ?? item.label)
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
            <button className="more-row" key={item.label} onClick={() => activate(item)}>
              <div>
                <span className="more-row-label">{item.label}</span>
                <span className="more-row-sub">{item.sub}</span>
              </div>
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>

        <section className="sync-card">
          <div className="sync-card-top">
            <span className="sync-card-eyebrow">SYNC STATE</span>
            <span className={`sync-card-badge ${store.failed > 0 ? 'failed' : offline ? 'offline' : ''}`}>
              {store.failed > 0
                ? `! ${store.failed} NOT SENT`
                : offline
                  ? '○ OFFLINE'
                  : '✓ SYNCED'}
            </span>
          </div>
          <p className="sync-card-copy">
            {store.failed > 0
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
        </section>

        <p className="more-build">BOA BAR INVENTORY · BUILD 0.4 · BOA 2026</p>
      </div>
    </div>
  )
}

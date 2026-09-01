/**
 * BAR-061 — the bar workspace.
 *
 * Specification §14: "the bar screen is the one that has to be excellent,
 * because it is used by temporary staff, one-handed, in the dark, at speed. Big
 * targets, no free text where a picker will do, and never more than three taps
 * to record a waste."
 *
 * Every value traced to the `isBar` branch of
 * references/design-source/design-markup.html:220-300. Compare against
 * references/ui/bar.png.
 *
 * This screen did not exist in any form. Bar crew had no home: nowhere to accept
 * a docket, nowhere to request a top-up.
 *
 * Note the design's own label on the inventory list: "DERIVED FROM LEDGER". The
 * design states the core rule on the screen itself.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowUp, ChevronLeft, ClipboardList, Trash2 } from 'lucide-react'
import { useRepository, useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { requestTopUp, type RequestTopUpInput } from '../../services/top-up'

export function BarScreen() {
  const { barId } = useParams({ from: '/bars/$barId' })
  const navigate = useNavigate()
  const store = useAppStore()
  const isDemo = useRepository().kind !== 'live'
  const bar = useRepositoryQuery(['bar', barId], (r) => r.barDetail(barId))
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal')
  const [note, setNote] = useState('')
  const [topUpActionId, setTopUpActionId] = useState(() => crypto.randomUUID())
  const topUpRef = useRef<HTMLElement>(null)
  const topUpProductRef = useRef<HTMLSelectElement>(null)
  const topUp = useRepositoryMutation((repository, input: Omit<RequestTopUpInput, 'repository'>) => (
    requestTopUp({ repository, ...input })
  ))

  /**
   * BAR-165. The panel opens below the action row, which on a 390×844 phone is
   * off-screen — its CTA sat behind the bottom navigation and the request could
   * not be completed without the person guessing to scroll. Bring it into view
   * and put the focus where the first decision is.
   */
  useEffect(() => {
    if (!topUpOpen) return
    /*
     * The panel opens below the action row, which on a 390×844 phone puts its
     * CTA behind the bottom navigation. A request form whose submit button is
     * invisible is the defect this exists to fix.
     *
     * The scroll is computed and assigned rather than delegated to
     * `scrollIntoView`, which was tried first and observed to leave the
     * container at scrollTop 0 — silently, since it cannot report failure.
     * `behavior: 'smooth'` was worse: a no-op in at least one engine. Arithmetic
     * on offsetTop has no such failure mode, and instant is right anyway: the
     * person tapped a button and needs the form now.
     *
     * A timeout rather than `requestAnimationFrame`: rAF does not fire at all
     * while the tab is not being painted — a backgrounded tab, or a phone whose
     * screen went off mid-request — so the scroll would silently never happen and
     * the form would be back to opening off-screen. Verified: under a hidden
     * pane the rAF version left the container at scrollTop 0.
     */
    const frame = window.setTimeout(() => {
      const panel = topUpRef.current
      const scroller = panel?.parentElement
      if (panel && scroller) {
        const overshoot = panel.offsetTop + panel.offsetHeight - scroller.clientHeight
        if (overshoot > 0) scroller.scrollTop = Math.min(overshoot + 12, scroller.scrollHeight)
      }
      topUpProductRef.current?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(frame)
  }, [topUpOpen])

  if (bar.isPending) {
    return (
      <div className="section-screen">
        <div className="section-body">
          <ScreenSkeleton variant="bar" />
        </div>
      </div>
    )
  }

  const detail = bar.data
  if (!detail) {
    return (
      <div className="section-screen">
        <header className="section-head">
          <h1 className="section-head-title">Bar</h1>
        </header>
        <div className="section-body">
          <p className="section-empty">
            No detail is available for this bar yet. The design's fixture set details Bar 3.
          </p>
        </div>
      </div>
    )
  }

  /**
   * BAR-165. This pill read LIVE unconditionally — in demo mode, and with the
   * device offline. An indicator that cannot be false is worse than no
   * indicator, because staff read it and believe it. Same three states the
   * shell's own sync line reports, from the same sources.
   */
  const status = isDemo
    ? { label: 'DEMO', tone: 'is-demo', dot: 'red' }
    : store.offline
      ? { label: 'OFFLINE', tone: 'is-offline', dot: 'gold' }
      : { label: 'LIVE', tone: '', dot: '' }

  return (
    <div className="section-screen">
      <header className="bar-head">
        <div className="bar-head-top">
          <button className="bar-head-back" onClick={() => void navigate({ to: '/bars' })} aria-label="Back to bars">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="bar-head-ident">
            <div className="bar-head-line">
              <span className="bar-head-name">{detail.name}</span>
              <span className={`bar-head-live ${status.tone}`}>
                <i className={`status-dot ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <p className="bar-head-meta">
              Manager: {detail.managerName} · as of {detail.asOf.label}
            </p>
          </div>
        </div>

        {/*
          BAR-165. Rendered only when there is something to render. The grid
          draws its dividers as a 1px gap with the container colour showing
          through, so with no cells it collapsed to a 2px rule under the header —
          a stray line nobody could account for, on every bar with no accepted
          stock yet.
        */}
        {detail.categoryTotals.length > 0 && (
          <div className="bar-head-grid">
            {detail.categoryTotals.map((total) => (
              <div className="bar-head-cell" key={total.label}>
                <span>{total.label}</span>
                <strong>{total.containers}</strong>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="section-body bar-body">
        {/*
          BAR-146. Every docket awaiting acceptance here, each with a working CTA.
          Two defects lived in the previous nine lines: only the FIRST docket was
          rendered, so a second issued to this bar could never be opened; and the
          CTA flashed "RECEIVING SCREEN IS BAR-055" — a placeholder left behind
          after BAR-055 shipped, which meant **no path in the app reached the
          accept screen at all**. It was only reachable by typing a URL.
        */}
        {detail.incoming.map((docket) => (
          <section className="incoming-sheet" key={docket.docketNo}>
            <div className="incoming-top">
              <span className="incoming-eyebrow">INCOMING STOCK</span>
              <span className="incoming-age">{docket.ageLabel}</span>
            </div>
            <p className="incoming-summary">{docket.summary}</p>
            <p className="incoming-route">
              Docket {docket.docketNo} · {docket.fromName} → {docket.toName}
            </p>
            <button
              className="incoming-cta"
              onClick={() => void navigate({
                to: '/dockets/$docketId/accept',
                params: { docketId: docket.docketNo },
              })}
            >
              Review &amp; accept
            </button>
          </section>
        ))}

        <div className="bar-actions">
          <button onClick={() => {
            setSkuId(detail.inventory[0]?.skuId ?? '')
            setTopUpActionId(crypto.randomUUID())
            setTopUpOpen(true)
          }}>
            <ArrowUp size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>TOP-UP</span>
          </button>
          <button onClick={() => void navigate({
            to: '/bars/$barId/waste',
            params: { barId },
          })}>
            <Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>WASTE</span>
          </button>
          <button onClick={() => void navigate({
            to: '/bars/$barId/count',
            params: { barId },
          })}>
            <ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>COUNT</span>
          </button>
        </div>

        {/*
          BAR-165. `.panel` deliberately carries no padding — every other user of
          it pairs it with its own padding rule, and `.top-up-panel` had no rule
          in the stylesheet at all. So the request form rendered with zero
          padding and zero row gap: the section title collided with the first
          field label, and the CTA row ran off the bottom of the sheet.
        */}
        {topUpOpen && (
          <section className="panel top-up-panel" ref={topUpRef}>
            <span className="top-up-title">REQUEST TOP-UP</span>

            <label className="field">
              <span className="issue-label">PRODUCT</span>
              <select ref={topUpProductRef} value={skuId} onChange={(event) => setSkuId(event.target.value)}>
                {detail.inventory.map((line) => (
                  <option key={line.skuId} value={line.skuId}>{line.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="issue-label">CONTAINERS</span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>

            <div className="field">
              <span className="issue-label">URGENCY</span>
              <div className="issue-unit-tabs">
                <button
                  className={urgency === 'normal' ? 'active' : ''}
                  onClick={() => setUrgency('normal')}
                >
                  NORMAL
                </button>
                <button
                  className={urgency === 'urgent' ? 'active' : ''}
                  onClick={() => setUrgency('urgent')}
                >
                  URGENT
                </button>
              </div>
            </div>

            <label className="field">
              <span className="issue-label">NOTE</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
              />
            </label>

            {topUp.isError && (
              <p className="flow-error" role="alert">NOT REQUESTED · {topUp.error.message}</p>
            )}

            <button
              className="flow-cta"
              disabled={!skuId || topUp.isPending}
              onClick={() => topUp.mutate(
                {
                  actionId: topUpActionId,
                  locationId: barId,
                  skuId,
                  requestedContainers: quantity,
                  urgency,
                  note: note.trim() || undefined,
                },
                {
                  onSuccess: (result) => {
                    setTopUpOpen(false)
                    setNote('')
                    store.flash(result.status === 'queued' ? 'TOP-UP QUEUED' : 'TOP-UP REQUESTED')
                  },
                },
              )}
            >
              {topUp.isPending ? 'Requesting…' : 'Request stock'}
            </button>
            <button className="flow-cta-ghost" onClick={() => setTopUpOpen(false)}>Cancel</button>
          </section>
        )}

        <div className="bar-inv-head">
          <span className="bar-inv-title">BAR INVENTORY</span>
          <span className="bar-inv-note">DERIVED FROM LEDGER</span>
        </div>

        {/*
          BAR-165. An empty list rendered as a second stray hairline, because the
          container carries the border and the rows carry the fill. A bar with
          nothing accepted yet is a normal state on the night and has to say so.
        */}
        {detail.inventory.length === 0 ? (
          <p className="section-empty">
            No stock has been accepted at this bar yet. Accept a docket, and the position appears
            here as the ledger records it.
          </p>
        ) : (
          <div className="bar-inv-list">
            {detail.inventory.map((line) => (
              <div className="bar-inv-row" key={line.skuId}>
                <div className="bar-inv-main">
                  <strong>{line.name}</strong>
                  <span>{line.movementSummary}</span>
                </div>
                <div className="bar-inv-qty">
                  <strong className={`tone-${line.tone}`}>{line.quantity}</strong>
                  <span>{line.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

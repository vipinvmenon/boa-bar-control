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
import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowUp, ChevronLeft, ClipboardList, Trash2 } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'
import { useRepositoryMutation } from '../../data/RepositoryProvider'
import { requestTopUp, type RequestTopUpInput } from '../../services/top-up'

export function BarScreen() {
  const { barId } = useParams({ from: '/bars/$barId' })
  const navigate = useNavigate()
  const store = useAppStore()
  const bar = useRepositoryQuery(['bar', barId], (r) => r.barDetail(barId))
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal')
  const [note, setNote] = useState('')
  const [topUpActionId, setTopUpActionId] = useState(() => crypto.randomUUID())
  const topUp = useRepositoryMutation((repository, input: Omit<RequestTopUpInput, 'repository'>) => (
    requestTopUp({ repository, ...input })
  ))

  if (bar.isPending) {
    return (
      <div className="section-screen">
        <div className="section-body">
          <p className="section-empty">Loading bar…</p>
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
              <span className="bar-head-live">
                <i className="status-dot" />
                LIVE
              </span>
            </div>
            <p className="bar-head-meta">
              Manager: {detail.managerName} · as of {detail.asOf.label}
            </p>
          </div>
        </div>

        <div className="bar-head-grid">
          {detail.categoryTotals.map((total) => (
            <div className="bar-head-cell" key={total.label}>
              <span>{total.label}</span>
              <strong>{total.containers}</strong>
            </div>
          ))}
        </div>
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

        {topUpOpen ? <section className="panel top-up-panel">
          <span className="issue-label">REQUEST TOP-UP</span>
          <label className="field"><span className="issue-label">PRODUCT</span><select value={skuId} onChange={(e) => setSkuId(e.target.value)}>{detail.inventory.map((line) => <option key={line.skuId} value={line.skuId}>{line.name}</option>)}</select></label>
          <label className="field"><span className="issue-label">CONTAINERS</span><input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} /></label>
          <div className="team-roles"><button className={urgency === 'normal' ? 'active' : ''} onClick={() => setUrgency('normal')}>NORMAL</button><button className={urgency === 'urgent' ? 'active' : ''} onClick={() => setUrgency('urgent')}>URGENT</button></div>
          <label className="field"><span className="issue-label">NOTE</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" /></label>
          <div className="wh-actions"><button onClick={() => setTopUpOpen(false)}>Cancel</button><button className="primary" disabled={!skuId || topUp.isPending} onClick={() => topUp.mutate({ actionId: topUpActionId, locationId: barId, skuId, requestedContainers: quantity, urgency, note: note.trim() || undefined }, { onSuccess: (result) => { setTopUpOpen(false); store.flash(result.status === 'queued' ? 'TOP-UP QUEUED' : 'TOP-UP REQUESTED') } })}>Request stock</button></div>
          {topUp.isError ? <p className="flow-error" role="alert">NOT REQUESTED · {topUp.error.message}</p> : null}
        </section> : null}

        <div className="bar-inv-head">
          <span className="bar-inv-title">BAR INVENTORY</span>
          <span className="bar-inv-note">DERIVED FROM LEDGER</span>
        </div>

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
      </div>
    </div>
  )
}

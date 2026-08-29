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
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowUp, ChevronLeft, ClipboardList, Trash2 } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'

export function BarScreen() {
  const { barId } = useParams({ from: '/bars/$barId' })
  const navigate = useNavigate()
  const store = useAppStore()
  const bar = useRepositoryQuery(['bar', barId], (r) => r.barDetail(barId))

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
          <button onClick={() => store.flash('TOP-UP REQUEST IS BAR-064')}>
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

        <div className="bar-inv-head">
          <span className="bar-inv-title">BAR INVENTORY</span>
          <span className="bar-inv-note">DERIVED FROM LEDGER</span>
        </div>

        <div className="bar-inv-list">
          {detail.inventory.map((line) => (
            <button className="bar-inv-row" key={line.skuId} onClick={() => store.flash('SKU LEDGER IS BAR-050')}>
              <div className="bar-inv-main">
                <strong>{line.name}</strong>
                <span>{line.movementSummary}</span>
              </div>
              <div className="bar-inv-qty">
                <strong className={`tone-${line.tone}`}>{line.quantity}</strong>
                <span>{line.unit}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

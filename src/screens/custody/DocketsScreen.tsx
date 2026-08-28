/**
 * BAR-146 / BAR-136 — dockets awaiting acceptance, and what is sitting in transit.
 *
 * **This screen is not in the approved design**, and that is deliberate rather
 * than an oversight. The design's mechanism for reaching a docket is the QR code
 * on the `docket` screen, scanned by the receiving device — and the scanner was
 * never built (BAR-136). Without either one, a docket could only be reached by
 * typing a URL, so a second docket issued to the same bar was unreachable and its
 * stock sat in `in_transit` where nothing displayed it.
 *
 * A list was chosen over building the scanner because it is smaller, and because
 * it does not depend on a camera focusing in a dark tent at 23:00. When the
 * scanner lands this screen stays useful as the fallback and as the manager's view
 * of what is outstanding.
 *
 * It is built in the design system's own vocabulary — section head, panel rows,
 * the sage-alpha scale, Oswald caps — rather than inventing a new visual
 * language for it.
 */
import { useNavigate } from '@tanstack/react-router'
import { PackageCheck, TriangleAlert } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

export function DocketsScreen() {
  const navigate = useNavigate()
  const overview = useRepositoryQuery(['custodyOverview'], (r) => r.custodyOverview())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  const data = overview.data

  return (
    <div className="section-screen">
      <header className="section-head">
        <h1 className="section-head-title">In custody</h1>
        <span className="section-head-asof">AS OF {asOf.data?.label ?? '—'}</span>
      </header>

      <div className="section-body">
        {/*
          The figure that did not exist anywhere before. Stock in `in_transit` has
          left the warehouse and has not been accepted, so it appears in no bar's
          position and in no warehouse total — invisible, while the ledger says it
          exists. A number nobody can see is indistinguishable from stock that has
          gone missing.
        */}
        <section className="transit-card">
          <span className="transit-label">IN TRANSIT</span>
          <strong className="transit-figure">{data?.inTransitContainers ?? '—'}</strong>
          <span className="transit-unit">CONTAINERS</span>
          <p className="transit-note">
            Issued and not yet accepted. This stock is in nobody's position until a receiving lead
            accepts its docket.
          </p>
        </section>

        <div className="section-label">
          AWAITING ACCEPTANCE
          {data ? <span>{data.dockets.length}</span> : null}
        </div>

        {data && data.dockets.length === 0 ? (
          <p className="section-empty">
            <PackageCheck size={16} strokeWidth={1.8} aria-hidden="true" /> Nothing outstanding. Every
            docket issued has been accepted.
          </p>
        ) : null}

        {data?.dockets.map((docket) => (
          <button
            key={docket.docketNo}
            className={`docket-row ${docket.overdue ? 'is-overdue' : ''}`}
            onClick={() => void navigate({
              to: '/dockets/$docketId/accept',
              params: { docketId: docket.docketNo },
            })}
          >
            <span className="docket-row-top">
              <strong>{docket.docketNo}</strong>
              <span className={docket.overdue ? 'docket-age-overdue' : 'docket-age'}>
                {docket.overdue ? <TriangleAlert size={12} strokeWidth={2} aria-hidden="true" /> : null}
                {docket.ageLabel}
              </span>
            </span>
            <span className="docket-row-summary">{docket.summary}</span>
            <span className="docket-row-route">
              {docket.fromName} → {docket.toName}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * BAR-107 — the reports route, honest until the ledger views exist.
 *
 * The designed `reports` and `rep` screens are cut from Release 1: they render
 * the excise return, the stock settlement and sales per hour, and every one of
 * those needs a view that does not exist yet (BAR-105, BAR-106, BAR-111). The
 * route existed before as an invented variance page carrying a fabricated
 * `−2.1%`, `₹18.4K` and `94%` — the specific defect BAR-152 removed and that this
 * screen must never reintroduce. No figure appears here.
 *
 * BAR-165 fixed the composition. This route was the last screen in the app still
 * built from the retired legacy vocabulary — `.screen` + `.eyebrow` + an Anton
 * `<h1>` — with no header bar and no back, so arriving here felt like leaving the
 * app. It also carried a client-side manager gate that dead-ended crew who
 * deep-linked to it: there is nothing to protect while there is nothing to show,
 * and settlement figures are protected in the database, not in a React branch
 * (non-negotiable 7).
 */
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

export function ReportsScreen() {
  const navigate = useNavigate()

  return (
    <div className="section-screen">
      <header className="section-head">
        <div className="count-head-left">
          <button className="flow-back" onClick={() => void navigate({ to: '/more' })} aria-label="Back to more">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="section-head-title">Reports</h1>
        </div>
        <span className="section-head-asof">NOT IN V1</span>
      </header>

      <div className="section-body more-body">
        <div className="advisory advisory-gold">
          <div>
            <strong>No report is available yet.</strong>
            <p>
              The excise return, the stock settlement and sales per hour are all derived from the
              movement ledger, and the views they read do not exist yet. Nothing is estimated here in
              their place.
            </p>
          </div>
        </div>

        <section className="method-note panel">
          <strong>What the ledger already supports</strong>
          <span>
            Variance against a sealed count is available now, per location, on the variance screen.
            Every movement is on the activity feed. The paper fallback pack prints from the same
            catalogue.
          </span>
        </section>

        <section className="method-note panel">
          <strong>How variance is calculated</strong>
          <span>
            Counted closing − (opening + in − out − sold − comped − wasted), divided by
            sold + comped + wasted. Banding is signed: a positive variance is reviewed the same as a
            negative one and is never graded green.
          </span>
        </section>
      </div>
    </div>
  )
}

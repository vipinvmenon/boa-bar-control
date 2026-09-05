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
 *
 * BAR-183 — this stopped being a destination and became a signpost.
 *
 * The brief for this task assumed the route was reachable from navigation and
 * asked for it to be removed from there. It is not, and never has been: grepping
 * the whole of `src/` for `/reports` finds it in `app/router.tsx` and in
 * `scripts/visual-check.mjs`, and nowhere else. It is not in `BottomNav`'s five
 * items and not in any of MoreScreen's four groups. So there was no navigation
 * entry to delete, and MoreScreen is deliberately left alone — adding a row so
 * that it could be removed again would be the wrong direction of travel.
 *
 * What was actually wrong is that the screen spent three paragraphs and two
 * panels explaining its own absence, which is the most content any screen in the
 * app gives to saying nothing. Two of those paragraphs were also in the wrong
 * place: "how variance is calculated" is documentation for a screen that exists,
 * and it belongs on that screen, not on the one standing in for it.
 *
 * So this is now one sentence and the way to the screen that answers the
 * question today. A bookmark still lands somewhere honest, `test:visual` still
 * resolves `reports`, and nobody reads an essay to be told to go elsewhere. When
 * BAR-105/106/111 land, the reports go here and this file gets its screen.
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
              The excise return, the stock settlement and sales per hour all read ledger views that
              do not exist yet; variance against a sealed count is the question the ledger can answer
              today.
            </p>
          </div>
        </div>

        {/*
          No client-side role check on the way out: VarianceScreen has none
          either, and what an auditor or crew member may read is decided by RLS
          (non-negotiable 7). Gating here would only recreate the dead end
          BAR-165 removed from this same screen.
        */}
        <button className="flow-cta-ghost" onClick={() => void navigate({ to: '/variance' })}>
          Go to variance
        </button>
      </div>
    </div>
  )
}

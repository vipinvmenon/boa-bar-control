/**
 * The last remnant of the legacy screen regime.
 *
 * This file once held four screens in 302 lines standing in for twenty-two, full
 * of hardcoded fixtures and reading `demo-store` for SKU data. `issue` (BAR-051),
 * `waste` (BAR-063), `count` (BAR-079) and `docket` (BAR-054) have all been
 * rebuilt as their own screens reading the repository, so only `reports` remains.
 *
 * `reports` is a deliberate honest empty state, not a rebuild: the design's
 * `reports` and `rep` screens are BAR-107 and BAR-108, and both need the ledger
 * views that do not exist yet. It is counted as "legitimately static" by the
 * fidelity gate for that reason.
 *
 * When BAR-107 lands, this file goes with it (BAR-164).
 */
import { ShieldCheck } from 'lucide-react'
import { Panel } from '../components/ui'
import { useDemoStore } from '../lib/demo-store'

export function ReportsScreen() {
  const store = useDemoStore()

  if (store.role !== 'Manager') {
    return (
      <div className="screen">
        <p className="eyebrow">Restricted</p>
        <h1>Reports</h1>
        <Panel className="blind-banner">
          <ShieldCheck />
          <div>
            <strong>Manager access required</strong>
            <span>Settlement and currency values are protected.</span>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="screen">
      <p className="eyebrow">Manager settlement</p>
      <h1>Variance</h1>
      {/*
        BAR-152. This screen previously displayed −2.1% overall, ₹18.4K at risk,
        94% mapped POS, and four category variances — none of which any code
        computed, and none of which appear in the approved design. An empty state
        is honest; an invented figure a manager might defend to STOK or excise is
        not.
      */}
      <Panel className="method-note">
        <strong>Not yet available</strong>
        <span>
          Variance is derived from the movement ledger and cannot be computed until the ledger
          views exist (BAR-014). No figure is shown here rather than an estimated one.
        </span>
      </Panel>
      <Panel className="method-note">
        <strong>How variance will be calculated</strong>
        <span>
          Counted closing − (opening + in − out − sold − comped − wasted), divided by
          sold + comped + wasted. Banding is signed: positive variance is reviewed, never graded
          green.
        </span>
      </Panel>
    </div>
  )
}

/**
 * BAR-164. Honest Release 1 placeholder for the reports route.
 *
 * The designed reports and report-detail screens are deliberately cut from
 * Release 1 until the ledger/reporting work lands. Keeping this route separate
 * from the retired legacy screen module prevents the old path from returning.
 */
import { ShieldCheck } from 'lucide-react'
import { Panel } from '../../components/ui'
import { useAppStore } from '../../lib/app-store'

export function ReportsScreen() {
  const store = useAppStore()

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

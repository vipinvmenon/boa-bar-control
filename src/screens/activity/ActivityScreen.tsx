/**
 * BAR-089 — activity, rebuilt to the approved design.
 *
 * Every value traced to the `isActivity` branch of
 * references/design-source/design-markup.html:888-921. Compare against
 * references/ui/activity.png.
 *
 * What the previous implementation got structurally wrong:
 *   - three filters (All / Transfers / Waste), so the design's Counts and
 *     Adjustments groups were unreachable — and the adjustment log is the report
 *     spec §4 says to read first the next morning
 *   - a dotted timeline with a left rail, where the design uses edge-to-edge
 *     rows with a coloured kind-bar
 *   - uppercase titles ('WASTE RECORDED') where the design is sentence case
 *   - no AUDIT badge and no tinted row on the adjustment
 *   - rows that were not tappable, so the movement detail screen had no entry
 *
 * No literal here: entries, groups and tones come from the repository.
 */
import { useState } from 'react'
import { ACTIVITY_GROUPS, type ActivityGroup } from '../../data/repository'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'

export function ActivityScreen() {
  const [group, setGroup] = useState<ActivityGroup>('All')
  const store = useAppStore()
  const entries = useRepositoryQuery(['ledger', group], (r) => r.ledger(group))
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  return (
    <div className="section-screen">
      <header className="activity-head">
        <div className="activity-head-row">
          <h1 className="section-head-title">Activity</h1>
          <span className="section-head-asof">AS OF {asOf.data?.label ?? '—'}</span>
        </div>
        <div className="activity-filters" aria-label="Movement group">
          {ACTIVITY_GROUPS.map((option) => (
            <button
              key={option}
              className={option === group ? 'active' : ''}
              onClick={() => setGroup(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <div className="activity-list">
        {entries.isPending ? <p className="section-empty">Loading movements…</p> : null}
        {entries.data?.length === 0 ? (
          <p className="section-empty">No {group.toLowerCase()} recorded yet.</p>
        ) : null}
        {entries.data?.map((entry) => (
          <button
            key={entry.id}
            className={`activity-row ${entry.flagged ? 'flagged' : ''}`}
            onClick={() =>
              // BAR-090 builds the movement detail screen. Say so rather than
              // leaving the row inert, which is what it was before.
              store.flash(`MOVEMENT DETAIL IS BAR-090 · ${entry.id.toUpperCase()}`)
            }
          >
            <time>{entry.at}</time>
            <div className={`activity-row-body tone-${entry.tone}`}>
              <div className="activity-row-title">
                <strong>{entry.title}</strong>
                {entry.flagged ? <span className="activity-audit">AUDIT</span> : null}
              </div>
              <p className="activity-row-detail">{entry.detail}</p>
              <small className="activity-row-who">{entry.who}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

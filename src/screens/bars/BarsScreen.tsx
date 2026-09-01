/**
 * BAR-062 — the bars screen, rebuilt to the approved design.
 *
 * Every value traced to the `isBars` branch of
 * references/design-source/design-markup.html. Compare against
 * references/ui/bars.png.
 *
 * What the previous implementation had that the design does not, all removed:
 *   - a 'LIVE FLOOR' eyebrow
 *   - three decorative green progress bars per card
 *   - sentence-case status ('Healthy' for 'HEALTHY')
 *   - the quantity in Anton at 30px, where the design uses Oswald 600 at 17px
 *   - inline RECORD WASTE / BLIND COUNT buttons on Bar 3 only
 *
 * What the design has that it dropped, all restored: the 'AS OF' stamp, the
 * header rule, the lead name and count time, the gold flag, the divider inside
 * each card, and cards that are actually tappable.
 *
 * No literal in this file. Bar names, quantities, leads and flags all come from
 * the repository (ADR-010).
 */
import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import type { BarSummary, Tone } from '../../data/repository'

function toneClass(tone: Tone): string {
  return `tone-${tone}`
}

function BarCard({ bar, onOpen }: { bar: BarSummary; onOpen: (bar: BarSummary) => void }) {
  return (
    <button className="bar-row-card" onClick={() => onOpen(bar)}>
      <div className="bar-row-head">
        <div className="bar-row-ident">
          <span className="bar-row-name">{bar.name}</span>
          <span className={`bar-row-status ${toneClass(bar.tone)}`}>
            <i className="bar-row-dot" />
            {bar.status}
          </span>
        </div>
        <span className="bar-row-qty">{bar.containers}</span>
      </div>
      <div className="bar-row-meta">
        <span className="bar-row-lead">
          Lead: {bar.lead} · counted {bar.countedAt}
        </span>
        {bar.flag ? <span className="bar-row-flag">{bar.flag}</span> : null}
      </div>
    </button>
  )
}

export function BarsScreen() {
  const navigate = useNavigate()
  const bars = useRepositoryQuery(['bars'], (r) => r.listBars())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())
  const custody = useRepositoryQuery(['custodyOverview'], (r) => r.custodyOverview())

  /**
   * BAR-165. The screen was four cards and then half a phone of nothing, and it
   * carried no figure a manager could act on — the one place in the app that
   * lists every bar could not say how much stock was across them, how much had
   * left the warehouse and not arrived, or how many bars were overdue a count.
   *
   * Every figure here is derived from read models that already existed. Nothing
   * new is fetched and nothing is estimated: the containers are summed from the
   * same `listBars()` the cards render, in transit is the custody overview's own
   * total, and counts due is a count of the cards already flagged.
   */
  const totals = useMemo(() => {
    const rows = bars.data
    if (!rows) return null
    return {
      containers: rows.reduce((sum, bar) => sum + bar.containers, 0),
      inTransit: custody.data?.inTransitContainers ?? 0,
      countsDue: rows.filter((bar) => bar.tone !== 'green').length,
    }
  }, [bars.data, custody.data])

  /**
   * BAR-133. The design opens the bar workspace from any card, and so does this.
   *
   * It previously gated on `bar.id === 'bar-3'` — the one bar the design's own
   * fixture set details — and flashed a toast for the rest. That is a fixture id
   * baked into a screen file: under live data every id is a UUID, so no card
   * opened at all and the bars list became a dead end. `BarScreen` already renders
   * an explicit empty state when `barDetail` returns null, which is the right
   * place for "this bar has no detail yet" to be handled.
   */
  const open = (bar: BarSummary) => {
    void navigate({ to: '/bars/$barId', params: { barId: bar.id } })
  }

  return (
    <div className="section-screen">
      <header className="section-head">
        <h1 className="section-head-title">Bars</h1>
        <span className="section-head-asof">AS OF {asOf.data?.label ?? '—'}</span>
      </header>

      {totals ? (
        <div className="bars-totals">
          <div className="wh-total">
            <span>IN BARS</span>
            <strong>{totals.containers.toLocaleString('en-IN')}</strong>
          </div>
          <button className="wh-total is-tappable" onClick={() => void navigate({ to: '/dockets' })}>
            <span>IN TRANSIT</span>
            <strong className={totals.inTransit > 0 ? 'tone-gold' : undefined}>{totals.inTransit}</strong>
          </button>
          <div className="wh-total">
            <span>NEEDS ATTENTION</span>
            <strong className={totals.countsDue > 0 ? 'tone-gold' : undefined}>{totals.countsDue}</strong>
          </div>
        </div>
      ) : null}

      <div className="section-body bars-body">
        {bars.isPending ? <ScreenSkeleton variant="bars" /> : null}
        {bars.isError ? <p className="section-empty">Bar status is unavailable.</p> : null}
        {bars.data?.map((bar) => (
          <BarCard key={bar.id} bar={bar} onOpen={open} />
        ))}
      </div>
    </div>
  )
}

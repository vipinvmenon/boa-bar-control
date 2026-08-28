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
import { useNavigate } from '@tanstack/react-router'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
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

      <div className="section-body bars-body">
        {bars.isPending ? <p className="section-empty">Loading bars…</p> : null}
        {bars.isError ? <p className="section-empty">Bar status is unavailable.</p> : null}
        {bars.data?.map((bar) => (
          <BarCard key={bar.id} bar={bar} onOpen={open} />
        ))}
      </div>
    </div>
  )
}

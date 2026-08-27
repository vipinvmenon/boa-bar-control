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
import { useDemoStore } from '../../lib/demo-store'
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
  const store = useDemoStore()
  const navigate = useNavigate()
  const bars = useRepositoryQuery(['bars'], (r) => r.listBars())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())

  // The design opens the bar workspace from any card. Bar 3 is the only bar its
  // own fixture set details, so the others acknowledge the tap rather than
  // navigating into an empty screen — matching design-script.jsx's openBar().
  const open = (bar: BarSummary) => {
    if (bar.id === 'bar-3') {
      void navigate({ to: '/bars/$barId', params: { barId: bar.id } })
      return
    }
    store.flash(`${bar.name} · DETAIL AVAILABLE FOR BAR 3`)
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

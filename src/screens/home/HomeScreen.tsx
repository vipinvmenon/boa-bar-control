/**
 * BAR-102 — the home screen, rebuilt to the approved design.
 *
 * Values from the `isHome` branch of
 * references/design-source/design-markup.html:15-127. Compare against
 * references/ui/home.png.
 *
 * This is one of the two screens `design-qa.md` declared "passed". It contained
 * literal `1,284`, `638`, `520`, `126` and never read the data layer at all, so
 * the two-fixture gate flagged it as hardcoded. That is the specific defect this
 * rebuild exists to remove: every figure below now comes from the repository.
 *
 * Other divergences corrected:
 *   - the bar grid showed status text under the figure with no divider and no
 *     'CONT.' unit; the design has name, then figure + unit, then a divided row
 *     with a dot and coloured status
 *   - every bar card linked to /bars rather than to its own bar
 *   - the alert CTA was a Link to /issue on one card and a toast on another; the
 *     design routes each alert to its own target
 *   - the attention count was a literal 3
 */
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'
import type { Alert } from '../../data/repository'

/** Where each alert's CTA goes. The design's targets, by alert target key. */
const TARGET_ROUTES: Record<string, string> = {
  issue: '/issue',
  count: '/count',
  // BAR-146. The alert may represent more than one awaiting docket; open the
  // custody list so the receiver can choose the exact docket to accept.
  accept: '/dockets',
}

export function HomeScreen() {
  const navigate = useNavigate()
  const store = useAppStore()
  const position = useRepositoryQuery(['position'], (r) => r.stockPosition())
  const alerts = useRepositoryQuery(['alerts'], (r) => r.alerts())
  const bars = useRepositoryQuery(['bars'], (r) => r.listBars())

  const openAlert = (alert: Alert) => {
    const route = TARGET_ROUTES[alert.target]
    if (route) {
      void navigate({ to: route })
      return
    }
    store.flash('RECEIVING SCREEN IS BAR-055')
  }

  return (
    <div className="home-screen">
      <section className="hero-stock">
        <div className="hero-total">
          <div>
            <span>TOTAL STOCK</span>
            <p>
              <strong>{position.data ? position.data.totalContainers.toLocaleString('en-IN') : '—'}</strong>
              <small>CONTAINERS</small>
            </p>
          </div>
          <time>
            AS OF
            <br />
            {position.data?.asOf.label ?? '—'}
          </time>
        </div>
        <div className="hero-breakdown">
          {position.data?.byArea.map((area) => (
            <div className="metric" key={area.label}>
              <span>{area.label}</span>
              <strong>{area.containers}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="home-section-label">
        <span>NEEDS ATTENTION</span>
        <em>{alerts.data?.length ?? 0}</em>
      </div>

      <div className="alert-stack">
        {alerts.data?.map((alert) => (
          <button className={`alert-card tone-${alert.tone}`} key={alert.id} onClick={() => openAlert(alert)}>
            <div className="alert-top">
              <span className="alert-level">
                <i className="alert-dot" />
                {alert.level}
              </span>
              <span className="alert-age">{alert.ageLabel}</span>
            </div>
            <div className="alert-middle">
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.subtitle}</span>
              </div>
              <em className="alert-metric">
                {alert.metric}
                <small>{alert.metricUnit}</small>
              </em>
            </div>
            <div className="alert-meter">
              <i style={{ width: `${alert.meterPct}%` }} />
            </div>
            <div className="alert-bottom">
              <span>{alert.meterNote}</span>
              <b className="alert-cta">
                {alert.actionLabel}
                <ArrowRight size={13} strokeWidth={2.6} aria-hidden="true" />
              </b>
            </div>
          </button>
        ))}
      </div>

      <div className="home-section-label">
        <span>BAR STATUS</span>
      </div>

      <div className="bar-grid">
        {bars.data?.map((bar) => (
          <button
            className="bar-card"
            key={bar.id}
            onClick={() => void navigate({ to: '/bars/$barId', params: { barId: bar.id } })}
          >
            <span className="bar-card-name">{bar.name}</span>
            <span className="bar-card-qty">
              <strong>{bar.containers}</strong>
              <small>CONT.</small>
            </span>
            <span className={`bar-card-status tone-${bar.tone}`}>
              <i className="bar-row-dot" />
              {bar.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

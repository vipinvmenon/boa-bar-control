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
  const position = useRepositoryQuery(['position'], (r) => r.stockPosition())
  const alerts = useRepositoryQuery(['alerts'], (r) => r.alerts())
  const bars = useRepositoryQuery(['bars'], (r) => r.listBars())

  const openAlert = (alert: Alert) => {
    /**
     * BAR-165. The count CTA used to go to the unscoped `/count`, which resolves
     * a location from the membership. A manager or admin holds none, so the one
     * alert naming the overdue bar landed on a sheet reading NO LOCATION that
     * could not be opened. Carry the bar in the route when the alert names one.
     */
    if (alert.target === 'count' && alert.locationId) {
      void navigate({ to: '/bars/$barId/count', params: { barId: alert.locationId } })
      return
    }
    const route = TARGET_ROUTES[alert.target]
    if (route) {
      void navigate({ to: route })
      return
    }
    void navigate({ to: '/dockets' })
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
          {/*
            BAR-165. Every figure on this screen is a snapshot, and this is the
            only thing that says how old it is. It was a 10px footnote at half
            opacity in the corner. The label stays quiet; the time is data.
          */}
          <time>
            AS OF
            <b>{position.data?.asOf.label ?? '—'}</b>
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

      {/*
        BAR-165. The count was a 10px red numeral against the right edge of a
        390px screen, as far from the words it counts as the layout allows. It is
        the one number on this screen meant to pull the eye, so it now sits
        against the label as a pill, using the same tinted-pill recipe as the
        alert cards' own level badges. Absent at zero, where a bare `0` used to
        render. A deliberate, approved deviation from the design — see
        docs/DECISIONS.md.
      */}
      <div className="home-section-label">
        <span>NEEDS ATTENTION</span>
        {alerts.data && alerts.data.length > 0 ? <em>{alerts.data.length}</em> : null}
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
              <em className={`alert-metric ${alert.metricIsWord ? 'is-word' : ''}`}>
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

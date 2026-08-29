/**
 * BAR-086 + BAR-087 — variance.
 *
 * Values from design-markup.html:757-802. Compare against
 * references/ui/variance.png.
 *
 * This screen did not exist. The /reports route was repurposed into an invented
 * variance page showing −2.1%, ₹18.4K and 94% mapped POS, none of which appear
 * anywhere in the design and none of which any code computed.
 *
 * Two specification rules are visible in the composition itself:
 *
 *   §8 — variance is a percentage of THROUGHPUT, not of stock held. The header
 *   shows throughput beside the figure, and the basis line says so explicitly,
 *   because "twenty missing pegs on a bar that sold 40 is a crisis; on a bar
 *   that sold 4,000 it is a rounding error".
 *
 *   §8 — positive variance is not good news. Corona is +2.4% and still amber,
 *   with a gold note telling the reader to check for a missed receipt or a
 *   wrong-SKU ring-up. The old domain code applied Math.abs() before banding,
 *   which graded surplus green.
 */
import { useNavigate, useParams } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

export function VarianceScreen() {
  const navigate = useNavigate()
  const { barId } = useParams({ strict: false }) as { barId?: string }
  const report = useRepositoryQuery(['variance', barId ?? 'membership'], (r) => r.variance(barId))
  const v = report.data

  if (!v) {
    return (
      <div className="section-screen">
        <div className="section-body">
          <p className="section-empty">Loading variance…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="section-screen">
      <header className="variance-head">
        <div className="variance-head-row">
          <div className="count-head-left">
            <button
              className="flow-back"
              onClick={() => void (barId
                ? navigate({ to: '/bars/$barId', params: { barId } })
                : navigate({ to: '/more' }))}
              aria-label="Back"
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="variance-title">{v.locationName} · VARIANCE</span>
          </div>
          <span className={`variance-band tone-${v.bandTone}`}>{v.bandLabel}</span>
        </div>

        <div className="variance-figures">
          <div className="variance-fig">
            <span>THROUGHPUT</span>
            <strong>{v.throughputLabel}</strong>
          </div>
          <div className={`variance-fig is-band tone-${v.bandTone}`}>
            <span>VARIANCE</span>
            <strong>{v.varianceLabel}</strong>
          </div>
        </div>

        <p className="variance-basis">{v.basisLabel}</p>
      </header>

      <div className="variance-list">
        {v.lines.map((line) => (
          <article className="variance-row" key={line.skuId}>
            <div className="variance-row-top">
              <p className="variance-row-name">{line.name}</p>
              <div className="variance-row-figs">
                <span className={`variance-delta tone-${line.tone}`}>{line.delta}</span>
                <span className={`variance-pct tone-${line.tone}`}>{line.pct}</span>
              </div>
            </div>
            <div className="variance-row-meta">
              <span>EXPECTED {line.expected}</span>
              <span>COUNTED {line.counted}</span>
            </div>
            <p className={`variance-row-note ${line.noteTone ? `tone-${line.noteTone}` : ''}`}>{line.note}</p>
          </article>
        ))}
        <p className="variance-footnote">
          Positive variance is investigated the same as negative. It usually means a missed receipt, an
          unaccepted docket or a wrong-SKU ring-up.
        </p>
      </div>
    </div>
  )
}

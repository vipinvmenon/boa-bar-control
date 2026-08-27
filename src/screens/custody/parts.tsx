/**
 * Shared building blocks for the custody chain.
 *
 * All four detail panels in the flow (review, docket, accept, received) are the
 * same composition in the design: a rounded glass list of label/value rows. So
 * is the flow header and the sticky footer. Factored out rather than repeated
 * five times.
 *
 * Values from design-markup.html: the review branch (375-411), docket (412-446),
 * accept (498-581) and received (582-607).
 */
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { DetailRow } from '../../data/repository'

export function FlowHeader({
  title,
  onBack,
  badge,
}: {
  title: string
  onBack: () => void
  badge?: string
}) {
  return (
    <header className="flow-head">
      <div className="flow-head-left">
        <button className="flow-back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="flow-head-title">{title}</span>
      </div>
      {badge ? <span className="flow-head-badge">{badge}</span> : null}
    </header>
  )
}

export function DetailList({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="detail-list">
      {rows.map((row) => (
        <div className="detail-row" key={row.label}>
          <span>{row.label}</span>
          <strong className={row.tone ? `tone-${row.tone}` : undefined}>{row.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function FlowFooter({ children }: { children: ReactNode }) {
  return <footer className="flow-foot">{children}</footer>
}

/** The design's gold advisory note on the review screen. */
export function Advisory({ tone, children }: { tone: 'gold' | 'sage'; children: ReactNode }) {
  return <div className={`advisory advisory-${tone}`}>{children}</div>
}


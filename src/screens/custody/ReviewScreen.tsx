/**
 * BAR-052 — review issue. The confirmation step the old flow skipped entirely,
 * jumping straight from quantity to docket creation.
 *
 * Values from design-markup.html:375-411. Compare against references/ui/review.png.
 *
 * Note the design's own advisory: "Bar 3 stock updates only when the receiving
 * lead accepts the docket. Until then it sits in transit." That is the two-leg
 * custody model in ADR-013, stated on the screen.
 */
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { Advisory, DetailList, FlowFooter, FlowHeader } from './parts'
import { describeQuantity } from './quantity'

export function ReviewScreen() {
  const navigate = useNavigate()
  const { qty } = useSearch({ from: '/issue/review' })
  const custody = useRepositoryQuery(['custody'], (r) => r.custody())

  if (!custody.data) {
    return (
      <div className="flow-screen">
        <FlowHeader title="Review issue" onBack={() => void navigate({ to: '/issue' })} />
        <div className="flow-body">
          <p className="section-empty">Loading…</p>
        </div>
      </div>
    )
  }

  const d = custody.data
  const containers = qty ?? d.expectedContainers

  return (
    <div className="flow-screen">
      <FlowHeader title="Review issue" onBack={() => void navigate({ to: '/issue' })} />

      <div className="flow-body">
        <section className="review-hero">
          <p className="review-hero-qty">
            {containers} × {d.productName.toUpperCase()}
          </p>
          <p className="review-hero-spec">{describeQuantity(containers, d.unitsPerCase, d.mlPerContainer)}</p>
          <div className="review-route">
            <span>{d.fromName}</span>
            <ArrowDown size={22} strokeWidth={2} aria-hidden="true" />
            <span className="review-route-to">{d.toName}</span>
          </div>
        </section>

        <DetailList
          rows={[
            { label: 'Product', value: d.productName.toUpperCase() },
            { label: 'Quantity', value: `${containers} BOTTLES` },
            { label: 'Warehouse after issue', value: `${d.warehouseBefore - containers} BOTTLES` },
            { label: 'Issued by', value: `${d.issuedBy} · ${d.issuedAt}` },
            { label: 'Movement type', value: 'ISSUE', tone: 'green' },
          ]}
        />

        <Advisory tone="gold">
          {d.toName} stock updates only when the receiving lead accepts the docket. Until then it sits
          in transit.
        </Advisory>
      </div>

      <FlowFooter>
        <button
          className="flow-cta"
          onClick={() => void navigate({ to: '/dockets/$docketId', params: { docketId: d.docketNo } })}
        >
          Create docket &amp; issue
        </button>
      </FlowFooter>
    </div>
  )
}

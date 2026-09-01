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
import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { Advisory, DetailList, FlowFooter, FlowHeader } from './parts'
import { describeQuantity } from './quantity'
import { issueStock } from '../../services/issue'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

export function ReviewScreen() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/issue/review' })
  const issue = useRepositoryQuery(['issue-options'], (repository) => repository.issueOptions())
  const [fallbackActionId] = useState(() => crypto.randomUUID())

  const options = issue.data

  /**
   * The draft is taken from the URL and NOT defaulted.
   *
   * This screen previously fell back to `defaultDestinationId`, `defaultProductId`
   * and a computed quantity when the search was empty — so opening `/issue/review`
   * directly, from a stale bookmark or a shared link, rendered `48 × KINGFISHER`
   * with the create button enabled and would have posted a real ledger movement
   * nobody selected. A picker may default; a confirmation step that writes to the
   * ledger may not. If the draft is not explicit, there is nothing to confirm.
   */
  const destination = options?.destinations.find((item) => item.id === search.toLocationId)
  const product = options?.products.find((item) => item.skuId === search.skuId)
  const containers = search.containers ?? 0
  const hasDraft = Boolean(destination && product && containers > 0)

  const submit = useRepositoryMutation((repository, input: void) => {
    void input
    if (!options || !destination || !product || containers <= 0) {
      throw new Error('There is no issue draft to confirm')
    }
    return issueStock({
      repository,
      actionId: search.actionId ?? fallbackActionId,
      topUpRequestId: search.topUpRequestId,
      fromLocationId: options.fromLocationId,
      toLocationId: destination.id,
      lines: [{ skuId: product.skuId, containers }],
    })
  })

  if (!options) {
    return (
      <div className="flow-screen">
        <FlowHeader title="Review issue" onBack={() => void navigate({ to: '/issue', search })} />
        <div className="flow-body">
          <ScreenSkeleton variant="flow" />
        </div>
      </div>
    )
  }

  // Reached without a draft. Says so, and offers the only sensible way forward,
  // rather than presenting an invented issue as though somebody had chosen it.
  if (!hasDraft || !destination || !product) {
    return (
      <div className="flow-screen">
        <FlowHeader title="Review issue" onBack={() => void navigate({ to: '/issue' })} />
        <div className="flow-body">
          <Advisory tone="gold">
            NO ISSUE TO REVIEW. Choose a destination, a product and a quantity first — this screen
            confirms an issue, it does not invent one.
          </Advisory>
        </div>
        <FlowFooter>
          <button className="flow-cta" onClick={() => void navigate({ to: '/issue' })}>
            Start an issue
          </button>
        </FlowFooter>
      </div>
    )
  }

  const canIssue = containers > 0 && containers <= product.warehouseContainers && !submit.isPending
  const quantityUnit = product.containerUnitPlural

  return (
    <div className="flow-screen">
      <FlowHeader
        title="Review issue"
        onBack={() => void navigate({
          to: '/issue',
          search: {
            ...search,
            actionId: search.actionId ?? fallbackActionId,
            fromLocationId: options.fromLocationId,
            toLocationId: destination.id,
            skuId: product.skuId,
            containers,
          },
        })}
      />

      <div className="flow-body">
        <section className="review-hero">
          <p className="review-hero-qty">
            {containers} × {product.reviewName.toUpperCase()}
          </p>
          <p className="review-hero-spec">
            {describeQuantity(containers, product.unitsPerCase, product.mlPerContainer)}
          </p>
          <div className="review-route">
            <span>{options.fromName}</span>
            <ArrowDown size={22} strokeWidth={2} aria-hidden="true" />
            <span className="review-route-to">{destination.name}</span>
          </div>
        </section>

        <DetailList
          rows={[
            { label: 'Product', value: product.name.toUpperCase() },
            { label: 'Quantity', value: `${containers} ${quantityUnit}` },
            { label: 'Warehouse after issue', value: `${product.warehouseContainers - containers} ${quantityUnit}` },
            { label: 'Issued by', value: `${options.issuedBy} · ${options.issuedAt}` },
            { label: 'Movement type', value: 'ISSUE', tone: 'green' },
          ]}
        />

        <Advisory tone="gold">
          {destination.name} stock updates only when the receiving lead accepts the docket. Until then it sits
          in transit.
        </Advisory>
      </div>

      <FlowFooter>
        {submit.isError ? (
          <p className="flow-error" role="alert">NOT ISSUED · {submit.error.message}</p>
        ) : null}
        {submit.data?.status === 'queued' ? (
          <Advisory tone="gold">
            ISSUE QUEUED ON THIS DEVICE · THE DOCKET NUMBER WILL APPEAR AFTER SYNC.
          </Advisory>
        ) : null}
        <button
          className="flow-cta"
          disabled={!canIssue || submit.data?.status === 'queued'}
          onClick={() => submit.mutate(undefined, {
            onSuccess: (outcome) => {
              if (outcome.status !== 'posted') return
              void navigate({ to: '/dockets/$docketId', params: { docketId: outcome.docketNo } })
            },
          })}
        >
          {submit.isPending ? 'Recording…' : 'Create docket & issue'}
        </button>
      </FlowFooter>
    </div>
  )
}

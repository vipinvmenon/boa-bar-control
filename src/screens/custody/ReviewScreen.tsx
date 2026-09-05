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
import { isIssueBasket, type IssueBasket } from '../issue/draft'
import { useDraft } from '../../data/useDraft'

export function ReviewScreen() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/issue/review' })
  const issue = useRepositoryQuery(['issue-options'], (repository) => repository.issueOptions())
  const [fallbackActionId] = useState(() => crypto.randomUUID())

  /**
   * BAR-177 / ADR-016. The staged docket, if there is one.
   *
   * A basket built for a different destination is ignored rather than issued to
   * the wrong bar — the whole point of holding `toLocationId` alongside the
   * lines. With no basket this screen behaves exactly as it did: the single line
   * comes from the URL, which is how a home alert seeds an issue and how the
   * fidelity gate reaches this screen.
   */
  const basketKey = issue.data ? `issue:basket:${issue.data.fromLocationId}` : null
  const basket = useDraft<IssueBasket>(basketKey, { actionId: fallbackActionId, toLocationId: null, lines: [] }, isIssueBasket)
  const basketLines = basket.value.toLocationId && basket.value.toLocationId === search.toLocationId
    ? basket.value.lines
    : []

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
  /** Every line to be issued: the basket when there is one, else the URL's single line. */
  const lines = basketLines.length > 0
    ? basketLines
    : product && containers > 0 ? [{ skuId: product.skuId, containers }] : []
  const multiLine = lines.length > 1
  const hasDraft = Boolean(destination) && lines.length > 0

  const submit = useRepositoryMutation((repository, input: void) => {
    void input
    if (!options || !destination || lines.length === 0) {
      throw new Error('There is no issue draft to confirm')
    }
    return issueStock({
      repository,
      actionId: search.actionId ?? fallbackActionId,
      topUpRequestId: search.topUpRequestId,
      fromLocationId: options.fromLocationId,
      toLocationId: destination.id,
      lines,
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
  if (!hasDraft || !destination) {
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

  /**
   * BAR-177. Every staged line has to be issuable, not just the first.
   *
   * A basket whose SKU is no longer in the catalogue, or whose quantity now
   * exceeds what the warehouse holds, must not reach the create — the RPC would
   * refuse it and the person would be looking at a failure they could have been
   * warned about while they could still fix it.
   */
  const productFor = (skuId: string) => options.products.find((item) => item.skuId === skuId)
  const overdrawn = lines.filter((line) => {
    const item = productFor(line.skuId)
    return !item || line.containers > item.warehouseContainers
  })
  const totalContainers = lines.reduce((sum, line) => sum + line.containers, 0)
  const canIssue = totalContainers > 0 && overdrawn.length === 0 && !submit.isPending

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
            skuId: multiLine ? undefined : product?.skuId,
            containers: multiLine ? undefined : containers,
          },
        })}
      />

      <div className="flow-body">
        <section className="review-hero">
          {/*
            BAR-177. One product keeps the design's headline verbatim —
            `48 × KINGFISHER`, with the cases/ml/litres line under it. Several
            cannot: there is no single product to name and no single unit to
            convert, so the headline states the docket's shape instead and the
            products are listed below, where they can each carry their own figure.
          */}
          <p className="review-hero-qty">
            {multiLine
              ? `${lines.length} PRODUCTS`
              : `${containers} × ${product?.reviewName.toUpperCase() ?? ''}`}
          </p>
          <p className="review-hero-spec">
            {multiLine
              ? `${totalContainers} containers on one docket`
              : product ? describeQuantity(containers, product.unitsPerCase, product.mlPerContainer) : ''}
          </p>
          <div className="review-route">
            <span>{options.fromName}</span>
            <ArrowDown size={22} strokeWidth={2} aria-hidden="true" />
            <span className="review-route-to">{destination.name}</span>
          </div>
        </section>

        <DetailList
          rows={[
            ...(multiLine
              ? lines.map((line) => {
                const item = productFor(line.skuId)
                return {
                  label: item?.name.toUpperCase() ?? line.skuId,
                  value: `${line.containers} ${item?.containerUnitPlural ?? ''}`.trim(),
                }
              })
              : [
                { label: 'Product', value: product?.name.toUpperCase() ?? '' },
                { label: 'Quantity', value: `${containers} ${product?.containerUnitPlural ?? ''}` },
                {
                  label: 'Warehouse after issue',
                  value: `${(product?.warehouseContainers ?? 0) - containers} ${product?.containerUnitPlural ?? ''}`,
                },
              ]),
            { label: 'Issued by', value: `${options.issuedBy} · ${options.issuedAt}` },
            { label: 'Movement type', value: 'ISSUE', tone: 'green' },
          ]}
        />

        {/* Warned while it can still be fixed, rather than refused by the RPC. */}
        {overdrawn.length > 0 ? (
          <Advisory tone="gold">
            {overdrawn.map((line) => productFor(line.skuId)?.name ?? line.skuId).join(', ')} — more than the
            warehouse holds. Go back and lower the quantity.
          </Advisory>
        ) : null}

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
              // BAR-177. The basket is cleared only once the write is posted —
              // clearing it on submit would lose the staged docket if the create
              // then failed, and rebuilding ten lines at a warehouse door is not
              // a recovery anybody would forgive.
              if (outcome.status !== 'posted') return
              void basket.clear()
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

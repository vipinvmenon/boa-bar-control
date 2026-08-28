/**
 * BAR-063 — record waste.
 *
 * Composition from design-markup.html:612-651, interactions from
 * design-script.jsx:305-315. Compare against references/ui/waste.png.
 *
 * What the legacy screen got wrong, all of it now fixed:
 *   - the reason vocabulary diverged from the design's five, and "Foam / line
 *     loss" — the one that matters for draught — was missing entirely
 *   - it offered `store.stock.slice(0, 5)`, a visual-only slice of the catalogue
 *   - it recorded nothing durable, and posted every waste to `bar_3` regardless
 *     of which bar the crew member was standing in (BAR-133)
 *
 * No on-hand figure appears here. The design shows product, quantity and reason
 * only, and a position figure would be a disclosure to a bar lead who may be
 * mid-count at this same location (non-negotiable 3). The quantity is bounded by
 * the database, which refuses more than the location holds.
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { recordWaste } from '../../services/waste'

export function WasteScreen() {
  const navigate = useNavigate()
  const options = useRepositoryQuery(['wasteOptions'], (r) => r.wasteOptions())

  const [skuId, setSkuId] = useState<string | null>(null)
  const [containers, setContainers] = useState(1)
  const [reason, setReason] = useState<string | null>(null)

  // One id for this waste entry, reused across attempts (BAR-069).
  const [actionId] = useState(() => crypto.randomUUID())

  const data = options.data
  const product = data?.products.find((p) => p.skuId === skuId)
    ?? data?.products.find((p) => p.skuId === data.defaultProductId)
    ?? data?.products[0]

  const submit = useRepositoryMutation((repository, input: { reason: string }) => {
    if (!data || !product) throw new Error('The waste screen is still loading')
    return recordWaste({
      repository,
      actionId,
      locationId: data.locationId,
      skuId: product.skuId,
      containers,
      reason: input.reason,
    })
  })

  if (!data || !product) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <p className="section-empty">Loading…</p>
        </div>
      </div>
    )
  }

  const nextProduct = () => {
    const index = data.products.findIndex((p) => p.skuId === product.skuId)
    const next = data.products[(index + 1) % data.products.length]
    if (next) setSkuId(next.skuId)
  }

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            <button className="flow-back" onClick={() => void navigate({ to: '/bars' })} aria-label="Back">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="count-title">RECORD WASTE</span>
          </div>
          {/* The recording location, stated — and it is what the command posts to. */}
          <span className="count-scope">{data.locationName}</span>
        </div>
      </header>

      <div className="flow-body">
        <button className="issue-product" onClick={nextProduct} aria-label="Change product">
          <span className="issue-label">PRODUCT</span>
          <span className="issue-product-row">
            <span>
              <strong>{product.name}</strong>
              <small>{product.spec}</small>
            </span>
            <span className="issue-change">CHANGE</span>
          </span>
        </button>

        <div className="issue-stepper">
          {/* The design floors at 1: recording zero waste is not an observation. */}
          <button
            className="issue-minus"
            onClick={() => setContainers((n) => Math.max(1, n - 1))}
            disabled={containers <= 1}
            aria-label="Decrease waste quantity"
          >
            <Minus size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <div>
            <strong>{containers}</strong>
            <span>{product.containerUnitPlural}</span>
          </div>
          <button
            className="issue-plus"
            onClick={() => setContainers((n) => n + 1)}
            aria-label="Increase waste quantity"
          >
            <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <span className="issue-label waste-reason-label">REASON</span>
        <div className="waste-reasons">
          {data.reasons.map((option) => (
            <button
              key={option}
              className={reason === option ? 'active' : ''}
              onClick={() => setReason(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <p className="waste-note">
          Waste is a ledger movement, not an edit. It appears in variance as accounted depletion.
        </p>
      </div>

      <footer className="flow-foot">
        {submit.isError && (
          <p className="flow-error" role="alert">NOT RECORDED · {submit.error.message}</p>
        )}
        <button
          className="flow-cta is-short"
          disabled={reason === null || submit.isPending}
          onClick={() => reason && submit.mutate({ reason }, {
            onSuccess: () => void navigate({ to: '/bars' }),
          })}
        >
          {submit.isPending ? 'Recording…' : `Record ${containers} as waste`}
        </button>
      </footer>
    </div>
  )
}

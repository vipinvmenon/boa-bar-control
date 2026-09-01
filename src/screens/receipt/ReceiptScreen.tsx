/**
 * BAR-060 — record a delivery.
 *
 * **Not in the approved design.** The design's 22 screens have no receipt screen —
 * `received` is the docket-acceptance receipt, a different thing. Phase 1 of the
 * specification requires "receipt + issue + docket", and without this a pallet
 * arriving from STOK at 14:00 on the day has nowhere to be recorded except the
 * database password. Built from the existing design tokens rather than inventing a
 * visual language, and it should be replaced if a designed version arrives.
 *
 * Multi-line, unlike issue and waste, because a delivery note carries several
 * products and splitting one note across several receipts would break the
 * reconciliation the note exists for.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { recordReceipt } from '../../services/receipt'
import { clearDraft, readDraft, writeDraft } from '../../lib/offline-db'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

type Line = { skuId: string; containers: number }
type ReceiptDraft = {
  supplier: string
  deliveryNote: string
  skuId: string | null
  containers: number
  lines: Line[]
  actionId: string
}

export function ReceiptScreen() {
  const navigate = useNavigate()
  const options = useRepositoryQuery(['receiptOptions'], (r) => r.receiptOptions())
  const data = options.data

  const [supplier, setSupplier] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [skuId, setSkuId] = useState<string | null>(null)
  const [containers, setContainers] = useState(24)
  const [lines, setLines] = useState<Line[]>([])
  const [actionId, setActionId] = useState<string>(() => crypto.randomUUID())
  const [draftReady, setDraftReady] = useState(false)

  const draftKey = data ? `receipt:draft:${data.locationId}` : null

  // BAR-072. A delivery note can be entered over several minutes in a noisy
  // warehouse; losing its lines on reload is a lost operational record. Restore
  // only the known draft shape, and keep the action id so retries remain one
  // idempotent receipt.
  useEffect(() => {
    if (!draftKey) return
    let active = true
    setDraftReady(false)
    void readDraft(draftKey).then((value) => {
      if (!active) return
      const draft = value as Partial<ReceiptDraft> | undefined
      if (
        draft && typeof draft.supplier === 'string' && typeof draft.deliveryNote === 'string'
        && Array.isArray(draft.lines) && typeof draft.actionId === 'string'
      ) {
        setSupplier(draft.supplier)
        setDeliveryNote(draft.deliveryNote)
        setSkuId(typeof draft.skuId === 'string' ? draft.skuId : null)
        setContainers(typeof draft.containers === 'number' && draft.containers >= 1 ? draft.containers : 24)
        setLines(draft.lines.filter((line): line is Line =>
          typeof line?.skuId === 'string' && Number.isInteger(line.containers) && line.containers >= 1,
        ))
        setActionId(draft.actionId)
      }
      setDraftReady(true)
    }).catch(() => {
      if (active) setDraftReady(true)
    })
    return () => { active = false }
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !draftReady) return
    void writeDraft(draftKey, { supplier, deliveryNote, skuId, containers, lines, actionId } satisfies ReceiptDraft)
  }, [actionId, containers, deliveryNote, draftKey, draftReady, lines, skuId, supplier])

  const product = data?.products.find((p) => p.skuId === skuId)
    ?? data?.products.find((p) => p.skuId === data.defaultProductId)
    ?? data?.products[0]

  const submit = useRepositoryMutation((repository, input: { lines: Line[] }) => {
    if (!data) throw new Error('The delivery screen is still loading')
    return recordReceipt({
      repository,
      actionId,
      locationId: data.locationId,
      supplier,
      deliveryNote,
      lines: input.lines,
    })
  })

  if (!data || !product) {
    return (
      <div className="flow-screen">
        <div className="flow-body"><ScreenSkeleton variant="flow" /></div>
      </div>
    )
  }

  const nextProduct = () => {
    const index = data.products.findIndex((p) => p.skuId === product.skuId)
    const next = data.products[(index + 1) % data.products.length]
    if (next) setSkuId(next.skuId)
  }

  const addLine = () => {
    setLines((current) => {
      // Adding the same product twice is ambiguous on a paper note — is it 12 or
      // 24? Add to the existing line instead. The database refuses duplicates.
      const existing = current.find((l) => l.skuId === product.skuId)
      if (existing) {
        return current.map((l) =>
          l.skuId === product.skuId ? { ...l, containers: l.containers + containers } : l,
        )
      }
      return [...current, { skuId: product.skuId, containers }]
    })
  }

  const nameFor = (id: string) => data.products.find((p) => p.skuId === id)?.name ?? id
  const unitFor = (id: string) => data.products.find((p) => p.skuId === id)?.containerUnitPlural ?? ''
  const canRecord =
    draftReady && supplier.trim() !== '' && deliveryNote.trim() !== '' && lines.length > 0 && !submit.isPending

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            <button className="flow-back" onClick={() => void navigate({ to: '/warehouse' })} aria-label="Back">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="count-title">RECORD DELIVERY</span>
          </div>
          <span className="count-scope">{data.locationName}</span>
        </div>
      </header>

      <div className="flow-body">
        {/*
          Spec §4: a receipt is posted against a delivery note. It is the document
          the excise return and the STOK settlement reconcile to, so it is required
          rather than optional.
        */}
        <label className="field">
          <span className="issue-label">SUPPLIER</span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="STOK" />
        </label>

        <label className="field">
          <span className="issue-label">DELIVERY NOTE / INVOICE</span>
          <input
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder="STK-2261"
          />
        </label>

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
          <button
            className="issue-minus"
            onClick={() => setContainers((n) => Math.max(1, n - 1))}
            disabled={containers <= 1}
            aria-label="Decrease delivered quantity"
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
            aria-label="Increase delivered quantity"
          >
            <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <button className="flow-cta-ghost" onClick={addLine}>Add to delivery</button>

        <div className="section-label">
          ON THIS DELIVERY
          <span>{lines.length}</span>
        </div>

        {lines.length === 0 ? (
          <p className="section-empty">Nothing added yet. A delivery needs at least one product.</p>
        ) : null}

        {lines.map((line) => (
          <div className="receipt-line" key={line.skuId}>
            <span>
              <strong>{nameFor(line.skuId)}</strong>
              <small>{line.containers} {unitFor(line.skuId)}</small>
            </span>
            <button
              onClick={() => setLines((current) => current.filter((l) => l.skuId !== line.skuId))}
              aria-label={`Remove ${nameFor(line.skuId)}`}
            >
              <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <footer className="flow-foot">
        {submit.isError && (
          <p className="flow-error" role="alert">NOT RECORDED · {submit.error.message}</p>
        )}
        <button className="flow-cta" disabled={!canRecord} onClick={() => submit.mutate(
          { lines },
          { onSuccess: () => {
            if (draftKey) void clearDraft(draftKey)
            void navigate({ to: '/warehouse' })
          } },
        )}>
          {submit.isPending ? 'Recording…' : `Record delivery · ${lines.length} line${lines.length === 1 ? '' : 's'}`}
        </button>
      </footer>
    </div>
  )
}

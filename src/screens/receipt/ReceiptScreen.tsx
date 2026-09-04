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
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { recordReceipt } from '../../services/receipt'
import { cancelQueuedCommand, clearDraft, readDraft, writeDraft } from '../../lib/offline-db'
import { useAppStore } from '../../lib/app-store'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ProductPicker } from '../../components/ProductPicker'

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
  const store = useAppStore()
  const options = useRepositoryQuery(['receiptOptions'], (r) => r.receiptOptions())
  const data = options.data

  const [supplier, setSupplier] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [skuId, setSkuId] = useState<string | null>(null)
  const [containers, setContainers] = useState(24)
  const [lines, setLines] = useState<Line[]>([])
  const [actionId, setActionId] = useState<string>(() => crypto.randomUUID())
  const [draftReady, setDraftReady] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const productTriggerRef = useRef<HTMLButtonElement>(null)

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

  /**
   * BAR-165. What is still missing, in the order the screen asks for it.
   *
   * The button was simply dead: with two products added and the supplier left
   * blank it said "Record delivery · 2 lines" and did nothing, and there was no
   * way to find out why. Spec §4 requires both the supplier and the note — this
   * says so rather than leaving somebody tapping.
   */
  const blocker = !draftReady
    ? null
    : supplier.trim() === ''
      ? 'Name the supplier this delivery came from.'
      : deliveryNote.trim() === ''
        ? 'Enter the delivery note or invoice number. The excise return and the settlement reconcile to it.'
        : lines.length === 0
          ? 'Add at least one product to the delivery.'
          : null

  /** Anything worth losing — used to decide whether discarding needs confirming. */
  const hasDraft = supplier.trim() !== '' || deliveryNote.trim() !== '' || lines.length > 0

  const discard = () => {
    if (draftKey) void clearDraft(draftKey)
    setSupplier('')
    setDeliveryNote('')
    setLines([])
    setContainers(24)
    setActionId(crypto.randomUUID())
    setConfirmDiscard(false)
  }

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            <button className="flow-back" onClick={() => void navigate({ to: '/warehouse' })} aria-label="Back">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="count-head-title">RECORD DELIVERY</span>
          </div>
          <span className="section-head-asof">{data.locationName}</span>
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

        {/*
          BAR-176. A delivery note carries several products, so this trigger is
          used once per line — it was also the worst case of the cycling CHANGE
          button, since every line started from wherever the previous one left
          off. The line-builder below is untouched: choose, set the quantity, add.
        */}
        <button
          className="issue-product"
          ref={productTriggerRef}
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-label="Change product"
        >
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

        {/*
          BAR-165. A delivery survives a reload by design (BAR-072), which also
          means a half-entered one survives being handed to the next person on a
          shared device — with a supplier, a note and lines already filled in, and
          no way to clear them but removing each line by hand. The action id is
          re-minted with it, so the discarded attempt and a later real delivery
          are never the same idempotent write.
        */}
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
        {blocker && !confirmDiscard ? <p className="flow-hint">{blocker}</p> : null}
        {/*
          BAR-168. Same defect as the waste screen: this recorded a delivery and
          then simply left. A delivery note is entered over several minutes and
          is the record a supplier invoice is reconciled against, so "did that
          save?" is not a small question.

          The undo here also puts the draft back. Cancelling the queued command
          without restoring the lines would leave somebody who tapped Undo with
          nothing to re-record, which is a worse outcome than not offering it —
          and the action id goes back too, so re-recording stays one idempotent
          receipt rather than risking a second one.
        */}
        <button className="flow-cta" disabled={!canRecord} onClick={() => submit.mutate(
          { lines },
          { onSuccess: (result) => {
            const recorded = { supplier, deliveryNote, skuId, containers, lines, actionId } satisfies ReceiptDraft
            const summary = `${lines.length} LINE${lines.length === 1 ? '' : 'S'} · ${(supplier || 'DELIVERY').toUpperCase()}`
            if (draftKey) void clearDraft(draftKey)
            if (result.status === 'queued') {
              store.flash(`${summary} · QUEUED`, {
                label: 'Undo',
                run: () => void cancelQueuedCommand(result.outboxId).then((cancelled) => {
                  if (cancelled && draftKey) void writeDraft(draftKey, recorded)
                  store.flash(cancelled
                    ? `${summary} · PUT BACK · NOTHING RECORDED`
                    : `ALREADY SENT · ${summary} IS ON THE LEDGER`)
                }),
              })
            } else {
              store.flash(`${summary} · RECORDED`)
            }
            void navigate({ to: '/warehouse' })
          } },
        )}>
          {submit.isPending ? 'Recording…' : `Record delivery · ${lines.length} line${lines.length === 1 ? '' : 's'}`}
        </button>
        {hasDraft && !confirmDiscard ? (
          <button className="flow-cta-ghost" onClick={() => setConfirmDiscard(true)}>Discard delivery</button>
        ) : null}
      </footer>
      {pickerOpen && (
        <ProductPicker
          scope="receipt"
          options={data.products.map((item) => ({
            id: item.skuId,
            name: item.name,
            detail: item.spec,
          }))}
          selectedId={product.skuId}
          onSelect={setSkuId}
          onDismiss={() => setPickerOpen(false)}
          returnFocusTo={productTriggerRef}
        />
      )}
      {confirmDiscard && <ConfirmDialog title="Discard delivery?" confirmLabel="Discard delivery" cancelLabel="Keep delivery" onCancel={() => setConfirmDiscard(false)} onConfirm={discard}><p>Clear the supplier, delivery note, and {lines.length} line{lines.length === 1 ? '' : 's'}? Nothing has been recorded, so nothing will be removed from the ledger.</p></ConfirmDialog>}
    </div>
  )
}

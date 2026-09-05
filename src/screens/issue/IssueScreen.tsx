/**
 * BAR-051 — issue stock.
 *
 * Values and interactions from design-markup.html:301-373 and
 * design-script.jsx:216-241. All operational values come from `issueOptions()`;
 * this screen contains no fixture SKU, location or stock figure.
 */
import { useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { caseCountLabel, issuePresets, issueStep, quantityFor, type IssueUnit } from '../../domain/units'
import { FlowFooter, FlowHeader } from '../custody/parts'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { ProductPicker } from '../../components/ProductPicker'
import { isIssueBasket, type IssueBasket } from './draft'
import { useDraft } from '../../data/useDraft'
import { Trash2 } from 'lucide-react'

function initialContainers(unitsPerCase: number, available: number): number {
  const fullCaseMaximum = Math.floor(available / unitsPerCase) * unitsPerCase
  return Math.min(unitsPerCase * 2, fullCaseMaximum)
}

export function IssueScreen() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/issue' })
  const issue = useRepositoryQuery(['issue-options'], (repository) => repository.issueOptions())

  const [actionId] = useState(() => search.actionId ?? crypto.randomUUID())
  const [destinationId, setDestinationId] = useState<string | null>(search.toLocationId ?? null)
  const [productId, setProductId] = useState<string | null>(search.skuId ?? null)
  const [unit, setUnit] = useState<IssueUnit>(search.unit ?? 'case')
  const [chosenContainers, setChosenContainers] = useState<number | null>(search.containers ?? null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const productTriggerRef = useRef<HTMLButtonElement>(null)

  /**
   * BAR-177 / ADR-016. The staged docket, kept on the device.
   *
   * Declared before the loading guard below, because hooks must run in the same
   * order on every render. A null key while the options load means `useDraft`
   * holds its initial value and writes nothing.
   */
  const basketKey = issue.data ? `issue:basket:${issue.data.fromLocationId}` : null
  const basket = useDraft<IssueBasket>(
    basketKey,
    { actionId, toLocationId: null, lines: [] },
    isIssueBasket,
  )
  const staged = basket.value.lines

  const options = issue.data
  const destination = options?.destinations.find((item) => item.id === destinationId)
    ?? options?.destinations.find((item) => item.id === options.defaultDestinationId)
  const product = options?.products.find((item) => item.skuId === productId)
    ?? options?.products.find((item) => item.skuId === options.defaultProductId)

  if (!options || !destination || !product) {
    return (
      <div className="flow-screen">
        <FlowHeader title="Issue stock" onBack={() => void navigate({ to: '/warehouse' })} />
        <div className="flow-body">
          <ScreenSkeleton variant="flow" />
        </div>
      </div>
    )
  }

  const containers = chosenContainers ?? initialContainers(product.unitsPerCase, product.warehouseContainers)
  const displayQuantity = quantityFor(containers, unit, product.unitsPerCase)
  const step = issueStep(unit, product.unitsPerCase)
  const maximum = unit === 'case'
    ? Math.floor(product.warehouseContainers / product.unitsPerCase) * product.unitsPerCase
    : product.warehouseContainers
  const minimum = maximum === 0 ? 0 : Math.min(step, maximum)
  const presets = issuePresets(unit, product.unitsPerCase)
  const unitWord = product.containerUnitPlural.toLowerCase()
  const canReview = containers > 0 && containers <= product.warehouseContainers

  const chooseUnit = (next: IssueUnit) => {
    setUnit(next)
    if (next === 'case') {
      setChosenContainers(initialContainers(product.unitsPerCase, product.warehouseContainers))
    } else {
      setChosenContainers(Math.min(product.unitsPerCase * 2, product.warehouseContainers))
    }
  }

  /**
   * Functional update, not `containers + step`.
   *
   * `containers` is a render-scoped value, so two taps inside one React batch both
   * computed from the same figure and only one of them applied: four rapid taps on
   * the minus button moved 42 to 36 instead of 42 to 18. A crew member holding the
   * button down to reach 6 cases would have landed somewhere lower and issued the
   * wrong quantity, with the docket agreeing with the mistake.
   */
  const changeQuantity = (direction: -1 | 1) => {
    setChosenContainers((previous) => {
      const current = previous ?? initialContainers(product.unitsPerCase, product.warehouseContainers)
      return Math.max(minimum, Math.min(maximum, current + direction * step))
    })
  }

  /**
   * BAR-177 / ADR-016. A docket goes to exactly one place, so once a line is
   * staged the destination is fixed. Locked rather than made to clear the
   * basket: silently discarding four staged lines because somebody tapped the
   * destination tile is a worse outcome than refusing the tap and saying why.
   */
  const destinationLocked = staged.length > 0
  const chooseNextDestination = () => {
    if (destinationLocked) return
    const index = options.destinations.findIndex((item) => item.id === destination.id)
    const next = options.destinations[(index + 1) % options.destinations.length]
    if (next) setDestinationId(next.id)
  }

  /**
   * Stage the current product and quantity.
   *
   * The same product twice is ambiguous on a paper docket — is it 12 or 24? — and
   * `boa_bar_docket_line` is unique on (docket_id, sku_id), so `services/issue.ts`
   * rejects a duplicate outright. Adding to the existing line is what the receipt
   * screen does with the same constraint, and it is what somebody counting a
   * trolley actually means.
   */
  const addLine = () => {
    basket.setValue((current) => {
      const existing = current.lines.find((line) => line.skuId === product.skuId)
      return {
        ...current,
        actionId,
        toLocationId: destination.id,
        lines: existing
          ? current.lines.map((line) =>
            line.skuId === product.skuId ? { ...line, containers: line.containers + containers } : line)
          : [...current.lines, { skuId: product.skuId, containers }],
      }
    })
  }

  const removeLine = (skuId: string) => {
    basket.setValue((current) => ({ ...current, lines: current.lines.filter((line) => line.skuId !== skuId) }))
  }

  const nameFor = (skuId: string) => options.products.find((item) => item.skuId === skuId)?.name ?? skuId
  const unitFor = (skuId: string) =>
    options.products.find((item) => item.skuId === skuId)?.containerUnitPlural.toLowerCase() ?? ''
  const stagedTotal = staged.reduce((sum, line) => sum + line.containers, 0)

  /**
   * BAR-176. The quantity handling here is unchanged — the previous
   * one-SKU-per-tap CHANGE button reset the unit and the count in exactly this
   * way, and whether that is right is BAR-177. Only how `next` is arrived at has
   * changed: chosen from a searchable list rather than the next index round.
   */
  const chooseProduct = (skuId: string) => {
    const next = options.products.find((item) => item.skuId === skuId)
    if (!next) return
    const hasFullCase = next.warehouseContainers >= next.unitsPerCase
    setProductId(next.skuId)
    setUnit(hasFullCase ? 'case' : 'container')
    setChosenContainers(
      hasFullCase
        ? initialContainers(next.unitsPerCase, next.warehouseContainers)
        : next.warehouseContainers,
    )
  }

  const equivalence = unit === 'case'
    ? `${displayQuantity} ${displayQuantity === 1 ? 'case' : 'cases'} = ${containers} ${unitWord}`
    : `${containers} ${unitWord} = ${caseCountLabel(containers, product.unitsPerCase)} cases`

  return (
    <div className="flow-screen">
      <FlowHeader title="Issue stock" onBack={() => void navigate({ to: '/warehouse' })} />

      <div className="issue-body">
        <div className="issue-route-picker">
          <div className="issue-route-from">
            <span>FROM</span>
            <strong>{options.fromName}</strong>
          </div>
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          <button
            className="issue-route-to"
            onClick={chooseNextDestination}
            disabled={destinationLocked}
            aria-label={destinationLocked ? `Destination fixed to ${destination.name} while lines are staged` : 'Change destination'}
          >
            <span>TO</span>
            <strong>{destination.name}</strong>
          </button>
        </div>
        {destinationLocked ? (
          <p className="flow-hint">
            This docket is going to {destination.name}. Remove the staged lines to send one somewhere else.
          </p>
        ) : null}

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
              <small>{product.issueSpec}</small>
            </span>
            <span className="issue-change">CHANGE</span>
          </span>
        </button>

        <section className="issue-quantity">
          <div className="issue-quantity-head">
            <span className="issue-label">QUANTITY</span>
            <div className="issue-unit-tabs">
              <button className={unit === 'case' ? 'active' : ''} onClick={() => chooseUnit('case')}>CASE</button>
              <button className={unit === 'container' ? 'active' : ''} onClick={() => chooseUnit('container')}>
                {product.containerUnitSingular}
              </button>
            </div>
          </div>

          <div className="issue-stepper">
            <button
              className="issue-minus"
              onClick={() => changeQuantity(-1)}
              disabled={containers <= minimum}
              aria-label="Decrease issue quantity"
            >
              <Minus size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <div>
              <strong>{displayQuantity}</strong>
              <span>{unit === 'case' ? (displayQuantity === 1 ? 'CASE' : 'CASES') : product.containerUnitPlural}</span>
            </div>
            <button
              className="issue-plus"
              onClick={() => changeQuantity(1)}
              disabled={containers >= maximum}
              aria-label="Increase issue quantity"
            >
              <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <p className="issue-equivalence">{equivalence}</p>

          <div className="issue-presets">
            {presets.map((preset) => {
              const presetContainers = unit === 'case' ? preset * product.unitsPerCase : preset
              return (
                <button
                  key={preset}
                  className={containers === presetContainers ? 'active' : ''}
                  disabled={presetContainers > product.warehouseContainers}
                  onClick={() => setChosenContainers(presetContainers)}
                >
                  {preset}{unit === 'case' ? ' CS' : ''}
                </button>
              )
            })}
          </div>
        </section>

        <div className="issue-after">
          <span>Warehouse after issue</span>
          <strong>
            {product.warehouseContainers} → {product.warehouseContainers - containers} {unitWord}
          </strong>
        </div>

        {/*
          BAR-177 / ADR-016. The line builder.

          The design draws one product and one REVIEW ISSUE button, and a
          single-product issue still works exactly that way — this button is
          additive, and with nothing staged the screen behaves as the design
          draws it. A restock is six to ten SKUs, and one docket per SKU means
          the bar lead accepts six to ten times.
        */}
        <button className="flow-cta-ghost issue-add" onClick={addLine} disabled={!canReview}>
          Add to docket
        </button>

        {staged.length > 0 ? (
          <section className="issue-staged">
            <span className="issue-label">
              ON THIS DOCKET · {staged.length} {staged.length === 1 ? 'LINE' : 'LINES'} · {stagedTotal} CONTAINERS
            </span>
            {staged.map((line) => (
              <div className="line-row" key={line.skuId}>
                <div>
                  <strong>{nameFor(line.skuId)}</strong>
                  <small>{line.containers} {unitFor(line.skuId)}</small>
                </div>
                <button onClick={() => removeLine(line.skuId)} aria-label={`Remove ${nameFor(line.skuId)}`}>
                  <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            ))}
            <p className="flow-hint">
              Everything on this list goes to {destination.name} as one docket, accepted once.
            </p>
          </section>
        ) : null}
      </div>

      <FlowFooter>
        {/*
          BAR-177. With nothing staged this is the design's button and the URL
          carries the single line, which is also how a home alert seeds an issue
          and how the fidelity gate reaches the review screen. With lines staged
          it reviews the basket, and says how many so that a quantity somebody
          set but did not add cannot be silently dropped without the count
          disagreeing with what they see.
        */}
        <button
          className="flow-cta"
          disabled={staged.length === 0 && !canReview}
          onClick={() => void navigate({
            to: '/issue/review',
            search: staged.length > 0
              ? { actionId, topUpRequestId: search.topUpRequestId, fromLocationId: options.fromLocationId, toLocationId: destination.id }
              : {
                actionId,
                topUpRequestId: search.topUpRequestId,
                fromLocationId: options.fromLocationId,
                toLocationId: destination.id,
                skuId: product.skuId,
                containers,
                unit,
              },
          })}
        >
          {staged.length > 0 ? `Review issue · ${staged.length} ${staged.length === 1 ? 'line' : 'lines'}` : 'Review issue'}
        </button>
      </FlowFooter>

      {pickerOpen && (
        <ProductPicker
          scope="issue"
          options={options.products.map((item) => ({
            id: item.skuId,
            name: item.name,
            detail: item.issueSpec,
          }))}
          selectedId={product.skuId}
          onSelect={chooseProduct}
          onDismiss={() => setPickerOpen(false)}
          returnFocusTo={productTriggerRef}
        />
      )}
    </div>
  )
}

/**
 * BAR-051 — issue stock.
 *
 * Values and interactions from design-markup.html:301-373 and
 * design-script.jsx:216-241. All operational values come from `issueOptions()`;
 * this screen contains no fixture SKU, location or stock figure.
 */
import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { caseCountLabel, issuePresets, issueStep, quantityFor, type IssueUnit } from '../../domain/units'
import { FlowFooter, FlowHeader } from '../custody/parts'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

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

  const chooseNextDestination = () => {
    const index = options.destinations.findIndex((item) => item.id === destination.id)
    const next = options.destinations[(index + 1) % options.destinations.length]
    if (next) setDestinationId(next.id)
  }

  const chooseNextProduct = () => {
    const index = options.products.findIndex((item) => item.skuId === product.skuId)
    const next = options.products[(index + 1) % options.products.length]
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
          <button className="issue-route-to" onClick={chooseNextDestination} aria-label="Change destination">
            <span>TO</span>
            <strong>{destination.name}</strong>
          </button>
        </div>

        <button className="issue-product" onClick={chooseNextProduct} aria-label="Change product">
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
      </div>

      <FlowFooter>
        <button
          className="flow-cta"
          disabled={!canReview}
          onClick={() => void navigate({
            to: '/issue/review',
            search: {
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
          Review issue
        </button>
      </FlowFooter>
    </div>
  )
}

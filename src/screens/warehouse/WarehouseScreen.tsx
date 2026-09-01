/**
 * BAR-049 — the warehouse screen, rebuilt to the approved design.
 *
 * Values from the `isWarehouse` branch of
 * references/design-source/design-markup.html:127-190. Compare against
 * references/ui/warehouse.png.
 *
 * The other screen `design-qa.md` declared "passed". It rendered a module-level
 * `warehouseCatalog` constant and a `warehouseTotals` object, so it could never
 * reflect a movement — and the two-fixture gate flagged it as hardcoded. Every
 * figure here now comes from the repository, and the category totals are derived
 * from the groups rather than being a second hand-maintained literal.
 *
 * Note the design's filter set is ALL / BEER / SPIRITS — it does not include
 * MIXERS, even though a MIXERS group exists in the catalogue. That is the
 * design's choice, reproduced rather than "corrected".
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useRepositoryMutation } from '../../data/RepositoryProvider'
import { cancelTopUp, type CancelTopUpInput } from '../../services/top-up'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

/** design-script.jsx: `['ALL', 'BEER', 'SPIRITS']`. MIXERS is deliberately absent. */
const FILTERS = ['ALL', 'BEER', 'SPIRITS'] as const
type Filter = (typeof FILTERS)[number]

export function WarehouseScreen() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const catalogue = useRepositoryQuery(['catalogue'], (r) => r.catalogue())
  const asOf = useRepositoryQuery(['asOf'], (r) => r.asOf())
  const topUps = useRepositoryQuery(['topUpRequests'], (r) => r.topUpRequests())
  const cancelActionIds = useRef(new Map<string, string>())
  const updateTopUp = useRepositoryMutation((repository, input: Omit<CancelTopUpInput, 'repository'>) => (
    cancelTopUp({ repository, ...input })
  ))

  const cancelRequest = (requestId: string) => {
    const actionId = cancelActionIds.current.get(requestId) ?? crypto.randomUUID()
    cancelActionIds.current.set(requestId, actionId)
    updateTopUp.mutate({ actionId, requestId }, {
      onSuccess: (outcome) => {
        if (outcome.status === 'posted') cancelActionIds.current.delete(requestId)
      },
    })
  }

  const groups = useMemo(() => {
    const all = catalogue.data ?? []
    const needle = query.trim().toLowerCase()
    return all
      .filter((group) => filter === 'ALL' || group.key === filter)
      .map((group) => ({
        ...group,
        items: needle
          ? group.items.filter((item) => `${item.name} ${item.spec}`.toLowerCase().includes(needle))
          : group.items,
      }))
      .filter((group) => group.items.length > 0)
  }, [catalogue.data, filter, query])

  // Derived from the catalogue, not a second literal to keep in step.
  const totals = useMemo(
    () =>
      (catalogue.data ?? []).map((group) => ({
        label: group.name,
        value: group.totalLabel.replace(/\s*CONTAINERS$/i, ''),
      })),
    [catalogue.data],
  )

  return (
    <div className="section-screen">
      <header className="wh-head">
        <div className="wh-head-row">
          <h1 className="section-head-title">Warehouse</h1>
          <span className="section-head-asof">AS OF {asOf.data?.label ?? '—'}</span>
        </div>

        <div className="wh-totals">
          {totals.map((total) => (
            <div className="wh-total" key={total.label}>
              <span>{total.label}</span>
              <strong>{total.value}</strong>
            </div>
          ))}
        </div>

        <div className="wh-actions">
          <button onClick={() => void navigate({ to: '/receipt' })}>Receive stock</button>
          <button className="primary" onClick={() => void navigate({ to: '/issue' })}>
            Issue to bar
          </button>
        </div>
      </header>

      <div className="wh-body">
        {/*
          BAR-165. Reformatted and given its own styling. This block reused
          `.wh-actions` for the row buttons — a warehouse-header rule carrying its
          own `margin-top` and sizing — inside a list row, and `.top-up-queue` had
          no rule in the stylesheet at all.
        */}
        {topUps.data && topUps.data.length > 0 ? (
          <section className="panel top-up-queue">
            <div className="section-label">
              TOP-UP REQUESTS
              <span>{topUps.data.length}</span>
            </div>
            {topUps.data.map((request) => (
              <div className="team-row" key={request.id}>
                <span>
                  <strong>{request.productName} · {request.requestedContainers}</strong>
                  <small>
                    {request.locationName} · {request.status.toUpperCase()} · {request.urgency.toUpperCase()}
                  </small>
                  {request.note ? <small>{request.note}</small> : null}
                </span>
                <span className="top-up-actions">
                  <button
                    onClick={() => void navigate({
                      to: '/issue',
                      search: {
                        topUpRequestId: request.id,
                        skuId: request.skuId,
                        toLocationId: request.locationId,
                        containers: request.requestedContainers,
                        unit: 'container',
                      },
                    })}
                  >
                    Issue
                  </button>
                  <button disabled={updateTopUp.isPending} onClick={() => cancelRequest(request.id)}>
                    Cancel
                  </button>
                </span>
              </div>
            ))}
          </section>
        ) : null}
        <div className="wh-tools">
          <label className="wh-search">
            <Search size={14} strokeWidth={2} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search SKU"
              aria-label="Search SKU"
            />
          </label>
          {FILTERS.map((option) => (
            <button
              key={option}
              className={`wh-filter ${option === filter ? 'active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {catalogue.isPending ? <ScreenSkeleton /> : null}
        {!catalogue.isPending && groups.length === 0 ? (
          <p className="section-empty wh-empty">No matching stock item.</p>
        ) : null}

        {groups.map((group) => (
          <section key={group.key}>
            <div className="wh-group-head">
              <span>{group.name}</span>
              <strong>{group.totalLabel}</strong>
            </div>
            {group.items.map((item) => (
              <div
                className="wh-item"
                key={item.skuId}
              >
                <div className="wh-item-main">
                  <strong>{item.name}</strong>
                  <span>{item.spec}</span>
                  <small>{item.lastMovement}</small>
                </div>
                <div className="wh-item-qty">
                  <strong className={`tone-${item.tone}`}>{item.primary}</strong>
                  <span>{item.secondary}</span>
                </div>
              </div>
            ))}
          </section>
        ))}
        <div className="wh-tail" />
      </div>
    </div>
  )
}

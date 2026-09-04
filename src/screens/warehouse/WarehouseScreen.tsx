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
 * BAR-174 — two corrections to that first rebuild, both measured in the running
 * app rather than argued about:
 *
 * 1. The design (design-markup.html:155-165) puts the search field and the
 *    filter chips on ONE row, search taking `flex:1`. Reproduced literally, the
 *    input measured **65.76 x 42 px** at a 375 px viewport and 15.3 px at 320 px
 *    — the placeholder rendered as "Search S". The design's own mock is drawn at
 *    a width where three chips still leave room; at the widths staff actually
 *    hold, three 44 px-tall chips (BAR-165 raised them from the design's 38 px
 *    for touch) eat the row and search collapses. Fidelity to a composition that
 *    measures out as a broken control is not fidelity; the two rows below keep
 *    every token, weight and colour of the design and change only the wrap.
 *
 * 2. The header reports BEER / SPIRITS / MIXERS but the chips were the design's
 *    hardcoded `['ALL', 'BEER', 'SPIRITS']`, so the 116 containers of mixers a
 *    manager can see in the summary could not be filtered to. The earlier note
 *    here called that "the design's choice, reproduced rather than corrected" —
 *    but the design's own catalogue has three groups and its own header counts
 *    them, so this was a design slip, not a design decision. The filter set is
 *    now derived from the groups the repository returns, which is also the only
 *    version that survives a category being added to the catalogue.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useRepositoryMutation } from '../../data/RepositoryProvider'
import { cancelTopUp, type CancelTopUpInput } from '../../services/top-up'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

/**
 * The one filter that is not a category: it means "do not narrow", so it cannot
 * come from the catalogue. Every other chip does.
 */
const ALL_FILTER = 'ALL'

/** Which edges of the chip scroller still have chips beyond them. */
type Fade = 'none' | 'start' | 'end' | 'both'

export function WarehouseScreen() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>(ALL_FILTER)
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

  /**
   * ALL, then one chip per group the repository returned, in catalogue order.
   * Nothing here names a category, so a category added to the data adds a chip
   * without a code change — which is the whole defect BAR-174 exists to fix.
   */
  const filters = useMemo(
    () => [ALL_FILTER, ...(catalogue.data ?? []).map((group) => group.key)],
    [catalogue.data],
  )

  /**
   * A chip can vanish under the selection — a category emptied out, or the
   * catalogue reloaded — and a selected filter matching nothing would leave the
   * screen showing "No matching stock item" with no chip lit to explain why.
   * Fall back to ALL rather than stranding the user in an unexplained empty list.
   */
  const activeFilter = filters.includes(filter) ? filter : ALL_FILTER

  const groups = useMemo(() => {
    const all = catalogue.data ?? []
    const needle = query.trim().toLowerCase()
    return all
      .filter((group) => activeFilter === ALL_FILTER || group.key === activeFilter)
      .map((group) => ({
        ...group,
        items: needle
          ? group.items.filter((item) => `${item.name} ${item.spec}`.toLowerCase().includes(needle))
          : group.items,
      }))
      .filter((group) => group.items.length > 0)
  }, [catalogue.data, activeFilter, query])

  /**
   * The chips scroll now that there can be any number of them, and a row that
   * silently hides its last option is the very defect this task is fixing on
   * the search field. So track which edges still have chips beyond them and let
   * the stylesheet fade that edge — measured, not assumed, because a fade that
   * is always on lies about a row with nothing more to show.
   */
  const filterRow = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<Fade>('none')

  useEffect(() => {
    const row = filterRow.current
    if (!row) return
    const update = () => {
      const overflow = row.scrollWidth - row.clientWidth
      if (overflow <= 1) {
        setFade('none')
        return
      }
      const more = { start: row.scrollLeft > 1, end: row.scrollLeft < overflow - 1 }
      setFade(more.start && more.end ? 'both' : more.start ? 'start' : 'end')
    }
    update()
    row.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(row)
    return () => {
      row.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [filters])

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
          <div className="wh-filters" ref={filterRow} data-fade={fade}>
            {filters.map((option) => (
              <button
                key={option}
                className={`wh-filter ${option === activeFilter ? 'active' : ''}`}
                aria-pressed={option === activeFilter}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
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

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react'
import { useAuth } from './auth'
import { loadLiveSnapshot, locationFor, queueLiveMovement, type LiveContext } from './live-repository'
import { getQueueSummary } from './offline-db'

export type StaffRole = 'Crew' | 'Manager'

export type StockItem = {
  id: string
  name: string
  category: string
  categoryKey: 'bottled_beer' | 'draught_beer' | 'spirits' | 'mixers'
  container: string
  mlPerContainer: number
  warehouse: number
  bar3: number
  status: 'healthy' | 'watch' | 'critical'
}

export type ActivityItem = {
  id: string
  at: string
  kind: string
  title: string
  detail: string
  actor: string
  tone: 'green' | 'gold' | 'red' | 'neutral'
}

export type Docket = {
  id: string
  token: string
  from: string
  to: string
  skuId: string
  quantity: number
  issuedBy: string
  issuedAt: string
  acceptedBy?: string
  acceptedAt?: string
  acceptedQuantity?: number
  differenceReason?: string
  status: 'awaiting' | 'accepted' | 'accepted_short'
}

type State = {
  backendMode: 'demo' | 'live'
  dataLoading: boolean
  dataError?: string
  activeVenueName?: string
  liveContext?: LiveContext
  role: StaffRole
  offline: boolean
  pending: number
  toast?: string
  stock: StockItem[]
  activity: ActivityItem[]
  dockets: Docket[]
}

type Action =
  | { type: 'role'; role: StaffRole }
  | { type: 'offline'; value: boolean }
  | { type: 'toast'; message?: string }
  | { type: 'issue'; docket: Docket }
  | { type: 'accept'; docketId: string; quantity: number; actor: string; reason?: string }
  | { type: 'waste'; skuId: string; quantity: number; reason: string; actor: string }
  | { type: 'hydrate-live'; stock: StockItem[]; activity: ActivityItem[]; context: LiveContext; venueName: string; role: StaffRole }
  | { type: 'live-error'; message: string }
  | { type: 'pending'; count: number }

const stock: StockItem[] = [
  { id: 'kf', name: 'Kingfisher Premium', category: 'Bottled beer', categoryKey: 'bottled_beer', container: '650 ml bottle', mlPerContainer: 650, warehouse: 288, bar3: 12, status: 'critical' },
  { id: 'bud', name: 'Budweiser', category: 'Bottled beer', categoryKey: 'bottled_beer', container: '500 ml can', mlPerContainer: 500, warehouse: 144, bar3: 36, status: 'healthy' },
  { id: 'corona', name: 'Corona Extra', category: 'Bottled beer', categoryKey: 'bottled_beer', container: '355 ml bottle', mlPerContainer: 355, warehouse: 96, bar3: 19, status: 'watch' },
  { id: 'stok', name: 'STOK Draught', category: 'Draught beer', categoryKey: 'draught_beer', container: '30 L keg', mlPerContainer: 30_000, warehouse: 4, bar3: 3, status: 'watch' },
  { id: 'monk', name: 'Old Monk', category: 'Spirits', categoryKey: 'spirits', container: '750 ml bottle · tare 480 g', mlPerContainer: 750, warehouse: 58, bar3: 15, status: 'healthy' },
  { id: 'coke', name: 'Coca-Cola', category: 'Mixers', categoryKey: 'mixers', container: '300 ml can', mlPerContainer: 300, warehouse: 48, bar3: 22, status: 'healthy' },
]

const activity: ActivityItem[] = [
  { id: 'a1', at: '19:38', kind: 'TRANSFER', title: 'Docket D-0183 accepted', detail: 'Warehouse → Bar 1 · 24 Kingfisher', actor: 'Chandan → Aditi', tone: 'green' },
  { id: 'a2', at: '19:22', kind: 'WASTE', title: 'Waste recorded', detail: 'Bar 2 · 2 Corona · breakage', actor: 'Gabe', tone: 'red' },
  { id: 'a3', at: '19:18', kind: 'COUNT', title: 'Mid-count started', detail: 'Bar 1 · blind · 18 lines', actor: 'Chandan', tone: 'neutral' },
  { id: 'a4', at: '18:52', kind: 'ADJUSTMENT', title: 'Signed correction', detail: 'Bar 4 · +12 Budweiser · incorrect issue', actor: 'Salman', tone: 'red' },
]

/**
 * BAR-008. A second fixture set, used only by the visual harness.
 *
 * The harness renders every screen against both sets and fails any screen whose
 * two renders are byte-identical, because that proves the screen is not reading
 * the data layer at all. This is the gate whose absence let `home` and
 * `warehouse` pass design QA while displaying hardcoded literals: a screenshot
 * comparison rewards typing the screenshot's values into JSX, and a two-state
 * comparison cannot be satisfied that way.
 *
 * This is a temporary seam. BAR-042/BAR-043 replace it with a real fixture
 * repository selected at bootstrap; the harness then swaps repositories instead
 * of reading a query parameter.
 */
const stockVariant: StockItem[] = stock.map((item, index) => ({
  ...item,
  // Vary the name as well as the quantities. Some screens legitimately show no
  // quantity at all — the blind count is required to hide them — so a
  // quantity-only variant would flag those screens as hardcoded when they are
  // behaving correctly. A gate that cries wolf gets switched off.
  name: `${item.name} (v2)`,
  warehouse: item.warehouse + 7 * (index + 1),
  bar3: item.bar3 + (index + 1),
}))

const activityVariant: ActivityItem[] = activity.map((item, index) => ({
  ...item,
  title: `${item.title} (v2)`,
  at: `18:${String(10 + index * 3).padStart(2, '0')}`,
}))

function fixtureVariant(): 'a' | 'b' {
  if (import.meta.env.PROD) return 'a'
  if (typeof window === 'undefined') return 'a'
  return new URLSearchParams(window.location.search).get('fixture') === 'b' ? 'b' : 'a'
}

const initialState: State = {
  backendMode: 'demo',
  dataLoading: false,
  role: 'Manager',
  offline: false,
  pending: 0,
  stock: fixtureVariant() === 'b' ? stockVariant : stock,
  activity: fixtureVariant() === 'b' ? activityVariant : activity,
  dockets: [],
}

function nowLabel() {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(new Date())
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate-live':
      return { ...state, backendMode: 'live', dataLoading: false, dataError: undefined, stock: action.stock, activity: action.activity, liveContext: action.context, activeVenueName: action.venueName, role: action.role }
    case 'live-error':
      return { ...state, backendMode: 'live', dataLoading: false, dataError: action.message, toast: `LIVE DATA ERROR · ${action.message}` }
    case 'pending':
      return { ...state, pending: action.count }
    case 'role':
      return { ...state, role: action.role, toast: `${action.role.toUpperCase()} VIEW ACTIVE` }
    case 'offline':
      return {
        ...state,
        offline: action.value,
        toast: action.value ? 'OFFLINE MODE · ACTIONS WILL QUEUE' : 'BACK ONLINE · READY TO SYNC',
      }
    case 'toast':
      return { ...state, toast: action.message }
    case 'issue': {
      const item = state.stock.find((candidate) => candidate.id === action.docket.skuId)
      return {
        ...state,
        pending: state.pending + (state.offline ? 1 : 0),
        dockets: [action.docket, ...state.dockets],
        stock: state.stock.map((candidate) =>
          candidate.id === action.docket.skuId
            ? { ...candidate, warehouse: Math.max(0, candidate.warehouse - action.docket.quantity) }
            : candidate,
        ),
        activity: [
          {
            id: crypto.randomUUID(),
            at: nowLabel(),
            kind: 'ISSUE',
            title: `Docket ${action.docket.id} issued`,
            detail: `${action.docket.from} → ${action.docket.to} · ${action.docket.quantity} ${item?.name ?? 'items'}`,
            actor: action.docket.issuedBy,
            tone: 'gold',
          },
          ...state.activity,
        ],
        toast: `${action.docket.id} CREATED · AWAITING ACCEPTANCE`,
      }
    }
    case 'accept': {
      const docket = state.dockets.find((candidate) => candidate.id === action.docketId)
      if (!docket || docket.status !== 'awaiting') return state
      const acceptedShort = action.quantity !== docket.quantity
      return {
        ...state,
        pending: state.pending + (state.offline ? 1 : 0),
        dockets: state.dockets.map((candidate) =>
          candidate.id === action.docketId
            ? {
                ...candidate,
                acceptedBy: action.actor,
                acceptedAt: nowLabel(),
                acceptedQuantity: action.quantity,
                differenceReason: action.reason,
                status: acceptedShort ? 'accepted_short' : 'accepted',
              }
            : candidate,
        ),
        stock: state.stock.map((candidate) =>
          candidate.id === docket.skuId
            ? { ...candidate, bar3: candidate.bar3 + action.quantity }
            : candidate,
        ),
        activity: [
          {
            id: crypto.randomUUID(),
            at: nowLabel(),
            kind: 'TRANSFER',
            title: acceptedShort ? `${docket.id} accepted short` : `${docket.id} accepted`,
            detail: `${docket.from} → ${docket.to} · ${action.quantity} received`,
            actor: `${docket.issuedBy} → ${action.actor}`,
            tone: acceptedShort ? 'red' : 'green',
          },
          ...state.activity,
        ],
        toast: acceptedShort
          ? `RECEIVED ${action.quantity} · DIFFERENCE OPEN`
          : `RECEIVED ${action.quantity} · DOCKET CLOSED`,
      }
    }
    case 'waste': {
      const item = state.stock.find((candidate) => candidate.id === action.skuId)
      return {
        ...state,
        pending: state.pending + (state.offline ? 1 : 0),
        stock: state.stock.map((candidate) =>
          candidate.id === action.skuId
            ? { ...candidate, bar3: Math.max(0, candidate.bar3 - action.quantity) }
            : candidate,
        ),
        activity: [
          {
            id: crypto.randomUUID(),
            at: nowLabel(),
            kind: 'WASTE',
            title: 'Waste recorded',
            detail: `Bar 3 · ${action.quantity} ${item?.name ?? 'items'} · ${action.reason}`,
            actor: action.actor,
            tone: 'red',
          },
          ...state.activity,
        ],
        toast: `${action.quantity} ${item?.name.toUpperCase() ?? 'ITEMS'} RECORDED · ${action.reason.toUpperCase()}`,
      }
    }
  }
}

type DemoStore = State & {
  setRole: (role: StaffRole) => void
  setOffline: (value: boolean) => void
  flash: (message: string) => void
  issue: (input: { to: string; skuId: string; quantity: number }) => Docket
  accept: (input: { docketId: string; quantity: number; reason?: string }) => void
  waste: (input: { skuId: string; quantity: number; reason: string }) => void
}

const DemoStoreContext = createContext<DemoStore | null>(null)

export function DemoStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const auth = useAuth()

  useEffect(() => {
    if (auth.mode !== 'live' || !auth.activeMembership) return
    let active = true
    void loadLiveSnapshot(auth.activeMembership.venueId).then((snapshot) => {
      if (!active) return
      const managerRoles = ['manager', 'auditor', 'admin']
      dispatch({
        type: 'hydrate-live',
        ...snapshot,
        venueName: auth.activeMembership!.venueName,
        role: managerRoles.includes(auth.activeMembership!.role) ? 'Manager' : 'Crew',
      })
    }).catch((caught) => {
      if (active) dispatch({ type: 'live-error', message: caught instanceof Error ? caught.message : 'Unable to load inventory' })
    })
    return () => { active = false }
  }, [auth.activeMembership, auth.mode])

  useEffect(() => {
    const refresh = () => void getQueueSummary().then((summary) => dispatch({ type: 'pending', count: summary.pending + summary.failed }))
    refresh()
    window.addEventListener('boa:queue-change', refresh)
    return () => window.removeEventListener('boa:queue-change', refresh)
  }, [])

  const flash = useCallback((message: string) => {
    dispatch({ type: 'toast', message })
    window.setTimeout(() => dispatch({ type: 'toast', message: undefined }), 2400)
  }, [])

  const value = useMemo<DemoStore>(() => ({
    ...state,
    setRole: (role) => dispatch({ type: 'role', role }),
    setOffline: (value) => dispatch({ type: 'offline', value }),
    flash,
    issue: ({ to, skuId, quantity }) => {
      const docket: Docket = {
        id: `D-${String(184 + state.dockets.length).padStart(4, '0')}`,
        token: crypto.randomUUID(),
        from: 'Warehouse',
        to,
        skuId,
        quantity,
        issuedBy: 'Chandan',
        issuedAt: nowLabel(),
        status: 'awaiting',
      }
      dispatch({ type: 'issue', docket })
      if (state.liveContext) {
        const item = state.stock.find((candidate) => candidate.id === skuId)
        const warehouse = state.liveContext.locations.find((location) => location.kind === 'warehouse')
        const transit = state.liveContext.locations.find((location) => location.kind === 'in_transit')
        if (item && warehouse && transit) void queueLiveMovement({ context: state.liveContext, kind: 'issue', skuId, containerQuantity: quantity, mlQuantity: quantity * item.mlPerContainer, fromLocationId: warehouse.id, toLocationId: transit.id, metadata: { local_docket_no: docket.id, destination: to } })
      }
      return docket
    },
    accept: ({ docketId, quantity, reason }) => {
      const docket = state.dockets.find((candidate) => candidate.id === docketId)
      dispatch({ type: 'accept', docketId, quantity, reason, actor: auth.user?.email ?? 'Rahul' })
      if (docket && state.liveContext) {
        const item = state.stock.find((candidate) => candidate.id === docket.skuId)
        const transit = state.liveContext.locations.find((location) => location.kind === 'in_transit')
        const destination = locationFor(state.liveContext, docket.to)
        if (item && transit && destination) void queueLiveMovement({ context: state.liveContext, kind: 'transfer', skuId: docket.skuId, containerQuantity: quantity, mlQuantity: quantity * item.mlPerContainer, fromLocationId: transit.id, toLocationId: destination.id, reason, metadata: { local_docket_no: docket.id, issued_quantity: docket.quantity } })
      }
    },
    waste: ({ skuId, quantity, reason }) => {
      dispatch({ type: 'waste', skuId, quantity, reason, actor: auth.user?.email ?? 'Rahul' })
      if (state.liveContext) {
        const item = state.stock.find((candidate) => candidate.id === skuId)
        const bar3 = state.liveContext.locations.find((location) => location.code === 'bar_3')
        if (item && bar3) void queueLiveMovement({ context: state.liveContext, kind: 'waste', skuId, containerQuantity: quantity, mlQuantity: quantity * item.mlPerContainer, fromLocationId: bar3.id, reason, metadata: { location_code: 'bar_3' } })
      }
    },
  }), [auth.user?.email, flash, state])

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>
}

export function useDemoStore() {
  const store = useContext(DemoStoreContext)
  if (!store) throw new Error('useDemoStore must be used inside DemoStoreProvider')
  return store
}

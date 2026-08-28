import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppShell } from './AppShell'
import { NotFound, RouteError } from './ErrorScreen'
import { BarsScreen } from '../screens/bars/BarsScreen'
import { BarScreen } from '../screens/bar/BarScreen'
import { ActivityScreen } from '../screens/activity/ActivityScreen'
import { MoreScreen } from '../screens/more/MoreScreen'
import { HomeScreen } from '../screens/home/HomeScreen'
import { WarehouseScreen } from '../screens/warehouse/WarehouseScreen'
import { ReviewScreen } from '../screens/custody/ReviewScreen'
import { DocketScreen } from '../screens/custody/DocketScreen'
import { AcceptScreen } from '../screens/custody/AcceptScreen'
import { ReceivedScreen } from '../screens/custody/ReceivedScreen'
import { CountScreen } from '../screens/count/CountScreen'
import { CountDoneScreen } from '../screens/count/CountDoneScreen'
import { VarianceScreen } from '../screens/count/VarianceScreen'
import { IssueScreen } from '../screens/issue/IssueScreen'
import { parseIssueDraftSearch } from '../screens/issue/draft'
import {
  ReportsScreen,
  WasteScreen,
} from '../features/screens'

const rootRoute = createRootRoute({ component: AppShell })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen })
const warehouseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/warehouse', component: WarehouseScreen })
const barsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/bars', component: BarsScreen })
// BAR-061 — the bar workspace, the screen spec §14 says "has to be excellent".
// Route declared so the bars list is not a dead end; screen lands next.
const barRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bars/$barId',
  component: BarScreen,
})
const activityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/activity', component: ActivityScreen })
const moreRoute = createRoute({ getParentRoute: () => rootRoute, path: '/more', component: MoreScreen })
const issueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issue',
  component: IssueScreen,
  validateSearch: parseIssueDraftSearch,
})
const wasteRoute = createRoute({ getParentRoute: () => rootRoute, path: '/waste', component: WasteScreen })
const countRoute = createRoute({ getParentRoute: () => rootRoute, path: '/count', component: CountScreen })
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsScreen })
const countDoneRoute = createRoute({ getParentRoute: () => rootRoute, path: '/count/submitted', component: CountDoneScreen })
const varianceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/variance', component: VarianceScreen })
// The custody chain, as five design screens rather than one collapsed page.
// `diff` is deliberately absent: it is the accept screen with its difference
// panel open, not a route (design-script.jsx `toggleDiff`).
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issue/review',
  component: ReviewScreen,
  validateSearch: parseIssueDraftSearch,
})
const docketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dockets/$docketId',
  component: DocketScreen,
})
const acceptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dockets/$docketId/accept',
  component: AcceptScreen,
})
const receivedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dockets/$docketId/received',
  component: ReceivedScreen,
  validateSearch: (search: Record<string, unknown>): { qty?: number; reason?: string } => ({
    qty: search.qty === undefined ? undefined : Number(search.qty),
    reason: search.reason === undefined ? undefined : String(search.reason),
  }),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  warehouseRoute,
  barsRoute,
  activityRoute,
  moreRoute,
  issueRoute,
  wasteRoute,
  countRoute,
  reportsRoute,
  docketRoute,
  reviewRoute,
  acceptRoute,
  receivedRoute,
  countDoneRoute,
  varianceRoute,
  barRoute,
])

/**
 * BAR-047. Router-level defaults rather than per-route components: a new route
 * must not be able to arrive without an error boundary, and 16 routes each
 * declaring their own would be 16 chances to forget.
 */
export const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error, reset }) => <RouteError error={error} reset={reset} />,
  defaultNotFoundComponent: () => <NotFound />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppShell } from './AppShell'
import { BarsScreen } from '../screens/bars/BarsScreen'
import { BarScreen } from '../screens/bar/BarScreen'
import { ActivityScreen } from '../screens/activity/ActivityScreen'
import {
  CountScreen,
  DocketScreen,
  HomeScreen,
  IssueScreen,
  MoreScreen,
  ReportsScreen,
  WarehouseScreen,
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
const issueRoute = createRoute({ getParentRoute: () => rootRoute, path: '/issue', component: IssueScreen })
const wasteRoute = createRoute({ getParentRoute: () => rootRoute, path: '/waste', component: WasteScreen })
const countRoute = createRoute({ getParentRoute: () => rootRoute, path: '/count', component: CountScreen })
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsScreen })
const docketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dockets/$docketId',
  component: DocketScreen,
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
  barRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Activity, BatteryMedium, Boxes, Home, Menu, Star, Store, Wifi, WifiOff } from 'lucide-react'
import { useDemoStore } from '../lib/demo-store'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/warehouse', label: 'Warehouse', icon: Boxes },
  { to: '/bars', label: 'Bars', icon: Store },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/more', label: 'More', icon: Menu },
] as const

export function AppShell() {
  const store = useDemoStore()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const fullFlow = ['/issue', '/waste', '/count'].some((path) => pathname.startsWith(path)) || pathname.startsWith('/dockets/')
  const isHome = pathname === '/'
  const caption = pathname === '/' ? 'LIVE HOME' : pathname.replace(/^\//, '').replaceAll('-', ' ').toUpperCase()

  return (
    <div className="app-stage">
      <div className="app-shell">
        <div className="status-line" aria-hidden="true">
          <span>19:44</span>
          <span className="status-network"><BatteryMedium size={16} strokeWidth={1.7} />4G</span>
        </div>

        {isHome && <header className="app-header">
          <div className="brand-line">
            <div className="brand-lockup">
              <img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />
              <i />
              <div>
                <strong>BAR CONTROL</strong>
                <span>BOA 2026</span>
              </div>
            </div>
            <Link className="manager-shortcut" to="/more" aria-label="Open manager controls">
              <Star size={17} strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </div>
          <button className={`sync-line ${store.offline ? 'offline' : ''}`} onClick={() => store.setOffline(!store.offline)}>
            <span>
              {store.offline ? <WifiOff size={13} /> : <Wifi size={13} />}
              {store.offline ? `OFFLINE · ${store.pending} PENDING` : store.backendMode === 'live' ? `SYNCED · ${store.pending} PENDING` : 'LIVE · 19:44 IST'}
            </span>
            <small>{store.dataError ? 'DATA NEEDS ATTENTION' : store.backendMode === 'live' ? store.activeVenueName : store.offline ? 'LAST SYNC 19:42' : 'LAST SYNCED 19:43'}</small>
          </button>
        </header>}

        <main className={`app-main ${fullFlow ? 'full-flow' : ''} ${isHome ? 'home-main' : 'section-main'}`}>
          <Outlet />
        </main>

        {!fullFlow && (
          <nav className="bottom-nav" aria-label="Primary navigation">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} activeOptions={{ exact: to === '/' }} className="nav-item">
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}
        {store.toast && <div className="toast" role="status">{store.toast}</div>}
      </div>
      <div className="stage-caption" aria-hidden="true">BOA BAR INVENTORY / 390 × 844 / {caption}</div>
    </div>
  )
}

import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Activity, BatteryMedium, Boxes, Home, Menu, Star, Store, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import { useDemoStore } from '../lib/demo-store'
import { configError } from '../lib/supabase'

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
  const isDemo = store.backendMode !== 'live'

  // BAR-139. A production build with no Supabase configuration must not run at
  // all. Silently serving fixtures is the failure mode this guard exists for.
  if (configError) {
    return (
      <div className="app-stage">
        <div className="config-error" role="alert">
          <TriangleAlert size={28} strokeWidth={1.7} aria-hidden="true" />
          <strong>NOT CONFIGURED</strong>
          <p>{configError}</p>
          <small>Set the Supabase environment variables in the hosting project and redeploy.</small>
        </div>
      </div>
    )
  }

  return (
    <div className="app-stage">
      <div className="app-shell">
        {/*
          BAR-139. Demo mode must be unmistakable on every screen, not only on
          home — the header below renders on the home route alone, so a warning
          placed inside it would be invisible on the other 21 screens.
        */}
        {isDemo && (
          <div className="demo-banner" role="status">
            <TriangleAlert size={12} strokeWidth={2} aria-hidden="true" />
            DEMO DATA · NOT LIVE · NOTHING IS RECORDED
          </div>
        )}
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
          {/*
            BAR-139. This line previously read `SYNCED` in live mode and
            `LIVE · 19:44 IST` in demo mode — exactly backwards. Demo is also the
            state a failed or unconfigured live load falls into, so a single
            missing environment variable presented fixture data as live.
            Demo must always announce itself as demo.
          */}
          <button className={`sync-line ${isDemo ? 'demo' : ''} ${store.offline ? 'offline' : ''}`} onClick={() => store.setOffline(!store.offline)}>
            <span>
              {isDemo ? <TriangleAlert size={13} /> : store.offline ? <WifiOff size={13} /> : <Wifi size={13} />}
              {isDemo
                ? 'DEMO DATA'
                : store.offline
                  ? `OFFLINE · ${store.pending} PENDING`
                  : `LIVE · ${store.pending} PENDING`}
            </span>
            <small>
              {isDemo
                ? 'NOT LIVE'
                : store.dataError
                  ? 'DATA NEEDS ATTENTION'
                  : store.activeVenueName}
            </small>
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

import { useEffect, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BatteryMedium, Star, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '../lib/app-store'
import { BottomNav } from '../components/layout/BottomNav'
import { configError } from '../lib/supabase'
import { applyUpdate, onUpdateAvailability } from '../lib/pwa-update'
import { useRepository } from '../data/RepositoryProvider'

export function AppShell() {
  const store = useAppStore()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const fullFlow = ['/issue', '/waste', '/count'].some((path) => pathname.startsWith(path))
    || /^\/bars\/[^/]+\/waste$/.test(pathname)
    || pathname.startsWith('/dockets/')
  const isHome = pathname === '/'
  const caption = pathname === '/' ? 'LIVE HOME' : pathname.replace(/^\//, '').replaceAll('-', ' ').toUpperCase()
  /**
   * BAR-042. Whether this session is live is a property of the repository that is
   * actually answering reads — not of `demo-store`, which reports `live` once its
   * own legacy snapshot load succeeds and would therefore label fixture-served
   * screens as live. There is one honest answer and this is it.
   */
  const isDemo = useRepository().kind !== 'live'

  // BAR-138. A waiting service worker previously had no way to be activated, so
  // a device stayed on whatever bundle it first cached. Surfaced rather than
  // auto-reloading, because reloading under someone mid-count loses their input.
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => onUpdateAvailability(setUpdateReady), [])

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
          {/*
            BAR-077. No longer a button. This toggled `offline` by hand — a demo
            switch shipped as a user-facing control, which made the one indicator
            telling staff whether their work had been sent mean nothing. Connection
            state now comes from the browser and the count from the outbox, so the
            line reports rather than pretends.
          */}
          <div className={`sync-line ${isDemo ? 'demo' : ''} ${store.offline ? 'offline' : ''}`}>
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
                : store.failed > 0
                  ? `${store.failed} NOT SENT · NEEDS ATTENTION`
                  : store.activeVenueName}
            </small>
          </div>
        </header>}

        <main className={`app-main ${fullFlow ? 'full-flow' : ''} ${isHome ? 'home-main' : 'section-main'}`}>
          <Outlet />
        </main>

        {!fullFlow && <BottomNav />}
        {updateReady && (
          <button className="update-bar" onClick={() => void applyUpdate()}>
            NEW VERSION READY · TAP TO UPDATE
          </button>
        )}
        {store.toast && <div className="toast" role="status">{store.toast}</div>}
      </div>
      <div className="stage-caption" aria-hidden="true">BOA BAR INVENTORY / 390 × 844 / {caption}</div>
    </div>
  )
}

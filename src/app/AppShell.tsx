import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { CloudUpload, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
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
    || /^\/bars\/[^/]+\/count(?:\/submitted)?$/.test(pathname)
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
        {/*
          BAR-167. Queue and connection state, on every route.
          Deliberately placed above the screen's own header rather than inside
          it: a flow screen renders no app header at all, and the four write
          flows are exactly where a person most needs to know whether their work
          left the phone.
        */}
        {!isDemo && <OperationalStatus />}
        {isHome && <header className="app-header">
          <div className="brand-line">
            <div className="brand-lockup">
              <img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />
              <i />
              {/*
                BAR-165. No eyebrow under the lockup. The design has `BOA 2026`
                here and BAR-165 first restored it, but the user removed it on
                review: the logo already says which festival this is, and the
                header's job on a working screen is stock and queue state, not
                branding. Recorded in ADR-015.
              */}
              <div>
                <strong>BAR CONTROL</strong>
              </div>
            </div>
          </div>
          {/*
            BAR-139. This line previously reported a fixed live timestamp in demo
            mode — exactly backwards. Demo is also the
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
          {/*
            BAR-167. This line no longer reports the queue.
            `OperationalStatus` below does, on every route rather than on this
            one — so the pending count, the offline state and a failed write are
            not duplicated here, where twenty-one screens could not see them.
            What is left is the one thing that is only true of the shell: whether
            this session is live at all.
          */}
          {/*
            BAR-184. This line no longer repeats the demo warning. The red banner
            at the top of the shell already says DEMO DATA · NOT LIVE · NOTHING IS
            RECORDED, and home rendered the same two words again a few pixels
            below it — the only screen in the app that warned twice. Two copies of
            one warning do not double the warning; they teach people that the top
            of the screen is boilerplate to be scrolled past, and this is the
            warning that must still land at 2am.
            The banner owns "is this real". What is left here is the one thing the
            banner does not say: whether this device is reachable. In demo mode
            that is reported as ONLINE / OFFLINE rather than LIVE, because LIVE is
            the word this app uses for a real venue and demo is never that.
          */}
          <div className={`sync-line ${store.offline ? 'offline' : ''}`}>
            <span>
              {store.offline ? <WifiOff size={13} /> : <Wifi size={13} />}
              {store.offline ? 'OFFLINE' : isDemo ? 'ONLINE' : 'LIVE'}
            </span>
            <small />
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
        {/*
          BAR-165. The toast was pinned at `top: 118px`, which is the height of
          the home header — the only screen with one. Everywhere else it landed
          on top of the first card: on Settings it covered the SIGNED IN row it
          was reporting about. It now sits at the foot, clear of the navigation,
          and clear of the taller footer on a flow screen.
        */}
        {/*
          BAR-168. The toast can now carry one action, which is only ever an
          undo. It is `pointer-events: none` without one and tappable with one,
          so a confirmation still cannot swallow a tap meant for the screen
          underneath it.
        */}
        {store.toast && (
          <div className={`toast ${fullFlow ? 'is-flow' : ''} ${store.toast.action ? 'has-action' : ''}`} role="status">
            <span>{store.toast.message}</span>
            {store.toast.action && (
              <button
                onClick={() => {
                  store.toast?.action?.run()
                  store.dismissToast()
                }}
              >
                {store.toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="stage-caption" aria-hidden="true">BOA BAR INVENTORY / 390 × 844 / {caption}</div>
    </div>
  )
}

/**
 * BAR-167 — whether this device is holding work that has not been sent.
 *
 * Before this, the answer existed on the home route only (BAR-039's sync strip,
 * rendered inside `{isHome && <header>}`). Every write flow — issue, accept,
 * waste, count — hides both the header and the bottom navigation, so the four
 * screens where somebody actually commits a movement were the four screens that
 * could not tell them whether it had gone anywhere. The outbox underneath is
 * sound; it was simply invisible.
 *
 * Three rules, in order of what the person needs to do about it:
 *
 *   FAILED    a write has given up, or the session expired and the drain is
 *             paused. This is the only state that needs a decision, so it is the
 *             only one that is tappable — it goes to More, where the retry and
 *             the exact server refusal live.
 *   OFFLINE   the browser reports no connection. Shown even with an empty queue:
 *             knowing the network is gone BEFORE starting a count is worth more
 *             than being told afterwards.
 *   QUEUED    online, with work still draining. Reassurance, not an alarm.
 *
 * Silence is the healthy state. Online with an empty queue renders nothing —
 * a permanent green tick trains people to stop reading the strip, and this strip
 * has to still mean something at 2am.
 */
function OperationalStatus() {
  const store = useAppStore()
  const navigate = useNavigate()

  const failed = store.authStopped || store.failed > 0
  if (!failed && !store.offline && store.pending === 0) return null

  const pendingLabel = `${store.pending} QUEUED`

  if (failed) {
    return (
      <button
        className="op-status failed"
        onClick={() => void navigate({ to: '/more' })}
      >
        <TriangleAlert size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{store.authStopped ? 'SIGN IN AGAIN TO SYNC' : `${store.failed} NOT SENT`}</span>
        <small>TAP TO FIX</small>
      </button>
    )
  }

  if (store.offline) {
    return (
      <div className="op-status offline" role="status">
        <WifiOff size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{store.pending > 0 ? `OFFLINE · ${pendingLabel}` : 'OFFLINE'}</span>
        <small>{store.pending > 0 ? 'SAVED ON THIS DEVICE' : 'NOTHING WAITING TO SEND'}</small>
      </div>
    )
  }

  return (
    <div className="op-status sending" role="status">
      <CloudUpload size={13} strokeWidth={2.2} aria-hidden="true" />
      <span>{pendingLabel}</span>
      <small>SENDING</small>
    </div>
  )
}

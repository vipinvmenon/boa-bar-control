/**
 * BAR-047 — what the app shows when something fails.
 *
 * Three surfaces, because there are three ways this app can fail and the previous
 * version handled none of them:
 *
 *   `RouteError`   an uncaught throw while rendering a route, including a failed
 *                  repository read (see below)
 *   `NotFound`     a URL with no route — reachable from a stale bookmark, a
 *                  mistyped deep link, or a QR code pointing at a removed screen
 *   `AppErrorBoundary`
 *                  a throw above the router: a provider, the auth gate, the
 *                  repository selection
 *
 * Why this matters more than it looks. The live repository throws on a failed
 * read, deliberately — the alternative is serving the design's sample stock as
 * live festival inventory (BAR-067). Without a boundary that throw blanked the
 * app, so the honest failure mode was indistinguishable from a crash.
 *
 * The design has no error screen, so this is not a reproduction of one. It uses
 * the design system's own vocabulary — panel surface, Oswald caps, the sage-alpha
 * scale, `--red` for the rule — and stays deliberately plain: an error screen that
 * tries to look designed reads as a feature, and this is not one.
 */
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert, Unplug } from 'lucide-react'

/** The message, without leaking a stack trace into a bar's phone. */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'No detail was recorded.'
}

type FailureProps = {
  eyebrow: string
  title: string
  detail: string
  hint: string
  icon: ReactNode
  actionLabel: string
  onAction: () => void
}

function Failure({ eyebrow, title, detail, hint, icon, actionLabel, onAction }: FailureProps) {
  return (
    <div className="failure-screen" role="alert">
      <div className="failure-card">
        <span className="failure-icon" aria-hidden="true">{icon}</span>
        <span className="failure-eyebrow">{eyebrow}</span>
        <strong className="failure-title">{title}</strong>
        <p className="failure-detail">{detail}</p>
        <small className="failure-hint">{hint}</small>
        <button className="failure-action" onClick={onAction}>
          <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

/**
 * A route threw. Most often this is a repository read that failed, which on a
 * festival network means the signal dropped.
 *
 * `reset` retries without a full reload, so somebody halfway through a count does
 * not lose their input to a transient failure. That is also why this does not
 * auto-retry: a silent retry loop against a failing server is indistinguishable
 * from a hang, and the person holding the phone is better placed to decide.
 */
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  return (
    <Failure
      icon={<Unplug size={26} strokeWidth={1.7} />}
      eyebrow="COULD NOT LOAD"
      title="THIS SCREEN HAS NO DATA"
      detail={messageOf(error)}
      hint="Nothing has been recorded or lost. Anything you have already submitted is queued and will sync."
      actionLabel="TRY AGAIN"
      onAction={() => (reset ? reset() : window.location.reload())}
    />
  )
}

/** A URL with no route. */
export function NotFound() {
  return (
    <Failure
      icon={<TriangleAlert size={26} strokeWidth={1.7} />}
      eyebrow="NOT FOUND"
      title="NO SUCH SCREEN"
      detail="This address does not exist in the app. A bookmark or a link may be out of date."
      hint="If you scanned a docket QR code, ask the person who issued it to show the docket instead."
      actionLabel="GO TO HOME"
      onAction={() => {
        window.location.href = '/'
      }}
    />
  )
}

/**
 * The outermost boundary. Catches what the router cannot: a throw in a provider,
 * in the auth gate, or in repository selection.
 *
 * A class component because that is still the only way to catch a render error in
 * React.
 */
export class AppErrorBoundary extends Component<PropsWithChildren, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Console only. There is no error reporting service yet (BAR-119), and
    // silently swallowing this would leave nothing to look at the next morning.
    console.error('[boa] uncaught error above the router', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-stage">
          <RouteError error={this.state.error} reset={() => this.setState({ error: null })} />
        </div>
      )
    }
    return this.props.children
  }
}

import { useEffect, useState, type FormEvent, type PropsWithChildren } from 'react'
import { KeyRound, Mail, ShieldAlert } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Panel, RitualButton } from '../components/ui'

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth()
  const fixtureCapture = import.meta.env.DEV
    && new URLSearchParams(window.location.search).has('fixture')

  if (auth.mode === 'demo' || fixtureCapture) return children
  /*
    BAR-165. `!auth.membershipsReady` as well as `auth.loading`.
    `loading` is lowered by whoever established the session, and the membership
    load only raises it again on the next render — so there was a frame where a
    signed-in user had an empty membership list and nothing was loading, and this
    gate fell straight through to "No venue access". It flashed the rejection
    screen at somebody who had just signed in correctly, on every cold start with
    a session and every time a code was verified.
  */
  if (auth.loading || (auth.user && !auth.membershipsReady)) {
    return (
      <AuthFrame>
        <div className="auth-skeleton" role="status" aria-label="Loading"><i /><i /><i /></div>
      </AuthFrame>
    )
  }
  if (!auth.user) return <SignIn />
  if (!auth.activeMembership) {
    // BAR-143. A new starter has no membership until they redeem the manager's
    // invite. Do not render the app (which would fall back to fixtures without a
    // venue), but allow this one live RPC on its dedicated onboarding route.
    if (window.location.pathname === '/team') return <JoinWithCode />
    return (
      <AuthFrame>
        <ShieldAlert />
        <h1>No venue access</h1>
        <p>{auth.error ?? 'Your account is valid but has not been assigned to BOA 2026 Bar Control.'}</p>
        <RitualButton wide tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton>
      </AuthFrame>
    )
  }
  return children
}

/**
 * BAR-165. Sign-in is two steps, and it now renders as two.
 *
 * It used to render as one: the address step's heading and its explanation
 * ("Use the email address your manager invited") stayed on
 * screen after the code was sent, above a card repeating that a code had been
 * sent — so the step that asks for eight digits carried two headings, two
 * explanations and a panel. There was also no way back: a mistyped address left
 * the person stuck on a code that would never arrive, with a page reload as the
 * only exit.
 */
function SignIn() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [message, setMessage] = useState<string>()
  /**
   * BAR-165. The request's own in-flight state. It used to raise the provider's
   * global `loading`, which swaps this whole screen for a skeleton — so sending a
   * code unmounted the step that was about to show it and put the person back on
   * the address form. See `signInWithEmail` in lib/auth.
   */
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  const requestCode = (address: string) => {
    setSending(true)
    return auth.signInWithEmail(address)
      .then(() => { setSent(true); setResendIn(60) })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Sign-in failed'))
      .finally(() => setSending(false))
  }

  if (!sent) {
    return (
      <AuthFrame>
        <KeyRound />
        <h1>Staff sign in</h1>
        {/*
          BAR-165. No standing paragraph and no field label. The heading says what
          the screen is, the placeholder says what to type, and a sentence
          explaining that a personal address is fine is a sentence nobody reads on
          a phone in a queue. The label survives for screen readers only.
        */}
        <form onSubmit={(event) => {
          event.preventDefault()
          setMessage(undefined)
          void requestCode(email.trim())
        }}>
          <input
            id="staff-email"
            type="email"
            aria-label="Your email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
          />
          {message && <small className="auth-error" role="alert">{message}</small>}
          <RitualButton wide type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Email me a code'}
          </RitualButton>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <Mail />
      <h1>Check your email</h1>
      <p>We sent an 8-digit code to <b>{email}</b>.</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        setMessage(undefined)
        void auth.verifyEmailOtp(email, code.trim())
          .catch((error) => setMessage(error instanceof Error ? error.message : 'The code could not be verified'))
      }}>
        <input
          id="staff-code"
          aria-label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="8-digit code"
          maxLength={8}
        />
        {message && <small className="auth-error" role="alert">{message}</small>}
        <RitualButton wide type="submit" disabled={code.length !== 8}>Verify code</RitualButton>
      </form>
      <RitualButton
        wide
        tone="ghost"
        disabled={resendIn > 0 || sending}
        onClick={() => {
          setMessage(undefined)
          setCode('')
          void requestCode(email)
        }}
      >
        {/* The unit is not an initial. `.ritual-button` uppercases its label, so
            the seconds are excluded from the transform rather than shouted. */}
        {resendIn > 0 ? <>Resend code in {resendIn}<span className="unit-lower">s</span></> : 'Resend code'}
      </RitualButton>
      <button className="auth-back" onClick={() => { setSent(false); setCode(''); setMessage(undefined); setResendIn(0) }}>
        Use a different email
      </button>
    </AuthFrame>
  )
}

function JoinWithCode() {
  const auth = useAuth()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string>()
  const [joined, setJoined] = useState<string>()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(undefined)
    void auth.claimInvite(code.trim().toUpperCase())
      .then((result) => {
        setJoined(result.name)
        setCode('')
        // Membership is loaded once after sign-in. Reload only after the server
        // has durably claimed the one-time code, so an invite can never look
        // accepted before it is.
        window.setTimeout(() => window.location.reload(), 800)
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not join BOA Bar Control'))
  }

  return <AuthFrame>
    <KeyRound /><h1>Join BOA Bar Control</h1>
    <p>Enter the six-character code supplied by your manager.</p>
    {joined ? <Panel className="auth-notice"><Mail /><div><strong>Joined as {joined}</strong><span className="auth-inline-skeleton" aria-label="Loading venue access" /></div></Panel> : <form onSubmit={submit}>
      <label htmlFor="invite-code">Invite code</label>
      <input id="invite-code" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="K7F2QX" maxLength={6} />
      {message && <small className="auth-error">{message}</small>}
      <RitualButton wide type="submit" disabled={code.trim().length < 6}>Join team</RitualButton>
    </form>}
    <RitualButton wide tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton>
  </AuthFrame>
}

/**
 * BAR-165. The frame is the app's own shell — same 390×844, same radius, same
 * ambient stage — so the first screen of the product does not look like a
 * different product, and it is no longer a short box floating in the middle of a
 * black page.
 *
 * Logo, icon, heading, copy and form are one centred block. Holding the logo at
 * the top of the frame was tried first and read as two unrelated things: a mark
 * alone on one line, a heading alone below it, and a void between them.
 */
function AuthFrame({ children }: PropsWithChildren) {
  return (
    <div className="auth-stage">
      <div className="auth-frame">
        <div className="auth-content">
          <img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />
          {children}
        </div>
      </div>
    </div>
  )
}

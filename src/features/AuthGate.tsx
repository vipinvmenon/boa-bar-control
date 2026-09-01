import { useEffect, useState, type FormEvent, type PropsWithChildren } from 'react'
import { KeyRound, LoaderCircle, Mail, ShieldAlert } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Panel, RitualButton } from '../components/ui'

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth()
  const fixtureCapture = import.meta.env.DEV
    && new URLSearchParams(window.location.search).has('fixture')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  if (auth.mode === 'demo' || fixtureCapture) return children
  if (auth.loading) return <AuthFrame><LoaderCircle className="auth-spinner" /><h1>Checking access</h1><p>Connecting securely to BOA Bar Control.</p></AuthFrame>
  if (!auth.user) return (
    <AuthFrame>
      <KeyRound /><h1>Staff sign in</h1>
      <p>Use the email address invited to the BOA 2026 operations team.</p>
      {sent ? <><Panel className="auth-notice"><Mail /><div><strong>Check your email</strong><span>Enter the 8-digit code we sent to {email}.</span></div></Panel><form onSubmit={(event) => {
        event.preventDefault(); setMessage(undefined)
        void auth.verifyEmailOtp(email, code.trim()).catch((error) => setMessage(error instanceof Error ? error.message : 'The code could not be verified'))
      }}><label htmlFor="staff-code">Verification code</label><input id="staff-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" maxLength={8} />{message && <small className="auth-error" role="alert">{message}</small>}<RitualButton wide type="submit" disabled={code.length !== 8}>Verify code</RitualButton></form><RitualButton tone="ghost" disabled={resendIn > 0} onClick={() => { setMessage(undefined); setCode(''); void auth.signInWithEmail(email).then(() => setResendIn(60)).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not resend code')) }}>{resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}</RitualButton></> : <form onSubmit={(event) => {
        event.preventDefault(); setMessage(undefined)
        void auth.signInWithEmail(email.trim()).then(() => { setSent(true); setResendIn(60) }).catch((error) => setMessage(error instanceof Error ? error.message : 'Sign-in failed'))
      }}><label htmlFor="staff-email">Staff email</label><input id="staff-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@bangaloreopenair.com" />{message && <small className="auth-error" role="alert">{message}</small>}<RitualButton wide type="submit">Email me a code</RitualButton></form>}
    </AuthFrame>
  )
  if (!auth.activeMembership) {
    // BAR-143. A new starter has no membership until they redeem the manager's
    // invite. Do not render the app (which would fall back to fixtures without a
    // venue), but allow this one live RPC on its dedicated onboarding route.
    if (window.location.pathname === '/team') return <JoinWithCode />
    return <AuthFrame><ShieldAlert /><h1>No venue access</h1><p>{auth.error ?? 'Your account is valid but has not been assigned to BOA 2026 Bar Control.'}</p><RitualButton tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton></AuthFrame>
  }
  return children
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
    {joined ? <Panel className="auth-notice"><Mail /><div><strong>Joined as {joined}</strong><span>Loading your venue access.</span></div></Panel> : <form onSubmit={submit}>
      <label htmlFor="invite-code">Invite code</label>
      <input id="invite-code" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="K7F2QX" maxLength={6} />
      {message && <small className="auth-error">{message}</small>}
      <RitualButton wide type="submit" disabled={code.trim().length < 6}>Join team</RitualButton>
    </form>}
    <RitualButton tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton>
  </AuthFrame>
}

function AuthFrame({ children }: PropsWithChildren) {
  return <div className="auth-stage"><div className="auth-frame"><img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />{children}</div></div>
}

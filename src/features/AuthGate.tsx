import { useState, type FormEvent, type PropsWithChildren } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { RitualButton } from '../components/ui'

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth()
  const fixtureCapture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fixture')

  if (auth.mode === 'demo' || fixtureCapture) return children
  if (auth.loading || (auth.user && !auth.membershipsReady)) {
    return <AuthFrame><div className="auth-skeleton" role="status" aria-label="Loading"><i /><i /><i /></div></AuthFrame>
  }
  if (!auth.user) return <SignIn />
  if (auth.passwordSetupRequired || auth.user.user_metadata.needs_password === true) return <SetPassword />
  if (!auth.activeMembership) {
    return <AuthFrame>
      <ShieldAlert />
      <h1>No venue access</h1>
      <p>{auth.error ?? 'Your account is valid but has not been assigned to BOA 2026 Bar Control.'}</p>
      <RitualButton wide tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton>
    </AuthFrame>
  }
  return children
}

function SignIn() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string>()
  const [signingIn, setSigningIn] = useState(false)

  return <AuthFrame>
    <KeyRound />
    <h1>Staff sign in</h1>
    <form onSubmit={(event) => {
      event.preventDefault()
      setMessage(undefined)
      setSigningIn(true)
      void auth.signInWithPassword(email.trim(), password)
        .catch(() => setMessage('That email or password is not recognised'))
        .finally(() => setSigningIn(false))
    }}>
      <input id="staff-email" type="email" aria-label="Your email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" />
      <input id="staff-password" type="password" aria-label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
      {message && <small className="auth-error" role="alert">{message}</small>}
      <RitualButton wide type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</RitualButton>
    </form>
  </AuthFrame>
}

function SetPassword() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<string>()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) { setMessage('Use at least 8 characters'); return }
    if (password !== confirmation) { setMessage('Passwords do not match'); return }
    setMessage(undefined)
    void auth.setPassword(password).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not set password'))
  }

  return <AuthFrame>
    <KeyRound />
    <h1>Set your password</h1>
    <p>Your BOA Bar Control account is ready. Choose a password to finish joining.</p>
    <form onSubmit={submit}>
      <input id="new-password" type="password" aria-label="New password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" />
      <input id="confirm-password" type="password" aria-label="Confirm password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm your password" />
      {message && <small className="auth-error" role="alert">{message}</small>}
      <RitualButton wide type="submit">Set password</RitualButton>
    </form>
  </AuthFrame>
}

function AuthFrame({ children }: PropsWithChildren) {
  return <div className="auth-stage"><div className="auth-frame"><div className="auth-content">
    <img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />
    {children}
  </div></div></div>
}

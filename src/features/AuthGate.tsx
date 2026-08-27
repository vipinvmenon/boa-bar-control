import { useState, type PropsWithChildren } from 'react'
import { KeyRound, LoaderCircle, Mail, ShieldAlert } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Panel, RitualButton } from '../components/ui'

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string>()

  if (auth.mode === 'demo') return children
  if (auth.loading) return <AuthFrame><LoaderCircle className="auth-spinner" /><h1>Checking access</h1><p>Connecting securely to BOA Bar Control.</p></AuthFrame>
  if (!auth.user) return (
    <AuthFrame>
      <KeyRound /><h1>Staff sign in</h1>
      <p>Use the email address invited to the BOA 2026 operations team.</p>
      {sent ? <Panel className="auth-notice"><Mail /><div><strong>Check your email</strong><span>The secure sign-in link returns to this device.</span></div></Panel> : <form onSubmit={(event) => {
        event.preventDefault(); setMessage(undefined)
        void auth.signInWithEmail(email.trim()).then(() => setSent(true)).catch((error) => setMessage(error instanceof Error ? error.message : 'Sign-in failed'))
      }}><label htmlFor="staff-email">Staff email</label><input id="staff-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@bangaloreopenair.com" />{message && <small className="auth-error">{message}</small>}<RitualButton wide type="submit">Email secure link</RitualButton></form>}
    </AuthFrame>
  )
  if (!auth.activeMembership) return <AuthFrame><ShieldAlert /><h1>No venue access</h1><p>{auth.error ?? 'Your account is valid but has not been assigned to BOA 2026 Bar Control.'}</p><RitualButton tone="ghost" onClick={() => void auth.signOut()}>Sign out</RitualButton></AuthFrame>
  return children
}

function AuthFrame({ children }: PropsWithChildren) {
  return <div className="auth-stage"><div className="auth-frame"><img src="/assets/boa-logo-2026.png" alt="Bangalore Open Air" />{children}</div></div>
}

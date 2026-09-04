import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, KeyRound } from 'lucide-react'
import { useAuth } from '../../lib/auth'

export function PasswordScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) { setMessage('Use at least 8 characters'); return }
    if (password !== confirmation) { setMessage('Passwords do not match'); return }
    setSaving(true)
    setMessage(undefined)
    try {
      await auth.setPassword(password)
      // BAR-172. `/more`, not `/settings`: the redirect at `/settings` would push
      // another `/settings → /more` pair onto the stack behind the person.
      void navigate({ to: '/more' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not change password')
      setSaving(false)
    }
  }

  return (
    <div className="section-screen">
      <header className="section-head"><div className="count-head-left">
        <button className="flow-back" onClick={() => void navigate({ to: '/more' })} aria-label="Back to more"><ChevronLeft size={18} strokeWidth={2} aria-hidden="true" /></button>
        <h1 className="section-head-title">Change password</h1>
      </div></header>
      <div className="section-body settings-form-body">
        <section className="sync-card settings-invite-card">
          <div className="sync-card-top"><span className="sync-card-eyebrow"><KeyRound size={13} aria-hidden="true" /> ACCOUNT PASSWORD</span></div>
          <p className="sync-card-copy">Choose a password with at least eight characters.</p>
          <form className="settings-invite-form" onSubmit={(event) => void submit(event)}>
            <input type="password" autoComplete="new-password" aria-label="New password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
            <input type="password" autoComplete="new-password" aria-label="Confirm password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm password" />
            {message && <p className="flow-error" role="alert">{message}</p>}
            <button className="ritual-button wide" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button>
          </form>
        </section>
      </div>
    </div>
  )
}

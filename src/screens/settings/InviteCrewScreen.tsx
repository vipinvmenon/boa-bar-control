import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import type { VenueRole } from '../../data/repository'

export function InviteCrewScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const team = useRepositoryQuery(['settings-team'], (r) => r.team())
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<VenueRole>('crew')
  const [locationId, setLocationId] = useState('')
  const [message, setMessage] = useState<string>()
  const [inviting, setInviting] = useState(false)
  const fixtureCapture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fixture')
  /**
   * BAR-171. The same two-personal-address literal list that gated the MORE
   * screen's row also gated this screen. Both now read the membership role the
   * database enforces on `/api/invite-user`; this remains a usability
   * affordance, never a control (non-negotiable 7). `auditor` is excluded
   * deliberately — read access to variance is not permission to enrol crew.
   */
  const venueRole = auth.activeMembership?.role
  const canInvite = fixtureCapture || venueRole === 'manager' || venueRole === 'admin'

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviting(true)
    setMessage(undefined)
    try {
      const accessToken = auth.session?.access_token
      if (!accessToken || !auth.activeMembership) throw new Error('Your session is not ready')
      const response = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email, displayName: name, role, locationId: locationId || null, venueId: auth.activeMembership.venueId }),
      })
      const responseText = await response.text()
      let result: { ok?: boolean; error?: string } = {}
      if (responseText) {
        try { result = JSON.parse(responseText) as { ok?: boolean; error?: string } }
        catch { result = { error: responseText.slice(0, 180) } }
      }
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error?.startsWith('<!doctype') || result.error?.startsWith('<html')
          ? 'Invitation service is unavailable in this local preview. Open the production app to send an invitation.'
          : result.error ?? `Could not send invitation (${response.status})`)
      }
      setEmail('')
      setName('')
      setLocationId('')
      setMessage('INVITATION SENT · THEY WILL SET A PASSWORD FROM THE EMAIL')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send invitation')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="section-screen">
      <header className="section-head"><div className="count-head-left">
        <button className="flow-back" onClick={() => void navigate({ to: '/more' })} aria-label="Back to more"><ChevronLeft size={18} strokeWidth={2} aria-hidden="true" /></button>
        <h1 className="section-head-title">Invite crew</h1>
      </div></header>
      <div className="section-body settings-form-body">
        {canInvite && (auth.activeMembership || fixtureCapture) ? (
          <section className="sync-card settings-invite-card">
            <div className="sync-card-top"><span className="sync-card-eyebrow"><UserPlus size={13} aria-hidden="true" /> NEW TEAM MEMBER</span></div>
            <p className="sync-card-copy">Send a secure invitation. They will set a password before entering the app.</p>
            {/*
              BAR-184. All four controls were placeholder-only, with an
              `aria-label` carrying the whole meaning. That is a name for a
              screen reader and nothing at all for everyone else: a placeholder
              disappears the moment somebody types, so a half-filled form is four
              boxes of text with no idea what any of them is. On a select it is
              worse — a select has no placeholder, only a current value, so once
              a bar was chosen nothing on screen said the field was a location
              rather than a second role.

              The pattern is `label.field` + `span.issue-label`, which the
              receipt screen already uses for SUPPLIER and DELIVERY NOTE. Wrapping
              in a `<label>` also associates the text with the control implicitly,
              so no `htmlFor`/`id` pair can drift apart. Placeholders are kept only
              where they are a format example, which is the name and the email;
              the selects carry none, because their first option is not an example
              of anything.
            */}
            <form className="settings-invite-form" onSubmit={(event) => void invite(event)}>
              <label className="field">
                <span className="issue-label">FULL NAME</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Nair" />
              </label>
              <label className="field">
                <span className="issue-label">EMAIL ADDRESS</span>
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="priya@example.com" />
              </label>
              <label className="field">
                <span className="issue-label">ROLE</span>
                <select value={role} onChange={(event) => setRole(event.target.value as VenueRole)}><option value="crew">CREW</option><option value="warehouse">WAREHOUSE</option><option value="bar_lead">BAR LEAD</option><option value="auditor">AUDITOR</option></select>
              </label>
              <label className="field">
                <span className="issue-label">BAR / LOCATION</span>
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">No fixed location</option>{(team.data?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
              </label>
              <button className="ritual-button wide" type="submit" disabled={inviting}>{inviting ? 'Sending…' : 'Send invitation'}</button>
            </form>
            {message && <p className="flow-hint" role="status">{message}</p>}
          </section>
        ) : <p className="section-empty">Only the approved BOA managers can invite crew.</p>}
      </div>
    </div>
  )
}

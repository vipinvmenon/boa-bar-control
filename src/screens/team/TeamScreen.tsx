/** Team membership review and role management. New staff invitations live in Settings. */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'
import type { VenueRole } from '../../data/repository'

const ROLE_LABEL: Record<VenueRole, string> = {
  crew: 'CREW', warehouse: 'WAREHOUSE', bar_lead: 'BAR LEAD', manager: 'MANAGER', auditor: 'AUDITOR', admin: 'ADMIN',
}

export function TeamScreen() {
  const navigate = useNavigate()
  const store = useAppStore()
  const team = useRepositoryQuery(['team'], (r) => r.team())
  const change = useRepositoryMutation((r, input: { userId: string; role: VenueRole }) =>
    r.setMembership({ userId: input.userId, role: input.role, active: true }),
  )
  const data = team.data

  /**
   * BAR-170. The role picker stages; it does not commit.
   *
   * Before this, `onChange` called `change.mutate` directly, so a privilege
   * change was one mis-scroll of a native picker away — no confirmation, no
   * success state, nothing to undo. This is the only screen in the app that can
   * take away somebody's ability to work, and it was the least guarded, while
   * sign-out (trivially recoverable) had a full modal. The safeguards were
   * inverted: verification belongs on authority changes, undo on stock entry
   * (BAR-168).
   *
   * One staged change at a time — nobody re-roles two people simultaneously, and
   * a single slot means the confirm can never be ambiguous about who it means.
   */
  const [staged, setStaged] = useState<{ userId: string; role: VenueRole }>()
  /** Whose row the server refused, so the message sits with the person it is about. */
  const [failed, setFailed] = useState<{ userId: string; message: string }>()

  const commit = (member: { userId: string; name: string }, role: VenueRole) => {
    setFailed(undefined)
    change.mutate({ userId: member.userId, role }, {
      onSuccess: () => {
        setStaged(undefined)
        store.flash(`${member.name.toUpperCase()} IS NOW ${ROLE_LABEL[role]}`)
      },
      // Clearing the staged value is what reverts the select: its value falls
      // back to the membership the repository still reports (non-negotiable 6 —
      // a refused write must never leave the UI showing the new role).
      onError: (error) => {
        setStaged(undefined)
        setFailed({ userId: member.userId, message: error.message })
      },
    })
  }

  return <div className="section-screen">
    <header className="section-head">
      <div className="count-head-left">
        <button className="flow-back" onClick={() => void navigate({ to: '/settings' })} aria-label="Back to settings"><ChevronLeft size={18} strokeWidth={2} aria-hidden="true" /></button>
        <h1 className="section-head-title">Team</h1>
      </div>
    </header>
    <div className="section-body">
      <p className="flow-hint">Review the people who currently have access to this venue.</p>
      <div className="section-label">ON THIS VENUE{data ? <span>{data.members.length}</span> : null}</div>
      {data?.members.map((member, index) => {
        const pending = staged?.userId === member.userId ? staged.role : undefined
        return <div className="team-member" key={`${member.userId}-${member.locationName ?? member.role}-${index}`}>
          <div className="team-row">
            <span><strong>{member.name}</strong><small>{ROLE_LABEL[member.role]}{member.locationName ? ' · ' + member.locationName : ''}</small></span>
            {data.canManage && !member.isSelf ? <select value={pending ?? member.role} onChange={(event) => { setFailed(undefined); setStaged({ userId: member.userId, role: event.target.value as VenueRole }) }} aria-label={'Change role for ' + member.name}>
              {(Object.keys(ROLE_LABEL) as VenueRole[]).filter((role) => data.canGrantManagement || (role !== 'manager' && role !== 'admin')).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
            </select> : <span className="team-self">{member.isSelf ? 'YOU' : ''}</span>}
          </div>
          {/* Inline in the row, not a modal. A modal for every role change is the
              pattern this codebase already over-uses, and it hides the row you
              are about to change behind a scrim. */}
          {pending && pending !== member.role && <div className="team-confirm">
            <p>Change {member.name} to {ROLE_LABEL[pending]}?</p>
            <div className="team-confirm-actions">
              <button className="ritual-button ghost" onClick={() => setStaged(undefined)}>Cancel</button>
              <button className="ritual-button" disabled={change.isPending} onClick={() => commit(member, pending)}>{change.isPending ? 'Changing…' : 'Change role'}</button>
            </div>
          </div>}
          {failed?.userId === member.userId && <p className="flow-error" role="alert">{failed.message}</p>}
        </div>
      })}
      {data && data.members.length === 0 && <p className="section-empty">No active team members.</p>}
    </div>
  </div>
}

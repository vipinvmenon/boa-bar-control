/** Team membership review and role management. New staff invitations live in Settings. */
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import type { VenueRole } from '../../data/repository'

const ROLE_LABEL: Record<VenueRole, string> = {
  crew: 'CREW', warehouse: 'WAREHOUSE', bar_lead: 'BAR LEAD', manager: 'MANAGER', auditor: 'AUDITOR', admin: 'ADMIN',
}

export function TeamScreen() {
  const navigate = useNavigate()
  const team = useRepositoryQuery(['team'], (r) => r.team())
  const change = useRepositoryMutation((r, input: { userId: string; role: VenueRole }) =>
    r.setMembership({ userId: input.userId, role: input.role, active: true }),
  )
  const data = team.data

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
      {data?.members.map((member, index) => <div className="team-row" key={`${member.userId}-${member.locationName ?? member.role}-${index}`}>
        <span><strong>{member.name}</strong><small>{ROLE_LABEL[member.role]}{member.locationName ? ' · ' + member.locationName : ''}</small></span>
        {data.canManage && !member.isSelf ? <select value={member.role} onChange={(event) => change.mutate({ userId: member.userId, role: event.target.value as VenueRole })} aria-label={'Change role for ' + member.name}>
          {(Object.keys(ROLE_LABEL) as VenueRole[]).filter((role) => data.canGrantManagement || (role !== 'manager' && role !== 'admin')).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
        </select> : <span className="team-self">{member.isSelf ? 'YOU' : ''}</span>}
      </div>)}
      {change.isError && <p className="flow-error" role="alert">{change.error.message}</p>}
      {data && data.members.length === 0 && <p className="section-empty">No active team members.</p>}
    </div>
  </div>
}

/**
 * BAR-144, and the half of BAR-143 that does not depend on how people sign in.
 *
 * Two failures this closes, both of which happen on the night:
 *   - a bar lead arriving at 20:00 could not be enrolled at all;
 *   - when the manager left at 23:00, variance, reports and count sign-off left
 *     with them, because nobody could be promoted.
 *
 * Not a design screen — the design has no team management. Built from existing
 * tokens.
 *
 * The claim box is shown to everybody, including people with no membership: it is
 * the only thing a new starter can use, and the venue they are joining is the one
 * the code belongs to.
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Ticket, UserPlus } from 'lucide-react'
import { useRepository, useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import type { VenueRole } from '../../data/repository'

const ROLE_LABEL: Record<VenueRole, string> = {
  crew: 'CREW',
  warehouse: 'WAREHOUSE',
  bar_lead: 'BAR LEAD',
  manager: 'MANAGER',
  auditor: 'AUDITOR',
  admin: 'ADMIN',
}

export function TeamScreen() {
  const navigate = useNavigate()
  const repository = useRepository()
  const team = useRepositoryQuery(['team'], (r) => r.team())

  const [name, setName] = useState('')
  const [role, setRole] = useState<VenueRole>('crew')
  const [locationId, setLocationId] = useState('')
  const [code, setCode] = useState('')
  const [issued, setIssued] = useState<{ code: string; name: string } | null>(null)
  const [claimed, setClaimed] = useState<string | null>(null)

  const invite = useRepositoryMutation((r, input: { displayName: string; role: VenueRole; locationId?: string }) =>
    r.createInvite(input),
  )
  const claim = useRepositoryMutation((r, input: { code: string }) => r.claimInvite(input.code))
  const change = useRepositoryMutation((r, input: { userId: string; role: VenueRole }) =>
    r.setMembership({ userId: input.userId, role: input.role, active: true }),
  )

  const data = team.data

  return (
    <div className="section-screen">
      <header className="section-head">
        <div className="count-head-left">
          <button className="flow-back" onClick={() => void navigate({ to: '/more' })} aria-label="Back">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="section-head-title">Team</h1>
        </div>
      </header>

      <div className="section-body">
        {/* Anyone can redeem a code — including somebody with no access yet. */}
        <section className="panel team-card">
          <span className="issue-label"><Ticket size={13} strokeWidth={2} aria-hidden="true" /> JOIN WITH A CODE</span>
          <div className="team-claim">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="K7F2QX"
              maxLength={6}
              aria-label="Invite code"
            />
            <button
              className="flow-cta-ghost"
              disabled={code.trim().length < 6 || claim.isPending}
              onClick={() => claim.mutate({ code: code.trim() }, {
                onSuccess: (result) => { setClaimed(result.name); setCode('') },
              })}
            >
              {claim.isPending ? 'Joining…' : 'Join'}
            </button>
          </div>
          {claim.isError && <p className="flow-error" role="alert">{claim.error.message}</p>}
          {claimed && <p className="team-ok" role="status">Joined as {claimed}. Reload to pick up your new access.</p>}
        </section>

        {data?.canManage && (
          <section className="panel team-card">
            <span className="issue-label"><UserPlus size={13} strokeWidth={2} aria-hidden="true" /> INVITE SOMEBODY</span>
            <label className="field">
              <span className="issue-label">NAME</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aditi" />
            </label>
            <div className="team-roles">
              {(Object.keys(ROLE_LABEL) as VenueRole[])
                // Only an admin may mint management. Otherwise a manager could
                // promote themselves by inviting a second account and claiming it.
                .filter((r) => data.canGrantManagement || (r !== 'manager' && r !== 'admin'))
                .map((option) => (
                  <button
                    key={option}
                    className={role === option ? 'active' : ''}
                    onClick={() => setRole(option)}
                  >
                    {ROLE_LABEL[option]}
                  </button>
                ))}
            </div>
            <label className="field">
              <span className="issue-label">POSTED TO</span>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">No fixed location</option>
                {data.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <button
              className="flow-cta"
              disabled={name.trim() === '' || invite.isPending}
              onClick={() => invite.mutate(
                { displayName: name.trim(), role, locationId: locationId || undefined },
                { onSuccess: (result) => { setIssued(result); setName('') } },
              )}
            >
              {invite.isPending ? 'Creating…' : 'Create invite'}
            </button>
            {invite.isError && <p className="flow-error" role="alert">{invite.error.message}</p>}
            {issued && (
              <div className="team-code" role="status">
                <span>READ THIS OUT TO {issued.name.toUpperCase()}</span>
                <strong>{issued.code}</strong>
                <small>Single use. It expires in 24 hours.</small>
              </div>
            )}
          </section>
        )}

        <div className="section-label">
          ON THIS VENUE
          {data ? <span>{data.members.length}</span> : null}
        </div>

        {data?.members.map((member) => (
          <div className="team-row" key={member.userId}>
            <span>
              <strong>{member.name}</strong>
              <small>{ROLE_LABEL[member.role]}{member.locationName ? ` · ${member.locationName}` : ''}</small>
            </span>
            {data.canManage && !member.isSelf ? (
              <select
                value={member.role}
                onChange={(e) => change.mutate({ userId: member.userId, role: e.target.value as VenueRole })}
                aria-label={`Change role for ${member.name}`}
              >
                {(Object.keys(ROLE_LABEL) as VenueRole[])
                  .filter((r) => data.canGrantManagement || (r !== 'manager' && r !== 'admin'))
                  .map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            ) : (
              <span className="team-self">{member.isSelf ? 'YOU' : ''}</span>
            )}
          </div>
        ))}

        {change.isError && <p className="flow-error" role="alert">{change.error.message}</p>}
        {repository.kind === 'fixture' && (
          <p className="section-empty">Demo data — no invite created here is real.</p>
        )}
      </div>
    </div>
  )
}

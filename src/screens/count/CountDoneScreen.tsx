/**
 * BAR-085 — count submitted.
 *
 * Values from design-markup.html:727-756. Compare against
 * references/ui/countDone.png.
 *
 * Previously an inline success panel with no witness and no seal. The design's
 * record carries both names, because spec §6 requires the expected figure to
 * reach "a different person" — which only means something if the count records
 * who counted and who witnessed.
 *
 * The variance CTA is manager-gated. The gate here is a usability affordance;
 * the real enforcement is count-scoped in the database (ADR-005).
 */
import { useNavigate, useParams } from '@tanstack/react-router'
import { Check, Lock } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { useAppStore } from '../../lib/app-store'
import { DetailList, FlowFooter } from '../custody/parts'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

export function CountDoneScreen() {
  const navigate = useNavigate()
  const { barId } = useParams({ strict: false }) as { barId?: string }
  const store = useAppStore()
  const session = useRepositoryQuery(['countSession', barId ?? 'membership'], (r) => r.countSession(barId))
  const s = session.data

  if (!s) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <ScreenSkeleton variant="flow" />
        </div>
      </div>
    )
  }

  const isManager = store.role === 'Manager'

  return (
    <div className="flow-screen">
      <div className="flow-body countdone-body">
        <div className="received-mark">
          <div className="received-tick">
            <Check size={30} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <p className="countdone-title">COUNT SUBMITTED</p>
          <p className="received-sub">
            {s.locationName} mid-event count · {s.totalLines} SKUs · sealed {s.sealedAt}
          </p>
        </div>

        <DetailList
          rows={[
            { label: 'Location', value: s.locationName },
            { label: 'Count type', value: 'MID-EVENT · BLIND' },
            { label: 'Counted by', value: s.countedBy },
            { label: 'Witnessed by', value: s.witnessedBy },
            { label: 'Lines', value: `${s.totalLines} OF ${s.totalLines}`, tone: 'green' },
          ]}
        />

        <div className="advisory advisory-sage">
          <Lock size={16} strokeWidth={1.9} aria-hidden="true" />
          Expected figures stay sealed to the counter. Variance is released on the manager screen.
        </div>
      </div>

      <FlowFooter>
        {/*
          BAR-165. This rendered for everybody and answered a non-manager's tap
          with a toast. The counter has just sealed a blind count — the correct
          thing to show them is that it is sealed, not a button that refuses.
          The advisory above already says where variance is released.
        */}
        {isManager ? (
          <button
            className="flow-cta-gold"
            onClick={() => void (barId
              ? navigate({ to: '/bars/$barId/variance', params: { barId } })
              : navigate({ to: '/variance' }))}
          >
            Open variance
          </button>
        ) : null}
        <button
          className="flow-cta-ghost"
          onClick={() => void navigate({ to: '/bars/$barId', params: { barId: s.locationId } })}
        >
          Back to {s.locationName}
        </button>
      </FlowFooter>
    </div>
  )
}

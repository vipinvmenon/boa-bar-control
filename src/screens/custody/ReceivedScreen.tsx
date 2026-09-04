/**
 * BAR-057 — received. The custody document.
 *
 * Values from design-markup.html:582-607. Compare against
 * references/ui/received.png.
 *
 * The previous implementation replaced this whole screen with a one-line success
 * panel, which is why nothing showed the two names and two timestamps that are
 * the entire point of spec §5.
 *
 * The design's closing line says it: "Chain of custody closed. Both names and
 * both timestamps are held on the docket permanently."
 */
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { DetailList, FlowFooter } from './parts'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

export function ReceivedScreen() {
  const { docketId } = useParams({ from: '/dockets/$docketId/received' })
  const { qty, reason } = useSearch({ from: '/dockets/$docketId/received' })
  const navigate = useNavigate()
  const custody = useRepositoryQuery(['custody', docketId], (r) => r.custody(docketId))
  const d = custody.data

  if (!d) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <ScreenSkeleton variant="flow" />
        </div>
      </div>
    )
  }

  /*
    BAR-177. The docket's total, across every line. `qty` in the URL is what the
    acceptance actually credited — a single figure, because the receipt states
    one outcome for one docket, not a per-line breakdown.
  */
  const expected = d.lines.reduce((sum, line) => sum + line.expectedContainers, 0)
  const accepted = qty ?? expected
  /*
    "bottles" is the design's word and it is right for the docket the design
    draws. Across several products the units differ — bottles, cans, kegs — so
    naming one of them would be wrong on the others.
  */
  const unitWord = d.lines.length === 1 ? 'bottles' : 'containers'
  const short = expected - accepted
  const isShort = short > 0

  return (
    <div className="flow-screen">
      <div className="flow-body received-body">
        <div className="received-mark">
          <div className="received-tick">
            <Check size={30} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <p className="received-title">{isShort ? 'RECEIVED SHORT' : 'RECEIVED'}</p>
          <p className="received-sub">
            {isShort
              ? `${d.toName} credited with ${accepted} ${unitWord}. The shortfall is now an open discrepancy.`
              : `${d.toName} credited with ${accepted} ${unitWord}. Docket ${d.docketNo} closed.`}
          </p>
        </div>

        <DetailList
          rows={[
            { label: 'Docket', value: d.docketNo },
            { label: 'Expected', value: `${expected} ${unitWord.toUpperCase()}` },
            { label: 'Accepted', value: `${accepted} ${unitWord.toUpperCase()}`, tone: isShort ? 'red' : 'green' },
            {
              label: 'Difference',
              value: isShort ? `−${short} · ${reason ?? ''}`.trim() : 'NONE',
              tone: isShort ? 'red' : undefined,
            },
            { label: 'Issued by', value: `${d.issuedBy} · ${d.issuedAt}` },
            { label: 'Accepted by', value: `${d.acceptedBy} · ${d.acceptedAt}` },
          ]}
        />

        <p className="received-note">
          Chain of custody closed. Both names and both timestamps are held on the docket permanently.
        </p>
      </div>

      <FlowFooter>
        <button className="flow-cta" onClick={() => void navigate({ to: '/bars/$barId', params: { barId: d.toLocationId } })}>
          Back to {d.toName}
        </button>
      </FlowFooter>
    </div>
  )
}

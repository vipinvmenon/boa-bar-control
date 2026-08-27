/**
 * BAR-054 — docket created.
 *
 * Values from design-markup.html:412-446. Compare against references/ui/docket.png.
 *
 * The previous implementation collapsed four design screens — docket, accept,
 * diff, received — into this one. They are now four screens, as designed,
 * because each represents a distinct custody state with a distinct actor.
 *
 * The QR encodes a route that exists (BAR-054): the receiving view for this
 * docket. It previously pointed at /d/{token}, which was never a route.
 */
import { useNavigate, useParams } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import { DetailList, FlowFooter } from './parts'

export function DocketScreen() {
  const { docketId } = useParams({ from: '/dockets/$docketId' })
  const navigate = useNavigate()
  const custody = useRepositoryQuery(['custody', docketId], (r) => r.custody(docketId))
  const d = custody.data

  if (!d) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <p className="section-empty">Loading docket…</p>
        </div>
      </div>
    )
  }

  const acceptPath = `/dockets/${d.docketNo}/accept`

  return (
    <div className="flow-screen">
      <div className="flow-body docket-body">
        <div className="docket-ident">
          <span className="docket-created">DOCKET CREATED</span>
          <p className="docket-no">#{d.docketNo}</p>
          <span className="docket-status">
            <i className="status-dot gold" />
            {d.statusLabel}
          </span>
        </div>

        <div className="docket-qr">
          <QRCodeSVG
            value={`${window.location.origin}${acceptPath}`}
            size={150}
            bgColor="#F2EFE2"
            fgColor="#0D0D12"
            level="M"
          />
        </div>
        <p className="docket-scan">SCAN AT {d.toName} TO ACCEPT</p>

        <DetailList
          rows={[
            { label: 'Route', value: `${d.fromName} → ${d.toName}` },
            { label: 'Items', value: `${d.expectedContainers} × ${d.productName.toUpperCase()}` },
            { label: 'Issued by', value: d.issuedBy },
            { label: 'Issued at', value: d.issuedAt },
            { label: 'Status', value: d.statusLabel, tone: 'gold' },
          ]}
        />
      </div>

      <FlowFooter>
        <button className="flow-cta" onClick={() => void navigate({ to: acceptPath })}>
          Open receiving view
        </button>
        <button className="flow-cta-ghost" onClick={() => void navigate({ to: '/warehouse' })}>
          Done
        </button>
      </FlowFooter>
    </div>
  )
}

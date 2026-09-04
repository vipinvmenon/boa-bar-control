/**
 * BAR-055 + BAR-056 — receive stock, and the report-difference variant.
 *
 * Values from design-markup.html:498-581. Compare against references/ui/accept.png
 * and references/ui/diff.png.
 *
 * `diff` is NOT a separate screen: it is this screen with the difference panel
 * open (design-script.jsx `toggleDiff`, state `recvMode`). That is why the design
 * has 22 screen labels but 21 rendered branches — worth knowing before anyone
 * tries to build a 22nd route.
 *
 * Rules enforced here mirror what boa_bar_accept_docket enforces server-side, so
 * the UI cannot offer something the RPC will reject:
 *   - accepted quantity cannot exceed what was issued (BAR-129)
 *   - a short acceptance requires a reason (BAR-058)
 * The server is still the authority; this is the usability affordance.
 */
import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Check, Minus, Plus } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'
import type { CustodyLine } from '../../data/repository'
import { Advisory, FlowFooter, FlowHeader } from './parts'
import { describeQuantity } from './quantity'
import { useRepositoryMutation } from '../../data/RepositoryProvider'
import { acceptDocket } from '../../services/accept'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'

export function AcceptScreen() {
  const { docketId } = useParams({ from: '/dockets/$docketId/accept' })
  const navigate = useNavigate()
  const custody = useRepositoryQuery(['custody', docketId], (r) => r.custody(docketId))
  const d = custody.data

  const [diffOpen, setDiffOpen] = useState(false)
  /**
   * BAR-177. Received quantities per SKU, not one figure for the docket.
   *
   * Keyed by SKU because `boa_bar_docket_line` is unique on
   * (docket_id, sku_id), so a docket cannot carry the same product twice. An
   * absent key means "not adjusted", and reads as the issued quantity — the
   * difference panel starts by agreeing with the docket, exactly as the single
   * stepper did.
   */
  const [received, setReceived] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<string | null>(null)

  /**
   * BAR-044 / BAR-069. One id for this ACCEPTANCE, created once when the screen
   * mounts and reused for every attempt, so the idempotency key identifies the
   * user's action rather than the network call. A double tap, or a retry after the
   * reply was lost, produces one acceptance.
   *
   * It does not survive a reload — persisting it is BAR-072 — so a reload before
   * the write drains can still produce a second acceptance. The database refuses
   * that one (BAR-134 asserts it), so the failure mode is a visible error, not a
   * duplicate ledger entry.
   */
  const [actionId] = useState(() => crypto.randomUUID())

  // Declared before the loading guard below, because hooks must run in the same
  // order on every render. The docket is therefore read inside the callback,
  // where it is guaranteed to be loaded — the button that fires this does not
  // exist until it is.
  const submit = useRepositoryMutation((repository, input: { accepted: Record<string, number>; why?: string }) => {
    if (!d) throw new Error('The docket is still loading')
    return acceptDocket({
      repository,
      actionId,
      docketId: d.docketId,
      // BAR-177. Every line is sent, adjusted or not. A line omitted from an
      // acceptance is a line left in transit.
      lines: d.lines.map((line) => ({
        skuId: line.skuId,
        issuedContainers: line.expectedContainers,
        acceptedContainers: input.accepted[line.skuId] ?? line.expectedContainers,
      })),
      differenceReason: input.why,
    })
  })


  if (!d) {
    return (
      <div className="flow-screen">
        <FlowHeader title="Receive stock" onBack={() => void navigate({ to: '/bars' })} />
        <div className="flow-body">
          <ScreenSkeleton variant="flow" />
        </div>
      </div>
    )
  }

  const qtyFor = (line: CustodyLine) => received[line.skuId] ?? line.expectedContainers
  const expected = d.lines.reduce((sum, line) => sum + line.expectedContainers, 0)
  const qty = d.lines.reduce((sum, line) => sum + qtyFor(line), 0)
  const short = expected - qty
  const isShort = short > 0
  const multiLine = d.lines.length > 1

  // BAR-129: every stepper is bounded. An unbounded one let a receiver accept
  // more than was issued, and the excess was then classified as a shortfall.
  // BAR-177: bounded per line, against that line's own issued quantity — a
  // single docket-wide bound would let a surplus on one product hide a shortfall
  // on another.
  const step = (line: CustodyLine, delta: number) => setReceived((current) => ({
    ...current,
    [line.skuId]: Math.max(0, Math.min(line.expectedContainers, qtyFor(line) + delta)),
  }))

  // Just the "2 cases" part of the design's "2 cases · 650 ml · 31.2 L".
  const casesLabel = (line: CustodyLine) =>
    (describeQuantity(line.expectedContainers, line.unitsPerCase, line.mlPerContainer).split(' · ')[0] ?? '').toUpperCase()

  // Disabled while the write is in flight, or once it is durably queued, so a
  // second tap cannot claim another acceptance before the first has landed.
  const isQueued = submit.data?.status === 'queued'
  const canAccept = (!isShort || reason !== null) && !submit.isPending && !isQueued

  /**
   * The write is awaited before navigating. The design's received screen is a
   * receipt — "chain of custody closed, both names held permanently" — and showing
   * it before the write is durable would be a claim of success this app is not
   * entitled to make (non-negotiable 6).
   */
  const accept = () => {
    submit.mutate(
      { accepted: received, why: reason ?? undefined },
      {
        onSuccess: (outcome) => {
          // A queued acceptance is durable but is not yet a custody receipt.
          // Stay here and say so; RECEIVED is reserved for a server-posted
          // acceptance holding both people's names permanently.
          if (outcome.status !== 'posted') return
          void navigate({
            to: '/dockets/$docketId/received',
            // `custody()` resolves its route identifier by docket number. The
            // UUID is the RPC identity, not the user-facing route key.
            params: { docketId: outcome.docketNo },
            search: { qty, reason: reason ?? undefined },
          })
        },
      },
    )
  }

  return (
    <div className="flow-screen">
      <FlowHeader
        title="Receive stock"
        onBack={() => void navigate({ to: '/bars' })}
        badge={d.docketNo}
      />

      <div className="flow-body accept-body">
        <div className="accept-route">
          <div>
            <span>FROM</span>
            <strong>{d.fromName}</strong>
          </div>
          <div>
            <span>TO</span>
            <strong className="tone-green">{d.toName}</strong>
          </div>
          <div className="accept-route-wide">
            <span>ISSUED BY</span>
            <strong>
              {d.issuedBy} · {d.issuedAt}
            </strong>
          </div>
        </div>

        <section className="accept-items">
          <span className="accept-items-eyebrow">ITEMS ON DOCKET</span>
          {d.lines.map((line) => (
            <div className="accept-items-row" key={line.skuId}>
              <div>
                <strong>{line.productName}</strong>
                <span>{line.productSpec}</span>
              </div>
              <div className="accept-items-qty">
                <p>{line.expectedContainers}</p>
                <span>{casesLabel(line)}</span>
              </div>
            </div>
          ))}
        </section>

        {diffOpen ? (
          <section className="diff-panel">
            <span className="diff-eyebrow">REPORT DIFFERENCE</span>
            {/*
              BAR-177. One counter per line. A shortfall has to be attributed to
              the product that is short: `boa_bar_docket_line` records an accepted
              quantity per SKU, and "the docket is 6 down" is not something the
              ledger, the excise return or the next morning's investigation can
              use.
            */}
            {d.lines.map((line) => (
              <div className="diff-line" key={line.skuId}>
                {multiLine ? <span className="diff-line-name">{line.productName.toUpperCase()}</span> : null}
                <div className="diff-counter">
                  <div className="diff-expected">
                    <span>EXPECTED</span>
                    <strong>{line.expectedContainers}</strong>
                  </div>
                  <div className="diff-stepper">
                    <button
                      onClick={() => step(line, -1)}
                      aria-label={`One fewer ${line.productName} received`}
                      disabled={qtyFor(line) <= 0}
                    >
                      <Minus size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                    <div className="diff-value">
                      <p>{qtyFor(line)}</p>
                      <span>RECEIVED</span>
                    </div>
                    <button
                      onClick={() => step(line, 1)}
                      aria-label={`One more ${line.productName} received`}
                      disabled={qtyFor(line) >= line.expectedContainers}
                    >
                      <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {/* The design's string is `+ ' BOTTLES'` unconditionally, but its demo
                default of 46-of-48 means it never renders the singular. Pluralised
                here because a real short-by-one would read "1 BOTTLES", and made
                unit-neutral across several products because their units differ. */}
            <p className="diff-short">
              SHORT BY {short} {multiLine ? (short === 1 ? 'CONTAINER' : 'CONTAINERS') : (short === 1 ? 'BOTTLE' : 'BOTTLES')}
            </p>

            <span className="diff-reason-label">REASON · REQUIRED</span>
            <div className="diff-reasons">
              {d.differenceReasons.map((option) => (
                <button
                  key={option}
                  className={reason === option ? 'active' : ''}
                  onClick={() => setReason(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <Advisory tone="sage">
          <Check size={16} strokeWidth={2} aria-hidden="true" />
          Physically count the delivery before accepting. Your name is recorded against this quantity.
        </Advisory>
      </div>

      <FlowFooter>
        {/*
          A failed write is stated, not swallowed. The person is standing at a bar
          with a delivery in front of them; "it didn't save" is information they
          can act on, and a silent failure is not.
        */}
        {submit.isError && (
          <p className="flow-error" role="alert">
            NOT ACCEPTED · {submit.error.message}
          </p>
        )}
        {isQueued ? (
          <Advisory tone="gold">
            ACCEPTANCE QUEUED ON THIS DEVICE · IT WILL POST AFTER SYNC.
          </Advisory>
        ) : null}
        {/*
          BAR-165. A shortfall without a reason leaves the button dead. The
          database refuses an unexplained shortfall (BAR-058) and so does this —
          but it now says which of the two it is waiting for.
        */}
        {isShort && reason === null ? (
          <p className="flow-hint">Choose a reason for the shortfall. An unexplained short acceptance is refused.</p>
        ) : null}
        <button
          className={`flow-cta ${isShort ? 'is-short' : ''}`}
          onClick={accept}
          disabled={!canAccept}
        >
          {submit.isPending
            ? 'Recording…'
            : isShort
              ? `Accept ${qty} · report short ${short}`
              : multiLine ? `Accept all ${d.lines.length} products` : `Accept ${expected} bottles`}
        </button>
        <button
          className={`flow-cta-ghost ${diffOpen ? 'is-active' : ''}`}
          onClick={() => {
            setDiffOpen((open) => !open)
            if (diffOpen) {
              setReceived({})
              setReason(null)
            }
          }}
        >
          {diffOpen ? 'Cancel difference' : 'Report difference'}
        </button>
      </FlowFooter>
    </div>
  )
}

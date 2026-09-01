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
  const [received, setReceived] = useState<number | null>(null)
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
  const submit = useRepositoryMutation((repository, input: { accepted: number; why?: string }) => {
    if (!d) throw new Error('The docket is still loading')
    return acceptDocket({
      repository,
      actionId,
      docketId: d.docketId,
      lines: [
        { skuId: d.skuId, issuedContainers: d.expectedContainers, acceptedContainers: input.accepted },
      ],
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

  const expected = d.expectedContainers
  const qty = received ?? expected
  const short = expected - qty
  const isShort = short > 0

  // BAR-129: the stepper is bounded. An unbounded one let a receiver accept more
  // than was issued, and the excess was then classified as a shortfall.
  const step = (delta: number) => setReceived(Math.max(0, Math.min(expected, qty + delta)))

  // Just the "2 cases" part of the design's "2 cases · 650 ml · 31.2 L".
  const casesLabel = (describeQuantity(expected, d.unitsPerCase, d.mlPerContainer).split(' · ')[0] ?? '').toUpperCase()

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
      { accepted: qty, why: reason ?? undefined },
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
          <div className="accept-items-row">
            <div>
              <strong>{d.productName}</strong>
              <span>{d.productSpec}</span>
            </div>
            <div className="accept-items-qty">
              <p>{expected}</p>
              <span>{casesLabel}</span>
            </div>
          </div>
        </section>

        {diffOpen ? (
          <section className="diff-panel">
            <span className="diff-eyebrow">REPORT DIFFERENCE</span>
            <div className="diff-counter">
              <div className="diff-expected">
                <span>EXPECTED</span>
                <strong>{expected}</strong>
              </div>
              <div className="diff-stepper">
                <button onClick={() => step(-1)} aria-label="One fewer received">
                  <Minus size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <div className="diff-value">
                  <p>{qty}</p>
                  <span>RECEIVED</span>
                </div>
                <button onClick={() => step(1)} aria-label="One more received" disabled={qty >= expected}>
                  <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </div>
            {/* The design's string is `+ ' BOTTLES'` unconditionally, but its demo
                default of 46-of-48 means it never renders the singular. Pluralised
                here because a real short-by-one would read "1 BOTTLES". */}
            <p className="diff-short">SHORT BY {short} {short === 1 ? 'BOTTLE' : 'BOTTLES'}</p>

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
        <button
          className={`flow-cta ${isShort ? 'is-short' : ''}`}
          onClick={accept}
          disabled={!canAccept}
        >
          {submit.isPending
            ? 'Recording…'
            : isShort
              ? `Accept ${qty} · report short ${short}`
              : `Accept ${expected} bottles`}
        </button>
        <button
          className={`flow-cta-ghost ${diffOpen ? 'is-active' : ''}`}
          onClick={() => {
            setDiffOpen((open) => !open)
            if (diffOpen) {
              setReceived(null)
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

/**
 * BAR-079 + BAR-080 + BAR-081 — the blind count.
 *
 * Values from design-markup.html:655-726. Compare against references/ui/count.png.
 *
 * This is the screen the specification is most emphatic about. §6: "Blind
 * counting is non-negotiable. The counter does not see the expected figure. If
 * the app shows 'expected 47' next to the input box, you will get 47 every time
 * and the count is worthless."
 *
 * The previous version inverted it: three steppers seeded
 * { kf: 11, bud: 36, corona: 19 } — two of the three exact expected figures from
 * the store — with a hardcoded matching −1/0/0 reveal. BAR-151 zeroed the inputs
 * as an emergency fix; this rebuilds the screen.
 *
 * What was missing entirely and is now here:
 *   - sequential per-SKU progress with a meter (was three steppers at once)
 *   - full-container presets
 *   - PARTIAL CAPTURE. Spec §6 requires counting full containers as integers and
 *     weighing partials, because "about a third left" across forty bottles is a
 *     hundreds-of-millilitres guess. Three modes per SKU: none for bottled beer,
 *     ml-by-weight against the SKU's tare for spirits, litres for kegs.
 *
 * Every input starts at zero and is reset per line. Nothing on this screen reads
 * or displays an expected quantity.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, EyeOff, Minus, Plus } from 'lucide-react'
import { useRepository, useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { submitCount } from '../../services/count'
import type { CountLineCommand } from '../../data/repository'
import { partialToMl } from '../../domain/units'

export function CountScreen() {
  const navigate = useNavigate()
  const session = useRepositoryQuery(['countSession'], (r) => r.countSession())

  const [lineIndex, setLineIndex] = useState(0)
  const [full, setFull] = useState(0)
  const [partial, setPartial] = useState(0)

  /**
   * BAR-082. The counted lines, accumulated.
   *
   * This screen previously collected `full` and `partial`, reset them on Save &
   * next, and navigated to the confirmation screen — so **every count taken on it
   * was discarded**. Nothing was accumulated and nothing was ever written; the
   * schema had no write path for a count either.
   */
  const [counted, setCounted] = useState<Record<string, CountLineCommand>>({})

  /**
   * One id for this COUNT, created once when the screen mounts and reused for
   * every submit attempt, so a double tap or a retry after a lost reply produces
   * one count rather than two (BAR-069). It does not survive a reload — that is
   * BAR-072 — but the RPC's unique idempotency key refuses the duplicate.
   */
  const [actionId] = useState(() => crypto.randomUUID())

  /**
   * BAR-161. Open the count as soon as the sheet is shown.
   *
   * Opening a count is what BLINDS this device to the location's position — the
   * database withholds that location from the snapshot and from the raw ledger
   * while a draft session is open. So it has to happen before the counter looks
   * at the sheet, not at submit time: a blind that starts after the first line is
   * entered protects nothing.
   *
   * Failure here is surfaced rather than swallowed, because a sheet that opened
   * without the blind taking effect is a sheet the counter should not be using.
   */
  const repository = useRepository()
  const opened = useRef(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const locationId = session.data?.locationId
  const countKind = session.data?.countKind

  useEffect(() => {
    if (opened.current || !locationId || !countKind) return
    opened.current = true
    repository
      .openCount(locationId, countKind)
      .catch((error: unknown) =>
        setOpenError(error instanceof Error ? error.message : 'The count could not be opened'),
      )
  }, [repository, locationId, countKind])

  const submit = useRepositoryMutation((repository, input: { lines: CountLineCommand[]; locationId: string; countKind: Parameters<typeof submitCount>[0]['countKind']; expectedLineCount: number }) =>
    submitCount({ repository, actionId, ...input }),
  )

  const s = session.data
  if (!s) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <p className="section-empty">Loading count…</p>
        </div>
      </div>
    )
  }

  // The design's session is 18 lines over a repeating SKU set.
  const line = s.lines[lineIndex % s.lines.length]!
  const done = lineIndex
  const isLast = done >= s.totalLines - 1
  const pct = Math.round((done / s.totalLines) * 100)

  /**
   * Record this line, then either advance or submit.
   *
   * The count is only navigated away from AFTER the write is accepted. Showing
   * COUNT SUBMITTED before the outbox has the count would be a claim of success
   * this app is not entitled to make (non-negotiable 6), and a count is not
   * re-creatable — the stock has moved by the time anybody notices.
   */
  const saveNext = () => {
    const next: Record<string, CountLineCommand> = {
      ...counted,
      [line.skuId]: {
        skuId: line.skuId,
        fullContainers: full,
        // A keg is metered in litres on screen; the ledger holds millilitres.
        partialMl: partialToMl(partial, line.partial),
      },
    }
    setCounted(next)

    if (!isLast) {
      setLineIndex((i) => i + 1)
      // Reset per line. A carried-over value is a silent miscount.
      setFull(0)
      setPartial(0)
      return
    }

    submit.mutate(
      {
        lines: Object.values(next),
        locationId: s.locationId,
        countKind: s.countKind,
        expectedLineCount: s.lines.length,
      },
      { onSuccess: () => void navigate({ to: '/count/submitted' }) },
    )
  }

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            <button className="flow-back" onClick={() => void navigate({ to: '/bars' })} aria-label="Back">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <div>
              <p className="count-head-title">{s.kindLabel}</p>
              <p className="count-head-scope">{s.scopeLabel}</p>
            </div>
          </div>
          <span className="count-progress">
            {done} OF {s.totalLines}
          </span>
        </div>
        <div className="count-meter">
          <i style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="flow-body count-body">
        <div>
          <p className="count-sku-name">{line.name}</p>
          <p className="count-sku-spec">{line.spec}</p>
        </div>

        <section className="count-card">
          <p className="count-card-eyebrow">FULL CONTAINERS</p>
          <div className="count-stepper">
            <button onClick={() => setFull((n) => Math.max(0, n - 1))} aria-label="One fewer full container">
              <Minus size={24} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <p className="count-value">{full}</p>
            <button className="count-plus" onClick={() => setFull((n) => n + 1)} aria-label="One more full container">
              <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          <div className="count-presets">
            {s.presets.map((preset) => (
              <button key={preset} onClick={() => setFull(preset)}>
                {preset}
              </button>
            ))}
          </div>
        </section>

        {line.partial !== 'none' ? (
          <section className="count-card count-partial">
            <div className="count-partial-top">
              <span>PARTIAL / OPEN CONTAINER</span>
              <span className="count-partial-hint">{line.partialHint}</span>
            </div>
            <div className="count-partial-row">
              <button
                onClick={() => setPartial((n) => Math.max(0, n - line.partialStep))}
                aria-label="Less partial"
              >
                <Minus size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div className="count-partial-value">
                <p>{partial}</p>
                <span>{line.partialUnit}</span>
              </div>
              <button onClick={() => setPartial((n) => n + line.partialStep)} aria-label="More partial">
                <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : null}

        <div className="advisory advisory-sage">
          <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
          Blind count. Expected stock, previous counts and variance stay hidden until a manager opens
          the variance screen.
        </div>
      </div>

      <footer className="flow-foot">
        {openError && (
          <p className="flow-error" role="alert">
            COUNT NOT OPENED · {openError} · Do not count from this sheet
          </p>
        )}
        {submit.isError && (
          <p className="flow-error" role="alert">NOT SUBMITTED · {submit.error.message}</p>
        )}
        <button className="flow-cta" onClick={saveNext} disabled={submit.isPending}>
          {submit.isPending ? 'Recording…' : isLast ? 'Submit count' : 'Save & next'}
        </button>
      </footer>
    </div>
  )
}

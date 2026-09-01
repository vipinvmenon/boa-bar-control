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
import { useNavigate, useParams } from '@tanstack/react-router'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { ChevronLeft, EyeOff, Minus, Plus } from 'lucide-react'
import { useRepository, useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { partialMlFromWeight, submitCount } from '../../services/count'
import type { CountLineCommand } from '../../data/repository'
import { partialToMl } from '../../domain/units'
import { useDraft } from '../../data/useDraft'

/**
 * BAR-072. What is kept across a reload: the counted lines so far, which line the
 * counter is on, and the action id.
 *
 * The action id matters as much as the lines. It is the idempotency key, so
 * restoring it means a count resumed after a reload SUPERSEDES nothing and
 * duplicates nothing — it finishes the same count. Minting a fresh one would make
 * the resumed sheet a second, competing count of the same location.
 */
type CountDraft = {
  actionId: string
  lineIndex: number
  counted: Record<string, CountLineCommand>
}

/** Validated, not cast: a draft written by an older build must not reach a submit. */
function isCountDraft(raw: unknown): raw is CountDraft {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as Partial<CountDraft>
  return (
    typeof d.actionId === 'string' &&
    typeof d.lineIndex === 'number' &&
    !!d.counted &&
    typeof d.counted === 'object'
  )
}

export function CountScreen() {
  const navigate = useNavigate()
  const { barId } = useParams({ strict: false }) as { barId?: string }
  const session = useRepositoryQuery(['countSession', barId ?? 'membership'], (r) => r.countSession(barId))

  const [full, setFull] = useState(0)
  const [partial, setPartial] = useState(0)
  const [grossWeightG, setGrossWeightG] = useState<number | null>(null)
  const [measurementError, setMeasurementError] = useState<string | null>(null)

  /**
   * BAR-082 + BAR-072. The counted lines and the position in the sheet, kept in
   * Dexie so a reload does not lose them.
   *
   * This screen originally collected `full` and `partial`, reset them on Save &
   * next, and navigated away — so every count taken on it was discarded. Then the
   * lines were accumulated but only in React memory, so a browser reclaiming the
   * tab at line twelve of eighteen lost the lot. A count cannot be retried from
   * the same facts the way a write can: by the time anybody notices, the stock has
   * moved.
   *
   * Keyed by location, so counting Bar 1 does not resume Bar 3's sheet.
   */
  const draftKey = session.data?.locationId ? `count:${session.data.locationId}` : null
  const draft = useDraft<CountDraft>(
    draftKey,
    { actionId: crypto.randomUUID(), lineIndex: 0, counted: {} },
    isCountDraft,
  )
  const { actionId, lineIndex, counted } = draft.value

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

  const submit = useRepositoryMutation((repository, input: {
    lines: CountLineCommand[]
    locationId: string
    countKind: Parameters<typeof submitCount>[0]['countKind']
    expectedLineCount: number
    supersedesSessionId?: string
    supersedeReason?: string
  }) => submitCount({ repository, actionId, ...input }))

  const s = session.data
  // BAR-072. Wait for the stored draft as well as the sheet. Rendering a zeroed
  // sheet and replacing it a moment later invites somebody to start typing into
  // the wrong one.
  if (!s || !draft.ready) {
    return (
      <div className="flow-screen">
        <div className="flow-body">
          <ScreenSkeleton variant="count" />
        </div>
      </div>
    )
  }

  // The design's session is 18 lines over a repeating SKU set.
  const line = s.lines[lineIndex % s.lines.length]!
  const done = lineIndex
  const isLast = done >= s.totalLines - 1
  const pct = Math.round((done / s.totalLines) * 100)

  let weighedPartialMl = 0
  let weightError: string | null = null
  if (line.partial === 'ml' && grossWeightG !== null) {
    if (line.tareWeightG === null) {
      weightError = 'This product has no tare weight. Do not record a weighed partial.'
    } else {
      try {
        weighedPartialMl = partialMlFromWeight(grossWeightG, line.tareWeightG)
      } catch (error) {
        weightError = error instanceof Error ? error.message : 'The scale reading is not valid'
      }
    }
  }

  /**
   * Record this line, then either advance or submit.
   *
   * The count is only navigated away from AFTER the write is accepted. Showing
   * COUNT SUBMITTED before the outbox has the count would be a claim of success
   * this app is not entitled to make (non-negotiable 6), and a count is not
   * re-creatable — the stock has moved by the time anybody notices.
   */
  const saveNext = () => {
    if (weightError) {
      setMeasurementError(weightError)
      return
    }

    const isWeighedPartial = line.partial === 'ml' && grossWeightG !== null
    const next: Record<string, CountLineCommand> = {
      ...counted,
      [line.skuId]: {
        skuId: line.skuId,
        fullContainers: full,
        // Kegs are metered in litres. Spirits are weighed and converted against
        // the SKU tare; the gross reading is retained as audit evidence.
        partialMl: isWeighedPartial ? weighedPartialMl : partialToMl(partial, line.partial),
        ...(isWeighedPartial ? { grossWeightG } : {}),
      },
    }

    if (!isLast) {
      // Persisted before the input is cleared, so the line just counted survives
      // even if the tab dies between one line and the next.
      draft.setValue((current) => ({ ...current, counted: next, lineIndex: current.lineIndex + 1 }))
      // Reset per line. A carried-over value is a silent miscount.
      setFull(0)
      setPartial(0)
      setGrossWeightG(null)
      setMeasurementError(null)
      return
    }

    draft.setValue((current) => ({ ...current, counted: next }))

    submit.mutate(
      {
        lines: Object.values(next),
        locationId: s.locationId,
        countKind: s.countKind,
        expectedLineCount: s.lines.length,
        /**
         * BAR-145. If this location already has a live count, this one replaces
         * it. The reason is fixed here rather than asked for, because the design
         * has no field for it and inventing a modal mid-count is worse than a
         * truthful default; a manager-facing recount form with a real reason is
         * the follow-up.
         */
        ...(s.supersedesSessionId
          ? {
              supersedesSessionId: s.supersedesSessionId,
              supersedeReason: 'Recount from the bar app',
            }
          : {}),
      },
      {
        onSuccess: () => {
          // Only after the write is accepted. Clearing on submit would lose the
          // count if the submit then failed.
          void draft.clear().then(() => barId
            ? navigate({ to: '/bars/$barId/count/submitted', params: { barId } })
            : navigate({ to: '/count/submitted' }))
        },
      },
    )
  }

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            <button
              className="flow-back"
              onClick={() => void (barId
                ? navigate({ to: '/bars/$barId', params: { barId } })
                : navigate({ to: '/bars' }))}
              aria-label="Back"
            >
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
                onClick={() => {
                  setMeasurementError(null)
                  if (line.partial === 'ml') {
                    setGrossWeightG((n) => n === null ? null : Math.max(0, n - line.partialStep))
                  } else {
                    setPartial((n) => Math.max(0, n - line.partialStep))
                  }
                }}
                aria-label="Less partial"
              >
                <Minus size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div className="count-partial-value">
                {line.partial === 'ml' ? (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={grossWeightG ?? ''}
                      placeholder="0"
                      aria-label={`Gross weight in grams for ${line.name}`}
                      aria-invalid={weightError ? 'true' : undefined}
                      onChange={(event) => {
                        setMeasurementError(null)
                        const value = event.target.value
                        setGrossWeightG(value === '' ? null : Number(value))
                      }}
                    />
                    <span>
                      GROSS G · {weighedPartialMl} {line.partialUnit}
                    </span>
                  </>
                ) : (
                  <>
                    <p>{partial}</p>
                    <span>{line.partialUnit}</span>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setMeasurementError(null)
                  if (line.partial === 'ml') {
                    setGrossWeightG((n) => n === null
                      ? (line.tareWeightG ?? 0) + line.partialStep
                      : n + line.partialStep)
                  } else {
                    setPartial((n) => n + line.partialStep)
                  }
                }}
                aria-label="More partial"
              >
                <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
            {(measurementError || weightError) && (
              <p className="count-measurement-error" role="alert">
                {measurementError || weightError}
              </p>
            )}
          </section>
        ) : null}

        <div className="advisory advisory-sage">
          <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
          Blind count. Expected stock, previous counts and variance stay hidden until a manager opens
          the variance screen.
        </div>
      </div>

      <footer className="flow-foot">
        {/*
          BAR-072. Say so, rather than silently resuming. A counter who does not
          know the sheet was restored may recount lines already done, or trust a
          figure somebody else entered.
        */}
        {draft.restored && (
          <p className="count-resumed" role="status">
            RESUMED · {Object.keys(counted).length} line{Object.keys(counted).length === 1 ? '' : 's'} already counted on this device
          </p>
        )}
        {openError && (
          <p className="flow-error" role="alert">
            COUNT NOT OPENED · {openError} · Do not count from this sheet
          </p>
        )}
        {submit.isError && (
          <p className="flow-error" role="alert">NOT SUBMITTED · {submit.error.message}</p>
        )}
        <button className="flow-cta" onClick={saveNext} disabled={submit.isPending || !!weightError}>
          {submit.isPending ? 'Recording…' : isLast ? 'Submit count' : 'Save & next'}
        </button>
      </footer>
    </div>
  )
}

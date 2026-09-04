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
 *   - BAR-169: a review step before the seal, and a way back to an earlier line.
 *
 * Every input starts at zero and is reset per line. Nothing on this screen reads
 * or displays an expected quantity — not on a line, and not in the review list,
 * which shows only what the counter themselves typed.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ChevronLeft, ChevronRight, EyeOff, Minus, Plus } from 'lucide-react'
import { useRepository, useRepositoryMutation, useRepositoryQuery } from '../../data/RepositoryProvider'
import { partialMlFromWeight, submitCount } from '../../services/count'
import type { CountLine, CountLineCommand } from '../../data/repository'
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
 *
 * BAR-169 changed how the entered lines are keyed, and the change is the whole
 * reason the review step can tell "counted zero" from "never visited".
 *
 * They used to be keyed by `skuId`. The sheet is eighteen steps over a repeating
 * SKU set, so eighteen counted steps collapsed into three keys: the map could
 * never say how many steps had been walked, and an absent key meant both "not
 * reached yet" and "this SKU is not on the sheet". Keyed by SHEET STEP the two
 * are distinguishable — a step either has an entry or it does not — and the
 * per-SKU shape the submit command needs is folded back out of it at seal time
 * by `linesForSubmit`, which keeps the last entry for each SKU exactly as the
 * old overwrite-by-key behaviour did.
 *
 * `lineIndex` gained one legal value: `totalLines` means the review step. It is
 * in the draft rather than in React state so a reload at the review does not
 * drop the counter back onto line eighteen.
 */
type CountDraft = {
  actionId: string
  lineIndex: number
  entries: Record<string, CountLineCommand>
}

/** Validated, not cast: a draft written by an older build must not reach a submit. */
function isCountDraft(raw: unknown): raw is CountDraft {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as Partial<CountDraft>
  return (
    typeof d.actionId === 'string' &&
    typeof d.lineIndex === 'number' &&
    !!d.entries &&
    typeof d.entries === 'object'
  )
}

/** The steps that have been counted, in sheet order. */
function countedSteps(entries: Record<string, CountLineCommand>): number[] {
  return Object.keys(entries)
    .map(Number)
    .filter((step) => Number.isInteger(step) && step >= 0)
    .sort((a, b) => a - b)
}

/**
 * The per-SKU lines the submit command takes, from the per-step entries.
 *
 * The sheet repeats its SKU set, and `boa_bar_count_line` is unique on
 * (count_session_id, sku_id) — so a SKU counted at more than one step contributes
 * one line, and the LAST step wins. That is not a new rule: it is what keying the
 * map by `skuId` did implicitly, made explicit and ordered so a corrected line
 * cannot be beaten by the stale entry it replaced.
 */
function linesForSubmit(entries: Record<string, CountLineCommand>): CountLineCommand[] {
  const bySku = new Map<string, CountLineCommand>()
  for (const step of countedSteps(entries)) bySku.set(entries[String(step)]!.skuId, entries[String(step)]!)
  return [...bySku.values()]
}

/** What the counter typed, in their own units. Never an expected figure. */
function enteredLabel(entry: CountLineCommand | undefined, line: CountLine): string {
  if (!entry) return 'NOT COUNTED'
  const parts = [`${entry.fullContainers} FULL`]
  if (line.partial !== 'none' && entry.partialMl > 0) {
    parts.push(line.partial === 'litres'
      ? `${(entry.partialMl / 1000).toFixed(1)} L OPEN`
      : `${entry.partialMl} ML OPEN`)
  }
  return parts.join(' · ')
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
   * BAR-169. True while a line is open because the counter tapped it in the
   * review list, so saving it returns them to the review rather than marching
   * them forward through every line after it.
   *
   * Deliberately not in the draft: a reload mid-correction restores the line and
   * its entered value, and the counter walks forward normally from there. Kept
   * simple because the alternative — persisting a UI intent — is a second thing
   * that can be restored wrong.
   */
  const [returnToReview, setReturnToReview] = useState(false)

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
    { actionId: crypto.randomUUID(), lineIndex: 0, entries: {} },
    isCountDraft,
  )
  const { actionId, lineIndex, entries } = draft.value

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
  const [confirmLeave, setConfirmLeave] = useState(false)
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
  const lineAt = (step: number) => s.lines[step % s.lines.length]!
  const reviewing = lineIndex >= s.totalLines
  const line = lineAt(lineIndex)
  const done = Math.min(lineIndex, s.totalLines)
  const isLast = done >= s.totalLines - 1
  const pct = Math.round((done / s.totalLines) * 100)

  let weighedPartialMl = 0
  let weightError: string | null = null
  if (!reviewing && line.partial === 'ml' && grossWeightG !== null) {
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

  const leaveCount = () =>
    void (barId ? navigate({ to: '/bars/$barId', params: { barId } }) : navigate({ to: '/bars' }))

  /**
   * BAR-169. Open a step for entry and put back what was typed into it.
   *
   * An empty field on a line the counter has already counted would read as "your
   * correction lost the original", so the stored entry is restored in the units
   * it was entered in: litres for a keg, the retained scale reading for a spirit.
   */
  const openStep = (step: number, fromReview: boolean) => {
    const entry = entries[String(step)]
    const target = lineAt(step)
    setMeasurementError(null)
    setFull(entry?.fullContainers ?? 0)
    setGrossWeightG(entry?.grossWeightG ?? null)
    setPartial(entry && target.partial === 'litres' ? Math.round(entry.partialMl / 1000) : 0)
    setReturnToReview(fromReview)
    draft.setValue((current) => ({ ...current, lineIndex: step }))
  }

  /** The current line as it would be recorded, merged into the entries so far. */
  const withCurrentLine = (): Record<string, CountLineCommand> => {
    const isWeighedPartial = line.partial === 'ml' && grossWeightG !== null
    return {
      ...entries,
      [String(lineIndex)]: {
        skuId: line.skuId,
        fullContainers: full,
        // Kegs are metered in litres. Spirits are weighed and converted against
        // the SKU tare; the gross reading is retained as audit evidence.
        partialMl: isWeighedPartial ? weighedPartialMl : partialToMl(partial, line.partial),
        ...(isWeighedPartial ? { grossWeightG } : {}),
      },
    }
  }

  /**
   * Record this line, then move: to the review if it was the last, back to the
   * review if the line was opened from there, otherwise on to the next line.
   *
   * BAR-169. What this used to do at the end of the sheet was seal the count.
   * The footer button kept its size, its colour and its position and only changed
   * its label, so eighteen taps on one unmoving target produced a sealed,
   * witnessed record — and the ledger is append-only, so the only correction is a
   * second count plus a flagged adjustment. Nothing here submits any more; the
   * seal lives on the review step, on a different control in a different place.
   */
  const saveNext = () => {
    if (weightError) {
      setMeasurementError(weightError)
      return
    }

    const next = withCurrentLine()
    // Persisted before the input is cleared, so the line just counted survives
    // even if the tab dies between one line and the next.
    const target = returnToReview ? s.totalLines : lineIndex + 1
    draft.setValue((current) => ({ ...current, entries: next, lineIndex: target }))
    setReturnToReview(false)

    if (target >= s.totalLines) return

    // Reset per line — a carried-over value is a silent miscount — unless this
    // step was already counted, in which case its own entry goes back in.
    const entry = next[String(target)]
    const targetLine = lineAt(target)
    setFull(entry?.fullContainers ?? 0)
    setGrossWeightG(entry?.grossWeightG ?? null)
    setPartial(entry && targetLine.partial === 'litres' ? Math.round(entry.partialMl / 1000) : 0)
    setMeasurementError(null)
  }

  /**
   * BAR-169. Step back one line, keeping the line being left.
   *
   * Navigation was forward-only, and the only back control was the header
   * chevron, which exits the whole count. So a miscount noticed at line twelve
   * could not be fixed: staff either abandoned the count or knowingly sealed a
   * figure they knew was wrong.
   */
  const goPrevious = () => {
    if (lineIndex === 0) return
    if (weightError) {
      setMeasurementError(weightError)
      return
    }
    const next = withCurrentLine()
    draft.setValue((current) => ({ ...current, entries: next }))
    openStep(lineIndex - 1, false)
  }

  const seal = () => {
    submit.mutate(
      {
        lines: linesForSubmit(entries),
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

  /*
    BAR-165. Leaving a count in progress used to be silent, and it is not a
    neutral act: the session stays open, which is what keeps this device blind to
    the location (BAR-161), and the sheet is kept in Dexie. Somebody who taps back
    at line five has no way to know their work is safe, or that the bar's position
    will stay hidden from them until they come back and finish.

    So it is stated, once, when there is something to lose. With no lines counted
    there is nothing to say and the tap is immediate.
  */
  const counted = countedSteps(entries)
  const backButton = (
    <button
      className="flow-back"
      onClick={() => {
        if (counted.length > 0 && !confirmLeave) {
          setConfirmLeave(true)
          return
        }
        leaveCount()
      }}
      aria-label="Back"
    >
      <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )

  const leaveDialog = confirmLeave ? (
    <ConfirmDialog
      title="Leave count open?"
      confirmLabel="Leave for now"
      cancelLabel="Keep counting"
      onCancel={() => setConfirmLeave(false)}
      onConfirm={leaveCount}
    >
      <p>
        This count stays open and your {counted.length} counted line{counted.length === 1 ? '' : 's'}{' '}
        will be kept on this device. You can return and submit it later.
      </p>
    </ConfirmDialog>
  ) : null

  /**
   * BAR-169 — the review step.
   *
   * Everything here is the counter's own input. That is what makes it compatible
   * with non-negotiable 3: reading back what you yourself typed discloses
   * nothing, while an expected figure, an earlier count or a variance shown at
   * this moment would tell the counter what answer the system wanted — which is
   * the one thing a blind count exists to prevent. There is no expected column
   * here and there is no total to compare against.
   */
  if (reviewing) {
    const zeroSteps = counted.filter((step) => {
      const entry = entries[String(step)]!
      return entry.fullContainers === 0 && entry.partialMl === 0
    })
    const notCounted = s.totalLines - counted.length

    // Which step's entry each SKU will actually be sealed with. The sheet repeats
    // its SKU set and the record holds one line per SKU, so an earlier step of a
    // SKU counted again later is superseded — said out loud rather than left for
    // somebody to discover in the variance report.
    const sealedStepFor = new Map<string, number>()
    for (const step of counted) sealedStepFor.set(entries[String(step)]!.skuId, step)

    return (
      <div className="flow-screen">
        <header className="count-head">
          <div className="count-head-row">
            <div className="count-head-left">
              {backButton}
              <div>
                <p className="count-head-title">REVIEW COUNT</p>
                <p className="count-head-scope">{s.scopeLabel}</p>
              </div>
            </div>
            <span className="count-progress">REVIEW</span>
          </div>
          <div className="count-meter">
            <i style={{ width: '100%' }} />
          </div>
        </header>

        <div className="flow-body count-review">
          <p className="count-review-summary">
            {counted.length} line{counted.length === 1 ? '' : 's'} counted · {zeroSteps.length} left at
            zero{notCounted > 0 ? ` · ${notCounted} not counted` : ''}
          </p>
          <ul className="count-review-list">
            {Array.from({ length: s.totalLines }, (_, step) => {
              const entry = entries[String(step)]
              const stepLine = lineAt(step)
              const isZero = !!entry && entry.fullContainers === 0 && entry.partialMl === 0
              const sealedStep = entry ? sealedStepFor.get(entry.skuId) ?? step : step
              const superseded = sealedStep !== step
              return (
                <li key={step}>
                  <button
                    className={`count-review-row${entry ? '' : ' is-missing'}`}
                    onClick={() => openStep(step, true)}
                  >
                    <span className="count-review-index">{String(step + 1).padStart(2, '0')}</span>
                    <span className="count-review-name">
                      {stepLine.name}
                      {superseded && <span className="count-review-tag">RECOUNTED AT LINE {sealedStep + 1}</span>}
                      {isZero && !superseded && <span className="count-review-tag is-zero">ZERO</span>}
                    </span>
                    <span className="count-review-value">{enteredLabel(entry, stepLine)}</span>
                    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="advisory advisory-sage">
            <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
            Blind count. This is what you entered — expected stock, previous counts and variance stay
            hidden until a manager opens the variance screen.
          </div>
        </div>

        <footer className="flow-foot">
          {openError && (
            <p className="flow-error" role="alert">
              COUNT NOT OPENED · {openError} · This sheet cannot be submitted. Go back and start the
              count again.
            </p>
          )}
          {submit.isError && (
            <p className="flow-error" role="alert">NOT SUBMITTED · {submit.error.message}</p>
          )}
          {/*
            The seal is deliberately NOT where `Save & next` was. Seventeen taps
            in the same place build motor memory, and the eighteenth used to land
            on a control that sealed a witnessed record. This one is gold, not
            green; it is half the width; it sits on the right, so a tap aimed at
            the centre of the old button falls between the two; and it says what
            it does.
          */}
          <div className="count-seal-actions">
            <button
              className="flow-cta-ghost"
              onClick={() => openStep(s.totalLines - 1, false)}
              disabled={submit.isPending}
            >
              Back to last line
            </button>
            <button
              className="flow-cta-gold"
              onClick={seal}
              disabled={submit.isPending || !!openError}
            >
              {submit.isPending ? 'Sealing…' : 'Seal this count'}
            </button>
          </div>
        </footer>
        {leaveDialog}
      </div>
    )
  }

  return (
    <div className="flow-screen">
      <header className="count-head">
        <div className="count-head-row">
          <div className="count-head-left">
            {backButton}
            <div>
              <p className="count-head-title">{s.kindLabel}</p>
              <p className="count-head-scope">{s.scopeLabel}</p>
            </div>
          </div>
          <div className="count-head-right">
            {/*
              BAR-169. Worded and placed so it cannot be confused with the header
              chevron on the left, which leaves the count entirely. Two controls
              that both read as "back" and do very different things is the defect
              this task is fixing, so this one carries its own label and sits
              beside the progress figure it moves.
            */}
            {lineIndex > 0 && (
              <button className="count-prev" onClick={goPrevious}>
                <ChevronLeft size={14} strokeWidth={2.4} aria-hidden="true" />
                Previous
              </button>
            )}
            <span className="count-progress">
              {done} OF {s.totalLines}
            </span>
          </div>
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
            RESUMED · {counted.length} line{counted.length === 1 ? '' : 's'} already counted on this device
          </p>
        )}
        {/*
          BAR-165. This told the counter not to use the sheet and then left the
          button live under the warning. A count opened without the blind taking
          effect is a count nobody can defend, so the sheet refuses it rather than
          relying on somebody reading a red line at 01:00.
        */}
        {openError && (
          <p className="flow-error" role="alert">
            COUNT NOT OPENED · {openError} · This sheet cannot be submitted. Go back and start the
            count again.
          </p>
        )}
        <button
          className="flow-cta"
          onClick={saveNext}
          disabled={!!weightError || !!openError}
        >
          {returnToReview ? 'Save & back to review' : isLast ? 'Save & review' : 'Save & next'}
        </button>
      </footer>
      {leaveDialog}
    </div>
  )
}

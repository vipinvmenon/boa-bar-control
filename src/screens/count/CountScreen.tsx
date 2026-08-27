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
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, EyeOff, Minus, Plus } from 'lucide-react'
import { useRepositoryQuery } from '../../data/RepositoryProvider'

export function CountScreen() {
  const navigate = useNavigate()
  const session = useRepositoryQuery(['countSession'], (r) => r.countSession())

  const [lineIndex, setLineIndex] = useState(0)
  const [full, setFull] = useState(0)
  const [partial, setPartial] = useState(0)

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

  const saveNext = () => {
    if (isLast) {
      void navigate({ to: '/count/submitted' })
      return
    }
    setLineIndex((i) => i + 1)
    // Reset per line. A carried-over value is a silent miscount.
    setFull(0)
    setPartial(0)
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
        <button className="flow-cta" onClick={saveNext}>
          {isLast ? 'Submit count' : 'Save & next'}
        </button>
      </footer>
    </div>
  )
}

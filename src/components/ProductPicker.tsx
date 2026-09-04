/**
 * BAR-176 — one product picker, for every screen that chooses a SKU.
 *
 * There were four ways to choose a product and none of them could be searched.
 * Issue, waste and receipt each drew the design's `PRODUCT … CHANGE` row and
 * wired it to `products[(index + 1) % products.length]` — one SKU per tap, with
 * the list itself never shown. Reaching a named SKU was O(n) taps and required
 * the operator to already know the catalogue order, which is recall in place of
 * recognition and precisely backwards for temporary staff working one-handed in
 * the dark (spec §14). The bar workspace's top-up form used a native `<select>`
 * instead, so the app had two idioms for one job.
 *
 * The design draws that `PRODUCT / CHANGE` row (design-markup.html:331 for issue,
 * :625 for waste) and says nothing about what tapping it does — there is no
 * designed picker to reproduce. So the row is kept exactly as drawn and only the
 * behaviour behind it changes, and the sheet is built from the tokens and shapes
 * already in `styles.css` (`.panel`'s fill and border, `.wh-search`, the radius
 * ladder) rather than a new visual language.
 *
 * Recently-used is deliberately local to the device and to the surface. The four
 * screens do not share a store and inventing one for three remembered ids would
 * be a larger change than the defect warrants; every `localStorage` access is
 * guarded, and the sheet renders correctly with nothing stored.
 *
 * Unlike `ConfirmDialog`, this traps Tab. That component's missing trap is a
 * known gap with its own task — this one must not add a second instance of it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Search, X } from 'lucide-react'

export type ProductPickerOption = {
  id: string
  name: string
  /**
   * The row's second line — the SKU's spec, where the surface has one. It is
   * also what the group headers are derived from; see `productGroup`.
   */
  detail?: string
}

type ProductPickerProps = {
  /** Which surface is asking, e.g. `issue`. Scopes the recently-used list. */
  scope: string
  options: ProductPickerOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDismiss: () => void
  /** The `PRODUCT … CHANGE` row that opened the sheet, so focus can go back. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/** Three is a shift's worth of repetition without pushing the catalogue down. */
const RECENT_LIMIT = 3

const recentKey = (scope: string) => `boa-bar:recent-sku:${scope}`

/**
 * `localStorage` throws outright in a private window and in some embedded
 * contexts, and returns nothing at all after site data is cleared. Neither is an
 * error worth surfacing — a picker with no remembered products is the normal
 * first-use state, so both collapse to an empty list.
 */
function readRecent(scope: string): string[] {
  try {
    const raw = window.localStorage.getItem(recentKey(scope))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

function rememberRecent(scope: string, id: string): void {
  try {
    const next = [id, ...readRecent(scope).filter((value) => value !== id)].slice(0, RECENT_LIMIT)
    window.localStorage.setItem(recentKey(scope), JSON.stringify(next))
  } catch {
    // Nothing to recover: the choice itself has already been made and applied.
  }
}

/**
 * The category, for grouping. The repository hands the screens a display spec
 * (`Beer · 650 ml bottle`) and no separate category field, and BAR-176 may not
 * change the data layer, so the leading segment is what there is. Derived here
 * rather than in each screen, so the four surfaces cannot drift apart on it.
 *
 * A spec with no separator groups under itself, which is still stable and still
 * in repository order. An option with no spec at all — the bar workspace's
 * top-up list, whose read model carries no spec — lands in a single group with
 * no header rather than one headed by a guess.
 */
function productGroup(spec: string | undefined): string | undefined {
  if (!spec) return undefined
  const [head] = spec.split('·')
  const label = head?.trim()
  return label === '' ? undefined : label
}

type OptionGroup = { key: string; label: string | null; options: ProductPickerOption[] }

export function ProductPicker({
  scope, options, selectedId, onSelect, onDismiss, returnFocusTo,
}: ProductPickerProps) {
  const [query, setQuery] = useState('')
  const sheetRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  /**
   * Read once, on open. Re-reading per render would let the list reorder under a
   * finger already on its way down to a row.
   */
  const [recent] = useState(() => readRecent(scope))

  const groups = useMemo<OptionGroup[]>(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle === ''
      ? options
      : options.filter((option) =>
        option.name.toLowerCase().includes(needle) || (option.detail ?? '').toLowerCase().includes(needle))

    const built: OptionGroup[] = []

    // Recently-used leads, but only while browsing. Someone typing a name has
    // already recalled it, and moving their match under a RECENT header would
    // put the row they are aiming at somewhere they did not expect.
    if (needle === '') {
      const recentOptions = recent
        .map((id) => matches.find((option) => option.id === id))
        .filter((option): option is ProductPickerOption => option !== undefined)
      if (recentOptions.length > 0) built.push({ key: 'recent', label: 'RECENT', options: recentOptions })
    }

    // Repository order, preserved: first appearance decides where a group sits.
    const byGroup = new Map<string, ProductPickerOption[]>()
    for (const option of matches) {
      const key = productGroup(option.detail) ?? ''
      const bucket = byGroup.get(key)
      if (bucket) bucket.push(option)
      else byGroup.set(key, [option])
    }
    for (const [key, bucketOptions] of byGroup) {
      built.push({ key: `group:${key}`, label: key === '' ? null : key, options: bucketOptions })
    }

    return built
  }, [options, query, recent])

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
  }, [])

  /**
   * Escape dismisses, and Tab stays inside the sheet. The returned focus is the
   * trigger the person tapped: dismissing without choosing has to put them back
   * where they were, not at the top of the document.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab') return
      const sheet = sheetRef.current
      if (!sheet) return
      const focusable = [...sheet.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute('disabled'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  useEffect(() => {
    // Captured at open rather than trusted at close: by then the sheet is gone
    // and `document.activeElement` is the body.
    const opener = returnFocusTo?.current ?? (document.activeElement as HTMLElement | null)
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [returnFocusTo])

  const choose = (id: string) => {
    rememberRecent(scope, id)
    onSelect(id)
    onDismiss()
  }

  return (
    <div
      className="picker-scrim"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss() }}
    >
      <section className="picker-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="product-picker-title">
        <div className="picker-head">
          <span className="picker-title" id="product-picker-title">CHOOSE PRODUCT</span>
          <button className="picker-close" onClick={onDismiss} aria-label="Close without choosing">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <label className="wh-search picker-search">
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product"
            aria-label="Search product"
            autoComplete="off"
          />
        </label>

        <div className="picker-list">
          {groups.length === 0 ? (
            <p className="section-empty">No product matches that. Clear the search to see the whole catalogue.</p>
          ) : groups.map((group) => (
            <div className="picker-group" key={group.key}>
              {group.label === null ? null : <span className="picker-group-label">{group.label}</span>}
              {group.options.map((option) => (
                <button
                  key={`${group.key}:${option.id}`}
                  className={`picker-row ${option.id === selectedId ? 'is-selected' : ''}`}
                  onClick={() => choose(option.id)}
                  aria-current={option.id === selectedId}
                >
                  <span className="picker-row-main">
                    <strong>{option.name}</strong>
                    {option.detail ? <small>{option.detail}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

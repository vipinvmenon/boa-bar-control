/**
 * BAR-072 — keep unfinished work across a reload.
 *
 * Lives in the data layer, not in a screen, because `docs/ARCHITECTURE.md` rule 1
 * is that a screen never imports Dexie. A screen asks for a draft; it does not
 * know where one is kept.
 *
 * The case this exists for: a crew member is twelve lines into an eighteen-line
 * count, the phone's browser reclaims the tab or somebody pulls to refresh, and
 * the count is gone. A write can be retried from the same facts. A count cannot —
 * by the time anybody notices, the stock has moved.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, readDraft, writeDraft } from '../lib/offline-db'

export type DraftState<T> = {
  /** The restored draft, or the initial value once loading has finished. */
  value: T
  setValue: (next: T | ((current: T) => T)) => void
  /** Remove it — call this once the work has been accepted, never before. */
  clear: () => Promise<void>
  /**
   * False until the stored draft has been read. A screen must not render its
   * inputs before this is true: showing a zeroed sheet and then replacing it a
   * moment later invites somebody to start typing into the wrong one.
   */
  ready: boolean
  /** True when a previous session's work was restored, so the screen can say so. */
  restored: boolean
}

export function useDraft<T>(key: string | null, initial: T, isValid: (raw: unknown) => raw is T): DraftState<T> {
  const [value, setInner] = useState<T>(initial)
  const [ready, setReady] = useState(false)
  const [restored, setRestored] = useState(false)
  // Avoids writing the initial value back over a draft before it has loaded.
  const loaded = useRef(false)

  useEffect(() => {
    if (!key) return
    let active = true
    loaded.current = false
    setReady(false)
    void readDraft(key).then((raw) => {
      if (!active) return
      // Validated, not cast. A draft written by an older build has a different
      // shape, and feeding that into a submit is worse than losing it.
      if (isValid(raw)) {
        setInner(raw)
        setRestored(true)
      }
      loaded.current = true
      setReady(true)
    })
    return () => {
      active = false
    }
    // `isValid` is a stable module-level predicate at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      setInner((current) => {
        const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next
        // Persist on every change rather than on a timer: the whole point is to
        // survive a reload nobody chose, which gives no chance to flush.
        if (key && loaded.current) void writeDraft(key, resolved)
        return resolved
      })
    },
    [key],
  )

  const clear = useCallback(async () => {
    if (key) await clearDraft(key)
    setRestored(false)
  }, [key])

  return { value, setValue, clear, ready, restored }
}

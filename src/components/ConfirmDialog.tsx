import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/*
   BAR-178 — the app's guard on destructive things, made to behave like one.

   Three screens raise this dialog: signing out (which clears cached SKU data
   and any count in progress), leaving a count, and discarding a delivery. Until
   now both choices rendered as `.flow-cta-ghost` and the confirm was
   distinguished only by `is-active` — a red border on an otherwise identical
   button. The `tone` prop existed but no caller has ever passed it, so the
   danger treatment had never rendered once. The confirm is now filled and toned;
   cancel stays ghost. Two equally weighted buttons is not a decision, it is a
   coin toss.

   It also managed no focus at all: no autofocus, no trap, no return. Focus now
   moves to CANCEL on open, deliberately — a dialog that opens with the
   destructive action focused turns a stray Return key into the exact thing the
   dialog exists to prevent.

   Callers are untouched by design, so every prop keeps its meaning and `tone`
   still defaults to 'warning'.
*/

/**
 * Everything inside the dialog that can hold focus. `:not([disabled])` matters:
 * while `busy` both buttons are disabled and this list is empty, and the trap
 * below has to hold focus on the dialog box itself rather than let Tab walk out
 * into the page behind a write that is still in flight.
 */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type ConfirmDialogProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel, tone = 'warning', onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)

  // Declared first so its cleanup runs first: the focus-return effect below
  // must be able to move focus out of the dialog on close without this pulling
  // it straight back in.
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const root = dialogRef.current
      if (!root || root.contains(event.target as Node)) return
      const first = root.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? root).focus()
    }
    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busy) onCancel()
        return
      }
      if (event.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      const inside = root.contains(active)
      const edge = event.shiftKey ? first : last
      if (active === edge || !inside) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  // Disabling the focused button drops focus to <body>, which is outside the
  // trap. Take it onto the dialog box so it stays inside for the whole write.
  useEffect(() => {
    if (busy) dialogRef.current?.focus()
  }, [busy])

  useEffect(() => {
    openerRef.current = document.activeElement
    cancelRef.current?.focus()
    return () => {
      const opener = openerRef.current
      // Sign-out unmounts the trigger along with the screen, so returning focus
      // to a detached node would silently blur to <body>.
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  return <div className="confirm-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section ref={dialogRef} tabIndex={-1} className={`confirm-dialog confirm-dialog-${tone}`} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="confirm-dialog-mark" aria-hidden="true">!</div>
      <h2 id="confirm-dialog-title">{title}</h2>
      <div className="confirm-dialog-copy">{children}</div>
      <div className="confirm-dialog-actions">
        <button ref={cancelRef} className="flow-cta-ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button className={tone === 'danger' ? 'flow-cta is-short' : 'flow-cta-gold'} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </section>
  </div>
}

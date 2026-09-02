import { useEffect } from 'react'
import type { ReactNode } from 'react'

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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  return <div className="confirm-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section className={`confirm-dialog confirm-dialog-${tone}`} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="confirm-dialog-mark" aria-hidden="true">!</div>
      <h2 id="confirm-dialog-title">{title}</h2>
      <div className="confirm-dialog-copy">{children}</div>
      <div className="confirm-dialog-actions">
        <button className="flow-cta-ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button className="flow-cta-ghost is-active" onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </section>
  </div>
}

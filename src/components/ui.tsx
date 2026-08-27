import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

export function SectionLabel({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {action}
    </div>
  )
}

export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>
}

type RitualButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'green' | 'gold' | 'red' | 'ghost'
  wide?: boolean
}

export function RitualButton({ tone = 'green', wide, className = '', ...props }: RitualButtonProps) {
  return <button className={`ritual-button ${tone} ${wide ? 'wide' : ''} ${className}`} {...props} />
}

export function Stepper({ value, onChange, min = 0, step = 1, label }: {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  label: string
}) {
  return (
    <div className="stepper" aria-label={label}>
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus size={24} aria-hidden="true" />
      </button>
      <strong>{value}</strong>
      <button aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}>
        <Plus size={24} aria-hidden="true" />
      </button>
    </div>
  )
}

export function StatusDot({ tone = 'green' }: { tone?: 'green' | 'gold' | 'red' }) {
  return <span className={`status-dot ${tone}`} aria-hidden="true" />
}

export function Chip({ active, tone = 'green', children, onClick }: PropsWithChildren<{
  active?: boolean
  tone?: 'green' | 'gold' | 'red'
  onClick?: () => void
}>) {
  return (
    <button className={`chip ${tone} ${active ? 'active' : ''}`} onClick={onClick} type="button">
      {children}
    </button>
  )
}

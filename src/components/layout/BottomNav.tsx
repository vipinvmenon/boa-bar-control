/**
 * BAR-039 — the bottom navigation.
 *
 * Values and icon paths taken verbatim from the `showNav` block of
 * references/design-source/design-markup.html.
 *
 * Two things the previous version got wrong, both visible on every screen:
 *
 *   1. The active tab drew a box — `background` plus an inset 1px ring. The
 *      design has no such treatment: the active tab is indicated by colour
 *      alone, green against sage-at-55%.
 *   2. The glyphs were lucide stand-ins. BARS was a storefront where the design
 *      draws a tapered drinking glass; ACTIVITY was a pulse line where the
 *      design draws three stacked rules; MORE was a hamburger where the design
 *      draws three filled dots.
 *
 * The design's icons are inlined rather than approximated from an icon set,
 * because "close enough" is how the shell drifted in the first place.
 */
import type { ReactElement } from 'react'
import { Link } from '@tanstack/react-router'

type NavItem = {
  to: string
  label: string
  icon: ReactElement
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 } as const

const ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'HOME',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M3.5 10.4 12 3.8l8.5 6.6V20a1 1 0 0 1-1 1h-4.6v-6H9.1v6H4.5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    to: '/warehouse',
    label: 'WAREHOUSE',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M12 3.2 3.8 7.2v9.6L12 20.8l8.2-4V7.2z" />
        <path d="M3.8 7.2 12 11.2l8.2-4M12 11.2v9.6" />
      </svg>
    ),
  },
  {
    to: '/bars',
    label: 'BARS',
    icon: (
      // A tapered glass, not a storefront.
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M6.4 3.5h11.2l-1.3 15.1a2 2 0 0 1-2 1.9h-4.6a2 2 0 0 1-2-1.9z" />
        <path d="M6.9 9.5h10.2" />
      </svg>
    ),
  },
  {
    to: '/activity',
    label: 'ACTIVITY',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M4 6.5h16M4 12h16M4 17.5h9" />
      </svg>
    ),
  },
  {
    to: '/more',
    label: 'MORE',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5.5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="18.5" cy="12" r="1.7" />
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === '/' }}
          className="nav-item"
          activeProps={{ className: 'nav-item nav-item-active' }}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

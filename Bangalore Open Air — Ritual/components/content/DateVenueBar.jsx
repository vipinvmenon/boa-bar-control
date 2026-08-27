import React from 'react';

/**
 * DateVenueBar — the gold data line: bold condensed caps, pipe separators.
 * e.g. SATURDAY | 10TH OCTOBER 2026 | BENGALURU, INDIA
 */
export function DateVenueBar({
  items = [],
  align = 'center',
  bordered = true,       // hairline rules top & bottom
  glow = true,
  style,
  ...rest
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: bordered ? 'var(--sp-3) 0' : 0,
        borderTop: bordered ? '1.5px solid var(--line-gold)' : 'none',
        borderBottom: bordered ? '1.5px solid var(--line-gold)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--deep-gold)', fontFamily: 'var(--font-condensed)', fontSize: '18px' }}>|</span>}
          <span
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              fontSize: 'clamp(14px,1.9vw,20px)',
              letterSpacing: 'var(--tr-data)',
              textTransform: 'uppercase',
              color: 'var(--ritual-gold)',
              textShadow: glow ? 'var(--glow-gold-text)' : 'none',
            }}
          >
            {it}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

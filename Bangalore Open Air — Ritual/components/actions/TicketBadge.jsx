import React from 'react';

/**
 * TicketBadge — a ticket-tier pill (Headbangers Pass, Combo, Eddies Lounge, …).
 * tone: 'green' (standard), 'gold' (premium/headliner), 'ghost' (sold-out / muted).
 */
export function TicketBadge({
  tier,
  price,
  tone = 'green',        // 'green' | 'gold' | 'ghost'
  soldOut = false,
  style,
  ...rest
}) {
  const tones = {
    green: { border: 'var(--poison-green)', text: 'var(--poison-green)', glow: 'var(--glow-green-sm)' },
    gold: { border: 'var(--ritual-gold)', text: 'var(--ritual-gold)', glow: 'var(--glow-gold-sm)' },
    ghost: { border: 'var(--line-hairline)', text: 'var(--sage-bone)', glow: 'none' },
  };
  const t = soldOut ? tones.ghost : tones[tone];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: '8px 16px',
        background: 'var(--surface-sunken)',
        border: `1.5px solid ${t.border}`,
        borderRadius: 'var(--radius-pill)',
        boxShadow: t.glow,
        opacity: soldOut ? 0.6 : 1,
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 700,
          fontSize: '14px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.text,
          textDecoration: soldOut ? 'line-through' : 'none',
        }}
      >
        {tier}
      </span>
      {price && (
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--bone-white)',
            paddingLeft: 'var(--sp-3)',
            borderLeft: '1px solid var(--line-hairline)',
          }}
        >
          {soldOut ? 'Sold Out' : price}
        </span>
      )}
    </div>
  );
}

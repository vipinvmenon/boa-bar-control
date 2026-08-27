import React from 'react';

/**
 * PriceSticker — an urgency stamp for the Phase-2 price step ("PRICE RISES SOON").
 * Rotated wax-seal look with a hard drop shadow. Green or gold tone.
 */
export function PriceSticker({
  kicker = 'Price Rises Soon',
  price,                 // e.g. '₹2,499'
  strike,                // e.g. '₹1,999' old price shown struck
  tone = 'green',        // 'green' | 'gold'
  rotate = -8,
  style,
  ...rest
}) {
  const bg = tone === 'gold' ? 'var(--ritual-gold)' : 'var(--poison-green)';
  const glow = tone === 'gold' ? 'var(--glow-gold-sm)' : 'var(--glow-green-md)';
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        padding: '12px 20px',
        background: bg,
        color: 'var(--ink-black)',
        border: '2px solid var(--ink-black)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: `var(--shadow-sticker), ${glow}`,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          fontFamily: 'var(--font-eyebrow)',
          fontSize: '12px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {kicker}
      </span>
      {price && (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px' }}>
          {strike && (
            <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: '15px', textDecoration: 'line-through', opacity: 0.6 }}>
              {strike}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: '30px', letterSpacing: '0.02em', lineHeight: 1 }}>
            {price}
          </span>
        </span>
      )}
    </div>
  );
}

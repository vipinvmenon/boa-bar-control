import React from 'react';

/**
 * LineupBlock — festival bill. Headliners emphasised in ritual-gold, supports in
 * bone-white/sage-bone. Pass artists as an array of { name, tier }.
 * tier: 'headliner' | 'support' | 'special'.
 */
export function LineupBlock({
  artists = [],
  align = 'center',
  columns = 1,           // wrap supports into N columns
  style,
  ...rest
}) {
  const headliners = artists.filter((a) => a.tier === 'headliner');
  const specials = artists.filter((a) => a.tier === 'special');
  const supports = artists.filter((a) => !a.tier || a.tier === 'support');

  const wrapAlign = align === 'center' ? 'center' : 'flex-start';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', alignItems: wrapAlign, textAlign: align, ...style }}
      {...rest}
    >
      {headliners.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', alignItems: wrapAlign }}>
          {headliners.map((a, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 'clamp(32px,6vw,56px)',
                lineHeight: 0.98,
                textTransform: 'uppercase',
                letterSpacing: 'var(--tr-headline)',
                color: 'var(--ritual-gold)',
                textShadow: 'var(--glow-gold-text)',
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
      )}

      {specials.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 var(--sp-4)', justifyContent: wrapAlign }}>
          {specials.map((a, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 700,
                fontSize: 'clamp(18px,2.6vw,26px)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--poison-green)',
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
      )}

      {supports.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, auto)`,
            gap: 'var(--sp-2) var(--sp-5)',
            justifyContent: wrapAlign,
          }}
        >
          {supports.map((a, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 600,
                fontSize: 'clamp(15px,2vw,20px)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--bone-white)',
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

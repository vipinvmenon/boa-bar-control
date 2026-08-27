import React from 'react';

/**
 * SponsorStrip — partner logos/names on ink, equal optical weight. Renders text
 * names by default; pass `logos` (array of {src, alt}) to use real logo images
 * (preserve each partner's native lockup — don't recolour).
 */
export function SponsorStrip({
  label = 'Presented with',
  sponsors = [],         // string[] fallback names
  logos = null,          // [{ src, alt, height }]
  align = 'center',
  style,
  ...rest
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: 'var(--sp-3)',
        ...style,
      }}
      {...rest}
    >
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 600,
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--sage-bone)',
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          gap: 'var(--sp-4) var(--sp-6)',
        }}
      >
        {logos
          ? logos.map((l, i) => (
              <img key={i} src={l.src} alt={l.alt} style={{ height: l.height || 26, opacity: 0.92, filter: 'grayscale(1) brightness(1.4)' }} />
            ))
          : sponsors.map((s, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontWeight: 700,
                  fontSize: 'clamp(13px,1.6vw,17px)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--bone-white)',
                  opacity: 0.85,
                }}
              >
                {s}
              </span>
            ))}
      </div>
    </div>
  );
}

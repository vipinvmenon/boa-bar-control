import React from 'react';

/**
 * HeadlineBlock — eyebrow + condensed headline + subhead. The core message unit
 * for ads. Headline in bone-white (or gold when `accent`), eyebrow in poison-green.
 */
export function HeadlineBlock({
  eyebrow,
  headline,
  subhead,
  accent = false,        // headline in ritual-gold instead of bone-white
  align = 'left',        // 'left' | 'center'
  size = 'md',           // 'sm' | 'md' | 'lg'
  style,
  ...rest
}) {
  const hlSize = { sm: 'clamp(28px,5vw,40px)', md: 'clamp(40px,7vw,64px)', lg: 'clamp(52px,9vw,88px)' }[size];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        ...style,
      }}
      {...rest}
    >
      {eyebrow && (
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 700,
            fontSize: 'var(--fs-small)',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--poison-green)',
            textShadow: 'var(--glow-green-sm)',
          }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-headline)',
          fontSize: hlSize,
          lineHeight: 'var(--lh-tight)',
          letterSpacing: 'var(--tr-headline)',
          textTransform: 'uppercase',
          color: accent ? 'var(--ritual-gold)' : 'var(--bone-white)',
          textShadow: accent ? 'var(--glow-gold-text)' : 'none',
          textWrap: 'balance',
        }}
      >
        {headline}
      </h2>
      {subhead && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body)',
            lineHeight: 'var(--lh-body)',
            color: 'var(--text-body)',
            maxWidth: '46ch',
            textWrap: 'pretty',
          }}
        >
          {subhead}
        </p>
      )}
    </div>
  );
}

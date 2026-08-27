import React from 'react';

/**
 * CTAButton — primary: ritual-gold fill / ink-black text. ghost: poison-green outline.
 * Condensed uppercase caps. Sharp corners with a subtle glow.
 */
export function CTAButton({
  children,
  variant = 'primary',   // 'primary' | 'ghost' | 'green'
  size = 'md',           // 'sm' | 'md' | 'lg'
  as = 'button',
  style,
  ...rest
}) {
  const pad = { sm: '8px 16px', md: '13px 26px', lg: '18px 40px' }[size];
  const fs = { sm: '13px', md: '15px', lg: '19px' }[size];

  const variants = {
    primary: {
      background: 'var(--ritual-gold)',
      color: 'var(--ink-black)',
      border: '1.5px solid var(--deep-gold)',
      boxShadow: 'var(--glow-gold-sm)',
    },
    green: {
      background: 'var(--poison-green)',
      color: 'var(--ink-black)',
      border: '1.5px solid var(--venom-green)',
      boxShadow: 'var(--glow-green-md)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--poison-green)',
      border: '2px solid var(--poison-green)',
      boxShadow: 'inset 0 0 0 rgba(0,0,0,0), var(--glow-green-sm)',
    },
  };

  const Tag = as;

  return (
    <Tag
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-2)',
        padding: pad,
        fontFamily: 'var(--font-condensed)',
        fontWeight: 700,
        fontSize: fs,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'transform var(--dur-fast) var(--ease-ritual), filter var(--dur-fast) var(--ease-ritual)',
        ...variants[variant],
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px) scale(0.99)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'none')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

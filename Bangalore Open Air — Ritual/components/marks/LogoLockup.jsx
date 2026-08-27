import React from 'react';

/**
 * LogoLockup — the OFFICIAL Bangalore Open Air logo (spiky green-glow wordmark + OPEN AIR).
 * Renders the supplied PNG artwork. Pass `src` with the correct relative path from the
 * consuming page (defaults to a root-level 'assets/boa-logo-2026.png').
 */
export function LogoLockup({
  src = 'assets/boa-logo-2026.png',
  size = 'md',             // 'sm' | 'md' | 'lg'
  variant = 'full',        // 'full' | 'mono' (mono = desaturated bone-white, for busy photos)
  glow = true,
  style,
  ...rest
}) {
  const width = { sm: 220, md: 380, lg: 560 }[size] ?? 380;
  const mono = variant === 'mono';
  const filter = [
    glow && !mono ? 'drop-shadow(0 0 16px rgba(0,245,165,0.45))' : '',
    mono ? 'grayscale(1) brightness(1.7) contrast(1.05)' : '',
  ].filter(Boolean).join(' ');

  return (
    <img
      src={src}
      alt="Bangalore Open Air"
      style={{ width, height: 'auto', filter: filter || 'none', display: 'block', ...style }}
      {...rest}
    />
  );
}

import React from 'react';

/**
 * Motif — drop-in ritual atmosphere layer: green aura, grain/halftone texture,
 * and a bottom venom-wash. Place BEHIND or OVER hero content (position it absolutely
 * and let it fill its container). Purely decorative; aria-hidden.
 */
export function Motif({
  aura = true,           // radial green glow
  texture = 'grain',     // 'grain' | 'halftone' | 'none'
  wash = false,          // bottom venom->ink protection wash (over photos)
  intensity = 1,         // 0..1 multiplier on aura opacity
  style,
  ...rest
}) {
  const texBg =
    texture === 'halftone'
      ? { backgroundImage: 'var(--texture-halftone)', backgroundSize: 'var(--texture-halftone-size)' }
      : texture === 'grain'
      ? { backgroundImage: 'var(--texture-grain)', backgroundSize: 'var(--texture-grain-size)' }
      : {};

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...style }}
      {...rest}
    >
      {aura && (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-aura)', opacity: intensity }} />
      )}
      {texture !== 'none' && <div style={{ position: 'absolute', inset: 0, ...texBg }} />}
      {wash && <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-venom-wash)' }} />}
    </div>
  );
}

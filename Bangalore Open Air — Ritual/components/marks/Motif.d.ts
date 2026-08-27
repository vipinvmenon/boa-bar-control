import React from 'react';

export interface MotifProps {
  /** radial poison-green aura glow */
  aura?: boolean;
  /** overlay texture */
  texture?: 'grain' | 'halftone' | 'none';
  /** bottom venom→ink protection wash (use over photography) */
  wash?: boolean;
  /** 0..1 multiplier on aura opacity */
  intensity?: number;
  style?: React.CSSProperties;
}

/**
 * Decorative ritual atmosphere layer (aura + texture + wash). Absolutely positioned,
 * fills its nearest positioned ancestor. aria-hidden.
 */
export function Motif(props: MotifProps): JSX.Element;

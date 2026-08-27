import React from 'react';

/**
 * Eyebrow + condensed headline + subhead — the core message unit for ads.
 * @startingPoint section="Content" subtitle="Eyebrow + headline + subhead" viewport="640x260"
 */
export interface HeadlineBlockProps {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  /** headline in ritual-gold (headliner spotlight) instead of bone-white */
  accent?: boolean;
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

export function HeadlineBlock(props: HeadlineBlockProps): JSX.Element;

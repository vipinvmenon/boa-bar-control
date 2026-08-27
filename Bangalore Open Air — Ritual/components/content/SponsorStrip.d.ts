import React from 'react';

export interface SponsorLogo {
  src: string;
  alt: string;
  height?: number;
}

export interface SponsorStripProps {
  label?: string;
  /** fallback text names when no logo images */
  sponsors?: string[];
  /** real partner logos — preserve native lockups, don't recolour */
  logos?: SponsorLogo[] | null;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
}

/**
 * Partner strip on ink, equal optical weight (BookMyShow, Wacken Foundation, …).
 */
export function SponsorStrip(props: SponsorStripProps): JSX.Element;

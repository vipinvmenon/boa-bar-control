import React from 'react';

/**
 * The official Bangalore Open Air logo lockup (green-glow wordmark artwork).
 * Give it clear space of at least the cap-height of BANGALORE on all sides.
 * @startingPoint section="Brand" subtitle="Official BOA logo artwork" viewport="600x240"
 */
export interface LogoLockupProps {
  /** relative path to the logo PNG from the consuming page */
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  /** full = green-glow original; mono = desaturated bone-white for busy photo backgrounds */
  variant?: 'full' | 'mono';
  /** poison-green outer drop-shadow */
  glow?: boolean;
  style?: React.CSSProperties;
}

export function LogoLockup(props: LogoLockupProps): JSX.Element;

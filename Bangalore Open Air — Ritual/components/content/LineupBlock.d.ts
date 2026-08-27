import React from 'react';

export interface Artist {
  name: string;
  /** headliner = gold; special = green; support = bone-white */
  tier?: 'headliner' | 'support' | 'special';
}

/**
 * Festival bill — headliners emphasised in ritual-gold, supports in bone-white.
 * @startingPoint section="Content" subtitle="Headliners in gold, supports in bone" viewport="640x360"
 */
export interface LineupBlockProps {
  artists: Artist[];
  align?: 'left' | 'center';
  /** wrap the support acts into N columns */
  columns?: number;
  style?: React.CSSProperties;
}

export function LineupBlock(props: LineupBlockProps): JSX.Element;

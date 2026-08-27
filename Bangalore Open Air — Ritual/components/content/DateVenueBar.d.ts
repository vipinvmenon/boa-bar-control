import React from 'react';

export interface DateVenueBarProps {
  /** e.g. ['Saturday', '10th October 2026', 'Bengaluru, India'] — joined with gold pipes */
  items: string[];
  align?: 'left' | 'center';
  /** hairline gold rules top & bottom */
  bordered?: boolean;
  glow?: boolean;
  style?: React.CSSProperties;
}

/**
 * The gold data line — bold condensed caps with pipe separators.
 */
export function DateVenueBar(props: DateVenueBarProps): JSX.Element;

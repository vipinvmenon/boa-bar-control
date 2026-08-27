import React from 'react';

export interface TicketBadgeProps {
  tier: string;
  price?: string;
  /** green = standard, gold = premium, ghost = muted */
  tone?: 'green' | 'gold' | 'ghost';
  soldOut?: boolean;
  style?: React.CSSProperties;
}

/**
 * A ticket-tier pill (Headbangers Pass, Combo, Eddies Lounge…).
 */
export function TicketBadge(props: TicketBadgeProps): JSX.Element;

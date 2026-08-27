import React from 'react';

export interface PriceStickerProps {
  kicker?: string;
  /** current price, e.g. '₹2,499' */
  price?: string;
  /** struck-through old price */
  strike?: string;
  tone?: 'green' | 'gold';
  /** rotation in degrees */
  rotate?: number;
  style?: React.CSSProperties;
}

/**
 * Urgency stamp for the Phase-2 price step ("PRICE RISES SOON").
 */
export function PriceSticker(props: PriceStickerProps): JSX.Element;

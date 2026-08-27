import React from 'react';

/**
 * The festival CTA. Primary gold for "Get Tickets"; ghost green for secondary.
 * @startingPoint section="Actions" subtitle="Primary gold / ghost green CTA" viewport="360x120"
 */
export interface CTAButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** primary = gold fill; ghost = green outline; green = poison-green fill */
  variant?: 'primary' | 'ghost' | 'green';
  size?: 'sm' | 'md' | 'lg';
  /** render as 'a' for links */
  as?: 'button' | 'a';
  children?: React.ReactNode;
}

export function CTAButton(props: CTAButtonProps): JSX.Element;

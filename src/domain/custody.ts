/**
 * BAR-044 / BAR-058 — the custody rules, as pure functions.
 *
 * These exist here rather than in a screen or a service because the database
 * enforces the same rules in `boa_bar_accept_docket`, and two statements of one
 * rule drift. The client copy is a usability affordance — it disables a button
 * instead of letting somebody submit a write the server will refuse — and never a
 * control. The control is the RPC (non-negotiable 7).
 */

export type CustodyLine = {
  skuId: string
  issuedContainers: number
  acceptedContainers: number
}

/** Accepted less than issued on any line. */
export function isShortAcceptance(lines: CustodyLine[]): boolean {
  return lines.some((line) => line.acceptedContainers < line.issuedContainers)
}

/** Accepted more than issued on any line — the server refuses this outright. */
export function isOverAcceptance(lines: CustodyLine[]): boolean {
  return lines.some((line) => line.acceptedContainers > line.issuedContainers)
}

/** Total containers unaccounted for, across all lines. */
export function shortfall(lines: CustodyLine[]): number {
  return lines.reduce(
    (total, line) => total + Math.max(0, line.issuedContainers - line.acceptedContainers),
    0,
  )
}

/**
 * A short acceptance requires a stated reason.
 *
 * Specification section 5: the value of a two-party docket is that a discrepancy
 * is attributed at the moment it is discovered, by the person who discovered it.
 * A shortfall accepted without a reason is a quantity that has vanished with
 * nobody's name against it — which is exactly the case the paper docket book
 * existed to prevent.
 */
export function requiresDifferenceReason(lines: CustodyLine[]): boolean {
  return isShortAcceptance(lines)
}

export type AcceptanceProblem =
  | { kind: 'no-lines' }
  | { kind: 'negative' }
  | { kind: 'over-accepted' }
  | { kind: 'reason-missing' }

/**
 * Why an acceptance cannot be submitted, or null if it can.
 *
 * Mirrors, in order, what `boa_bar_accept_docket` raises: 'acceptance needs at
 * least one line', 'accepted quantities cannot be negative', 'cannot accept more
 * than issued for sku %', 'a short acceptance requires difference_reason'.
 */
export function acceptanceProblem(
  lines: CustodyLine[],
  differenceReason: string | undefined,
): AcceptanceProblem | null {
  if (lines.length === 0) return { kind: 'no-lines' }
  if (lines.some((line) => line.acceptedContainers < 0)) return { kind: 'negative' }
  if (isOverAcceptance(lines)) return { kind: 'over-accepted' }
  if (requiresDifferenceReason(lines) && !(differenceReason ?? '').trim()) {
    return { kind: 'reason-missing' }
  }
  return null
}

/** Millilitres for a container count. The docket RPC requires both. */
export function mlForContainers(containers: number, mlPerContainer: number): number {
  return containers * mlPerContainer
}

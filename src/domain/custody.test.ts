/**
 * BAR-044 / BAR-058 — the custody rules.
 *
 * Every expectation here has a counterpart in `boa_bar_accept_docket`. The client
 * check is an affordance, not a control, so the point of these tests is that the
 * affordance agrees with the control — a button enabled for a write the server
 * will refuse is a worse experience than no check at all.
 */
import { describe, expect, it } from 'vitest'
import {
  acceptanceProblem,
  isOverAcceptance,
  isShortAcceptance,
  mlForContainers,
  requiresDifferenceReason,
  shortfall,
  type CustodyLine,
} from './custody'

const full: CustodyLine[] = [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 48 }]
const short: CustodyLine[] = [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 44 }]
const over: CustodyLine[] = [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 60 }]

describe('shortness and overage', () => {
  it('a full acceptance is neither short nor over', () => {
    expect(isShortAcceptance(full)).toBe(false)
    expect(isOverAcceptance(full)).toBe(false)
    expect(shortfall(full)).toBe(0)
  })

  it('detects a shortfall and totals it across lines', () => {
    expect(isShortAcceptance(short)).toBe(true)
    expect(shortfall(short)).toBe(4)
    expect(
      shortfall([
        { skuId: 'a', issuedContainers: 10, acceptedContainers: 8 },
        { skuId: 'b', issuedContainers: 5, acceptedContainers: 5 },
        { skuId: 'c', issuedContainers: 12, acceptedContainers: 9 },
      ]),
    ).toBe(5)
  })

  it('does not let an overage on one line mask a shortfall on another', () => {
    // Netting them would let 12 extra Coronas explain away 4 missing Kingfishers.
    const mixed: CustodyLine[] = [
      { skuId: 'kf', issuedContainers: 48, acceptedContainers: 44 },
      { skuId: 'cor', issuedContainers: 24, acceptedContainers: 36 },
    ]
    expect(isShortAcceptance(mixed)).toBe(true)
    expect(isOverAcceptance(mixed)).toBe(true)
    expect(shortfall(mixed)).toBe(4)
  })
})

describe('a short acceptance requires a reason', () => {
  it('is required when short, not when full', () => {
    expect(requiresDifferenceReason(short)).toBe(true)
    expect(requiresDifferenceReason(full)).toBe(false)
  })

  it('blocks submission until the reason is given', () => {
    expect(acceptanceProblem(short, undefined)).toEqual({ kind: 'reason-missing' })
    expect(acceptanceProblem(short, '   ')).toEqual({ kind: 'reason-missing' })
    expect(acceptanceProblem(short, 'Breakage in transit')).toBeNull()
  })

  it('does not demand a reason for a full acceptance', () => {
    expect(acceptanceProblem(full, undefined)).toBeNull()
  })
})

describe('acceptanceProblem reports the same objections as the RPC, in the same order', () => {
  it('no lines', () => {
    expect(acceptanceProblem([], 'x')).toEqual({ kind: 'no-lines' })
  })

  it('negative quantities before anything else', () => {
    expect(
      acceptanceProblem([{ skuId: 'kf', issuedContainers: 48, acceptedContainers: -1 }], undefined),
    ).toEqual({ kind: 'negative' })
  })

  it('over-acceptance, which no reason can excuse', () => {
    // Receiving more than was issued is not a discrepancy to explain; it means
    // the docket or the count is wrong.
    expect(acceptanceProblem(over, 'Short on pallet')).toEqual({ kind: 'over-accepted' })
  })

  it('accepts a clean full receipt', () => {
    expect(acceptanceProblem(full, undefined)).toBeNull()
  })

  it('accepts zero received, with a reason — the load never arrived', () => {
    const nothing: CustodyLine[] = [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 0 }]
    expect(acceptanceProblem(nothing, 'Never arrived')).toBeNull()
    expect(shortfall(nothing)).toBe(48)
  })
})

describe('mlForContainers', () => {
  it('multiplies, because the docket RPC requires both figures', () => {
    expect(mlForContainers(48, 650)).toBe(31_200)
    expect(mlForContainers(0, 650)).toBe(0)
  })
})

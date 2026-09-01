/**
 * BAR-044 / BAR-070 / BAR-074 — the outbox's ordering and retry rules.
 *
 * The ordering assertions are the ones that matter. Every other test here
 * describes behaviour that is merely correct; those describe behaviour whose
 * absence silently corrupts the ledger's causal history.
 */
import { describe, expect, it } from 'vitest'
import {
  classifyFailure,
  failureMessage,
  hasAuthStoppedEntry,
  isTerminal,
  MAX_ATTEMPTS,
  nextAttemptDelayMs,
  selectDrainBatch,
  type OutboxEntryState,
} from './outbox-policy'

const NOW = 1_760_000_000_000

function entry(over: Partial<OutboxEntryState> & { id: string }): OutboxEntryState {
  return {
    status: 'pending',
    attempts: 0,
    nextAttemptAt: NOW - 1_000,
    createdAt: NOW - 10_000,
    ...over,
  }
}

describe('selectDrainBatch — the ordering guarantee', () => {
  it('drains in creation order, not in the order it happens to read them', () => {
    const batch = selectDrainBatch(
      [
        entry({ id: 'accept', createdAt: NOW - 5_000 }),
        entry({ id: 'issue', createdAt: NOW - 9_000 }),
      ],
      NOW,
    )
    expect(batch.map((e) => e.id)).toEqual(['issue', 'accept'])
  })

  it('STOPS at an entry in backoff rather than stepping over it', () => {
    // The defect this replaces: the previous drain selected every entry whose
    // nextAttemptAt had passed, so an issue that failed once was skipped while
    // its own acceptance went ahead of it — an acceptance of a docket the ledger
    // did not yet contain.
    const batch = selectDrainBatch(
      [
        entry({ id: 'issue', createdAt: NOW - 9_000, attempts: 1, nextAttemptAt: NOW + 30_000 }),
        entry({ id: 'accept', createdAt: NOW - 5_000 }),
      ],
      NOW,
    )
    expect(batch).toEqual([])
  })

  it('stops at a terminal entry, permanently, until a human deals with it', () => {
    const batch = selectDrainBatch(
      [
        entry({ id: 'stuck', createdAt: NOW - 9_000, status: 'failed', attempts: MAX_ATTEMPTS }),
        entry({ id: 'later', createdAt: NOW - 5_000 }),
      ],
      NOW,
    )
    // Silently stepping over a write that could not be posted is how a ledger
    // acquires a gap nobody notices.
    expect(batch).toEqual([])
  })

  it('stops at an entry another tab is already syncing', () => {
    const batch = selectDrainBatch(
      [
        entry({ id: 'inflight', createdAt: NOW - 9_000, status: 'syncing' }),
        entry({ id: 'later', createdAt: NOW - 5_000 }),
      ],
      NOW,
    )
    expect(batch).toEqual([])
  })

  it('breaks a createdAt tie deterministically, so two devices agree', () => {
    const batch = selectDrainBatch(
      [entry({ id: 'b', createdAt: NOW }), entry({ id: 'a', createdAt: NOW })],
      NOW,
    )
    expect(batch.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('skips a completed entry instead of stopping at it', () => {
    // Completed entries are retained because they hold the server's reply, so the
    // drain must step over them rather than treat them as a blockage.
    const batch = selectDrainBatch(
      [
        entry({ id: 'posted', createdAt: NOW - 9_000, status: 'done' }),
        entry({ id: 'next', createdAt: NOW - 5_000 }),
      ],
      NOW,
    )
    expect(batch.map((e) => e.id)).toEqual(['next'])
  })

  it('skips a resolved dead letter after an explicit human decision', () => {
    const batch = selectDrainBatch(
      [
        entry({ id: 'resolved', createdAt: NOW - 9_000, status: 'resolved' }),
        entry({ id: 'next', createdAt: NOW - 5_000 }),
      ],
      NOW,
    )
    expect(batch.map((e) => e.id)).toEqual(['next'])
  })

  it('returns everything eligible when nothing is blocked', () => {
    const batch = selectDrainBatch(
      [
        entry({ id: 'one', createdAt: NOW - 9_000 }),
        entry({ id: 'two', createdAt: NOW - 8_000 }),
        entry({ id: 'three', createdAt: NOW - 7_000 }),
      ],
      NOW,
    )
    expect(batch).toHaveLength(3)
  })

  it('does not mutate its input', () => {
    const entries = [entry({ id: 'b', createdAt: NOW }), entry({ id: 'a', createdAt: NOW - 1 })]
    const before = entries.map((e) => e.id)
    selectDrainBatch(entries, NOW)
    expect(entries.map((e) => e.id)).toEqual(before)
  })
})

describe('classifyFailure', () => {
  // Every message below is a real `raise exception` string from
  // supabase/migrations/, not an invention. The first version of this suite used
  // 'docket D-0184 has already been accepted', which no RPC raises — so it tested
  // the guess rather than the system, and passed while the patterns were wrong.

  it('treats a duplicate as success — the server already has the write', () => {
    for (const error of [
      new Error('duplicate key value violates unique constraint'),
      { message: 'docket D-0184 is already accepted', code: '23505' },
      { message: 'docket D-0184 is already accepted_short' },
    ]) {
      expect(classifyFailure(error)).toBe('duplicate')
    }
  })

  it('treats an auth failure as a reason to stop, not to retry', () => {
    for (const error of [
      new Error('not authorised for venue'),
      new Error('not authorised to issue stock'),
      new Error('not authorised to accept stock'),
      new Error('authentication required'),
      new Error('JWT expired'),
      new Error('request failed with status 401'),
      { message: 'only a manager may name another person', code: '42501' },
      { message: 'only warehouse, manager or admin may post opening stock' },
      { message: 'something the prose does not cover', code: '28000' },
    ]) {
      expect(classifyFailure(error)).toBe('auth')
    }
  })

  it('treats a rule the server will never accept as permanent, not retryable', () => {
    for (const error of [
      new Error('a docket needs at least one line'),
      new Error('a short acceptance requires difference_reason'),
      new Error('cannot accept more than issued for sku x (issued 48, offered 60)'),
      new Error('custody movements must balance across locations'),
      { message: 'each line needs positive containers and ml', code: '23514' },
      // The RPC deliberately uses 42501 for this custody boundary, but a new
      // login cannot make the issuer a different person. It is permanent, not
      // the auth-stop case used for an expired session.
      { message: 'a docket cannot be accepted by the person who issued it', code: '42501' },
    ]) {
      expect(classifyFailure(error)).toBe('invalid')
    }
  })

  it('treats "docket not found" as TRANSIENT, because custody spans two devices', () => {
    // The issuing device and the accepting device are different phones. The
    // acceptance can legitimately reach the server before the issue has drained
    // from the other device's queue. Dead-lettering this would discard every
    // acceptance that arrived first.
    expect(classifyFailure(new Error('docket not found'))).toBe('transient')
    expect(classifyFailure(new Error('docket D-0184 token has expired'))).toBe('transient')
  })

  it('treats anything else as transient', () => {
    for (const error of [new Error('fetch failed'), new Error('ECONNRESET'), new Error('')]) {
      expect(classifyFailure(error)).toBe('transient')
    }
    expect(classifyFailure(undefined)).toBe('transient')
    expect(classifyFailure(null)).toBe('transient')
    expect(classifyFailure('something odd')).toBe('transient')
  })

  it('classifies a duplicate ahead of an auth match when both appear', () => {
    // A duplicate is success; misreading it as auth would stop the entire drain.
    expect(classifyFailure(new Error('duplicate key — jwt also mentioned'))).toBe('duplicate')
  })
})

describe('failureMessage', () => {
  it('retains the message from a PostgREST-shaped plain object', () => {
    expect(failureMessage({
      message: 'a docket cannot be accepted by the person who issued it',
      code: '42501',
    })).toBe('a docket cannot be accepted by the person who issued it')
  })

  it('falls back only when no usable message exists', () => {
    expect(failureMessage(new Error('network unavailable'))).toBe('network unavailable')
    expect(failureMessage({ code: 'XX000' })).toBe('Unknown sync failure')
  })
})

describe('auth stop state', () => {
  it('detects retained auth failures without treating ordinary pending work as stopped', () => {
    expect(hasAuthStoppedEntry([
      { status: 'pending', lastError: 'JWT expired' },
    ])).toBe(true)
    expect(hasAuthStoppedEntry([
      { status: 'pending', lastError: 'fetch failed' },
      { status: 'done', lastError: 'authentication required' },
    ])).toBe(false)
  })
})

describe('backoff', () => {
  it('grows exponentially and caps at a minute', () => {
    expect(nextAttemptDelayMs(0)).toBe(1_000)
    expect(nextAttemptDelayMs(1)).toBe(2_000)
    expect(nextAttemptDelayMs(6)).toBe(60_000)
    // Uncapped backoff leaves the queue asleep for hours after the network
    // returns.
    expect(nextAttemptDelayMs(20)).toBe(60_000)
  })

  it('applies the jitter the caller supplies, and stays pure', () => {
    expect(nextAttemptDelayMs(1, 0.75)).toBe(1_500)
    expect(nextAttemptDelayMs(1, 1.25)).toBe(2_500)
  })

  it('treats a negative attempt count as the first attempt', () => {
    expect(nextAttemptDelayMs(-3)).toBe(1_000)
  })
})

describe('isTerminal', () => {
  it('is terminal at the cap, and not before', () => {
    expect(isTerminal(MAX_ATTEMPTS - 1)).toBe(false)
    expect(isTerminal(MAX_ATTEMPTS)).toBe(true)
  })
})

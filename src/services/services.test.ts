/**
 * BAR-044 — the use cases.
 *
 * These use a stub repository rather than the fixture one, because the point is to
 * assert what the SERVICE decides before any IO happens: what it rejects, what it
 * passes through, and that it never reaches the repository with an action the
 * database would refuse.
 */
import { describe, expect, it, vi } from 'vitest'
import type { CreateDocketCommand, AcceptDocketCommand, Repository } from '../data/repository'
import { issueStock } from './issue'
import { acceptDocket } from './accept'

const ACTION = '3f1c9a52-8d4e-4b21-9f77-1c2b6d5a0e33'

function stubRepository() {
  const createDocket = vi.fn(async (command: CreateDocketCommand) => ({
    status: 'posted' as const,
    docketId: 'd-1',
    docketNo: 'D-0184',
    received: command,
  }))
  const acceptDocketFn = vi.fn(async (command: AcceptDocketCommand) => ({
    status: 'posted' as const,
    docketId: command.docketId,
    docketNo: 'D-0184',
  }))
  return { createDocket, acceptDocket: acceptDocketFn } as unknown as Repository & {
    createDocket: typeof createDocket
    acceptDocket: typeof acceptDocketFn
  }
}

describe('issueStock', () => {
  const valid = {
    actionId: ACTION,
    fromLocationId: 'warehouse',
    toLocationId: 'bar-3',
    lines: [{ skuId: 'kf', containers: 48 }],
  }

  it('passes the action id through as the idempotency key', async () => {
    // BAR-069. The key identifies the user's action, so a retry reuses it and a
    // double tap produces one docket.
    const repository = stubRepository()
    await issueStock({ repository, ...valid })
    expect(repository.createDocket).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: ACTION }),
    )
  })

  it('rejects an empty docket without touching the repository', async () => {
    const repository = stubRepository()
    await expect(issueStock({ repository, ...valid, lines: [] })).rejects.toThrow(/at least one line/)
    expect(repository.createDocket).not.toHaveBeenCalled()
  })

  it('rejects a fractional container count', async () => {
    // A docket cannot issue half a bottle, and the ledger column is an integer.
    const repository = stubRepository()
    await expect(
      issueStock({ repository, ...valid, lines: [{ skuId: 'kf', containers: 1.5 }] }),
    ).rejects.toThrow(/whole/)
    expect(repository.createDocket).not.toHaveBeenCalled()
  })

  it('rejects a zero or negative line', async () => {
    const repository = stubRepository()
    await expect(
      issueStock({ repository, ...valid, lines: [{ skuId: 'kf', containers: 0 }] }),
    ).rejects.toThrow(/at least one container/)
  })

  it('rejects issuing to the same location it came from', async () => {
    // boa_bar_docket has the same CHECK; caught here so the button can say why.
    const repository = stubRepository()
    await expect(
      issueStock({ repository, ...valid, toLocationId: 'warehouse' }),
    ).rejects.toThrow(/came from/)
    expect(repository.createDocket).not.toHaveBeenCalled()
  })

  it('rejects the same product twice on one docket', async () => {
    // boa_bar_docket_line is unique on (docket_id, sku_id).
    const repository = stubRepository()
    await expect(
      issueStock({
        repository,
        ...valid,
        lines: [
          { skuId: 'kf', containers: 24 },
          { skuId: 'kf', containers: 24 },
        ],
      }),
    ).rejects.toThrow(/twice/)
  })

  it('rejects an action id that is not a UUID', async () => {
    // A non-UUID key cannot be an idempotency key: the column is uuid, so the
    // write would fail server-side after the user was told it succeeded.
    const repository = stubRepository()
    await expect(issueStock({ repository, ...valid, actionId: 'action-1' })).rejects.toThrow(/UUID/)
  })
})

describe('acceptDocket', () => {
  const full = {
    actionId: ACTION,
    docketId: 'd-1',
    lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 48 }],
  }

  it('accepts a full receipt and sends the received quantities', async () => {
    const repository = stubRepository()
    await acceptDocket({ repository, ...full })
    expect(repository.acceptDocket).toHaveBeenCalledWith(
      expect.objectContaining({
        docketId: 'd-1',
        lines: [{ skuId: 'kf', containers: 48 }],
        differenceReason: undefined,
      }),
    )
  })

  it('refuses a short acceptance with no reason, before any IO', async () => {
    // Specification section 5: a shortfall with nobody's name and no reason
    // against it is exactly what the paper docket book existed to prevent.
    const repository = stubRepository()
    await expect(
      acceptDocket({
        repository,
        ...full,
        lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 44 }],
      }),
    ).rejects.toThrow(/why the delivery is short/)
    expect(repository.acceptDocket).not.toHaveBeenCalled()
  })

  it('allows a short acceptance once a reason is given', async () => {
    const repository = stubRepository()
    await acceptDocket({
      repository,
      ...full,
      lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 44 }],
      differenceReason: 'Breakage in transit',
    })
    expect(repository.acceptDocket).toHaveBeenCalledWith(
      expect.objectContaining({ differenceReason: 'Breakage in transit' }),
    )
  })

  it('treats a whitespace-only reason as no reason', async () => {
    const repository = stubRepository()
    await expect(
      acceptDocket({
        repository,
        ...full,
        lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 44 }],
        differenceReason: '   ',
      }),
    ).rejects.toThrow(/why the delivery is short/)
  })

  it('refuses over-acceptance, which no reason excuses', async () => {
    const repository = stubRepository()
    await expect(
      acceptDocket({
        repository,
        ...full,
        lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 60 }],
        differenceReason: 'Short on pallet',
      }),
    ).rejects.toThrow(/more than the docket issued/)
    expect(repository.acceptDocket).not.toHaveBeenCalled()
  })

  it('allows accepting nothing, with a reason — the load never arrived', async () => {
    const repository = stubRepository()
    await acceptDocket({
      repository,
      ...full,
      lines: [{ skuId: 'kf', issuedContainers: 48, acceptedContainers: 0 }],
      differenceReason: 'Never arrived',
    })
    expect(repository.acceptDocket).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ skuId: 'kf', containers: 0 }] }),
    )
  })
})

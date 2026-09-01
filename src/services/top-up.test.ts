import { describe, expect, it, vi } from 'vitest'
import type { Repository, RequestTopUpCommand, UpdateTopUpCommand } from '../data/repository'
import { cancelTopUp, requestTopUp } from './top-up'

const ACTION = '3f1c9a52-8d4e-4b21-9f77-1c2b6d5a0e33'
const REQUEST = '4f1c9a52-8d4e-4b21-9f77-1c2b6d5a0e44'

function stubRepository() {
  const requestTopUpFn = vi.fn(async (command: RequestTopUpCommand) => ({
    status: 'posted' as const,
    requestId: REQUEST,
    received: command,
  }))
  const updateTopUpFn = vi.fn(async (command: UpdateTopUpCommand) => ({
    status: 'posted' as const,
    requestId: command.requestId,
  }))
  return {
    requestTopUp: requestTopUpFn,
    updateTopUp: updateTopUpFn,
  } as unknown as Repository & {
    requestTopUp: typeof requestTopUpFn
    updateTopUp: typeof updateTopUpFn
  }
}

describe('requestTopUp', () => {
  const valid = {
    actionId: ACTION,
    locationId: 'bar-3',
    skuId: 'kf',
    requestedContainers: 24,
    urgency: 'urgent' as const,
    note: '  Main bar is nearly dry  ',
  }

  it('passes one stable action id and every requested field to the repository', async () => {
    const repository = stubRepository()
    await requestTopUp({ repository, ...valid })
    expect(repository.requestTopUp).toHaveBeenCalledWith({
      idempotencyKey: ACTION,
      locationId: 'bar-3',
      skuId: 'kf',
      requestedContainers: 24,
      urgency: 'urgent',
      note: 'Main bar is nearly dry',
    })
  })

  it('rejects fractional or zero quantities before IO', async () => {
    const repository = stubRepository()
    await expect(requestTopUp({ repository, ...valid, requestedContainers: 1.5 })).rejects.toThrow(/whole/)
    await expect(requestTopUp({ repository, ...valid, requestedContainers: 0 })).rejects.toThrow(/at least one/)
    expect(repository.requestTopUp).not.toHaveBeenCalled()
  })
})

describe('cancelTopUp', () => {
  it('uses the caller-owned action id for durable outbox deduplication', async () => {
    const repository = stubRepository()
    await cancelTopUp({ repository, actionId: ACTION, requestId: REQUEST })
    expect(repository.updateTopUp).toHaveBeenCalledWith({
      idempotencyKey: ACTION,
      requestId: REQUEST,
      status: 'cancelled',
    })
  })
})

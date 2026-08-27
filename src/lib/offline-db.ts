import Dexie, { type EntityTable } from 'dexie'
import { submitMovement } from './supabase'

export type QueuedMovement = {
  id: string
  idempotencyKey: string
  payload: unknown
  status: 'pending' | 'syncing' | 'failed'
  attempts: number
  nextAttemptAt: number
  createdAt: number
  lastError?: string
}

type CachedReference = {
  key: string
  value: unknown
  refreshedAt: number
}

class BoaOfflineDatabase extends Dexie {
  movementQueue!: EntityTable<QueuedMovement, 'id'>
  referenceCache!: EntityTable<CachedReference, 'key'>

  constructor() {
    super('boa-bar-control')
    this.version(1).stores({
      movementQueue: 'id, idempotencyKey, status, nextAttemptAt, createdAt',
      referenceCache: 'key, refreshedAt',
    })
  }
}

export const offlineDb = new BoaOfflineDatabase()

export async function enqueueMovement(input: { idempotencyKey: string; payload: unknown }) {
  const existing = await offlineDb.movementQueue.where('idempotencyKey').equals(input.idempotencyKey).first()
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await offlineDb.movementQueue.add({
    id,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  })
  window.dispatchEvent(new CustomEvent('boa:queue-change'))
  return id
}

export async function getQueueSummary() {
  const [pending, failed, syncing] = await Promise.all([
    offlineDb.movementQueue.where('status').equals('pending').count(),
    offlineDb.movementQueue.where('status').equals('failed').count(),
    offlineDb.movementQueue.where('status').equals('syncing').count(),
  ])
  return { pending: pending + syncing, failed }
}

async function flushMovementQueue() {
  if (!navigator.onLine) return
  const now = Date.now()
  const rows = await offlineDb.movementQueue
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .sortBy('createdAt')

  for (const row of rows.filter((candidate) => candidate.status !== 'syncing')) {
    await offlineDb.movementQueue.update(row.id, { status: 'syncing' })
    try {
      await submitMovement(row.payload)
      await offlineDb.movementQueue.delete(row.id)
    } catch (error) {
      const attempts = row.attempts + 1
      const baseDelay = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6))
      await offlineDb.movementQueue.update(row.id, {
        status: attempts >= 8 ? 'failed' : 'pending',
        attempts,
        nextAttemptAt: Date.now() + Math.round(baseDelay * (0.75 + Math.random() * 0.5)),
        lastError: error instanceof Error ? error.message : 'Unknown sync failure',
      })
      if (error instanceof Error && /auth|jwt|permission/i.test(error.message)) break
    }
  }
  window.dispatchEvent(new CustomEvent('boa:queue-change'))
}

function withSyncLock() {
  if ('locks' in navigator) {
    return navigator.locks.request('boa-movement-sync', { ifAvailable: true }, async (lock) => {
      if (lock) await flushMovementQueue()
    })
  }
  return flushMovementQueue()
}

export function startMovementSync() {
  const sync = () => void withSyncLock()
  void offlineDb.movementQueue.where('status').equals('syncing').modify({ status: 'pending', nextAttemptAt: Date.now() })
  window.addEventListener('online', sync)
  window.addEventListener('boa:queue-change', sync)
  window.addEventListener('boa:auth-ready', sync)
  window.setInterval(sync, 15_000)
  sync()
}

/**
 * BAR-044 / BAR-069 / BAR-070 / BAR-074 — the outbox.
 *
 * Every write goes through here, online or offline. `docs/OFFLINE-SYNC.md` rule 5:
 * there is no direct-to-network path for writes. That is what makes the offline
 * case ordinary rather than exceptional, and it is why a service never calls an
 * RPC itself.
 *
 * What changed in BAR-044, and why:
 *
 *   - The queue held one command shape (a movement payload) and posted it to one
 *     RPC. The custody chain needs `boa_bar_create_docket` and
 *     `boa_bar_accept_docket`, so entries are now typed commands dispatched by
 *     kind. Dexie is versioned to 2 and existing rows migrate to
 *     `kind: 'movement'`, per the doc's instruction not to change outbox schemas
 *     mid-event without a migration.
 *   - The drain selected every entry whose backoff had elapsed and posted those.
 *     An entry in backoff was therefore SKIPPED while the entries behind it went
 *     ahead — so an issue that failed once could be overtaken by its own
 *     acceptance, producing an acceptance of a docket the ledger did not contain.
 *     Ordering is now decided by `selectDrainBatch`, which stops at the first
 *     blocked entry, and is asserted in `outbox-policy.test.ts`.
 *   - An auth failure incremented `attempts` before breaking out. Eight entries
 *     and an expired JWT meant the shift's work went `failed` within two minutes.
 *     Auth failures now stop the drain without consuming an attempt.
 *   - Completed entries were deleted. They are now retained with the server's
 *     reply, because a docket number is minted server-side and exists nowhere
 *     else, and because a local record that a write landed is the only evidence
 *     available on the device.
 */
import Dexie, { type EntityTable } from 'dexie'
import {
  classifyFailure,
  isTerminal,
  nextAttemptDelayMs,
  selectDrainBatch,
  type OutboxEntryState,
} from '../domain/outbox-policy'
import { acceptDocketRpc, createDocketRpc, recordWasteRpc, submitCountRpc, submitMovement } from './supabase'

export type CommandKind = 'movement' | 'create_docket' | 'accept_docket' | 'submit_count' | 'record_waste'

export type QueuedCommand = {
  id: string
  kind: CommandKind
  /**
   * Minted ONCE per user action by the service, not per network call, and reused
   * on every retry. A key regenerated per call protects against nothing: a double
   * tap creates two ledger movements and the dedupe below becomes dead code
   * (BAR-069).
   */
  idempotencyKey: string
  payload: unknown
  status: 'pending' | 'syncing' | 'done' | 'failed'
  attempts: number
  nextAttemptAt: number
  createdAt: number
  /** The server's reply, once posted. Holds the minted docket number. */
  result?: unknown
  lastError?: string
  /** Set when the failure is one no retry will fix (BAR-135 dead letter). */
  permanent?: boolean
}

type CachedReference = {
  key: string
  value: unknown
  refreshedAt: number
}

class BoaOfflineDatabase extends Dexie {
  outbox!: EntityTable<QueuedCommand, 'id'>
  referenceCache!: EntityTable<CachedReference, 'key'>

  constructor() {
    super('boa-bar-control')
    this.version(1).stores({
      movementQueue: 'id, idempotencyKey, status, nextAttemptAt, createdAt',
      referenceCache: 'key, refreshedAt',
    })
    // v2 — the queue becomes a typed command outbox. Renaming the table would
    // discard anything already queued on a device, so the store is renamed by
    // Dexie's own rename support and every existing row is a movement.
    this.version(2)
      .stores({
        movementQueue: null,
        outbox: 'id, kind, idempotencyKey, status, nextAttemptAt, createdAt',
        referenceCache: 'key, refreshedAt',
      })
      .upgrade(async (tx) => {
        const legacy = await tx.table('movementQueue').toArray().catch(() => [])
        if (legacy.length === 0) return
        await tx.table('outbox').bulkAdd(
          legacy.map((row: Record<string, unknown>) => ({ ...row, kind: 'movement' as CommandKind })),
        )
      })
  }
}

export const offlineDb = new BoaOfflineDatabase()

/** Where each command kind is posted. The only place these RPCs are called. */
const DISPATCH: Record<CommandKind, (payload: unknown) => Promise<unknown>> = {
  movement: submitMovement,
  create_docket: createDocketRpc,
  accept_docket: acceptDocketRpc,
  submit_count: submitCountRpc,
  record_waste: recordWasteRpc,
}

function announce() {
  window.dispatchEvent(new CustomEvent('boa:queue-change'))
}

/**
 * Append a command, durably, and return its outbox id.
 *
 * Resolves only once Dexie has committed. A caller that reported success before
 * this resolved would be claiming a write was recorded when it was not
 * (`docs/OFFLINE-SYNC.md` rule 3).
 */
export async function enqueueCommand(input: {
  kind: CommandKind
  idempotencyKey: string
  payload: unknown
}): Promise<string> {
  const existing = await offlineDb.outbox.where('idempotencyKey').equals(input.idempotencyKey).first()
  // The double-tap case. Same action, same key, one entry.
  if (existing) return existing.id

  const id = crypto.randomUUID()
  await offlineDb.outbox.add({
    id,
    kind: input.kind,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  })
  announce()
  return id
}

/** Retained for the legacy live path until BAR-164 deletes it. */
export async function enqueueMovement(input: { idempotencyKey: string; payload: unknown }) {
  return enqueueCommand({ kind: 'movement', ...input })
}

export async function getCommand(id: string): Promise<QueuedCommand | undefined> {
  return offlineDb.outbox.get(id)
}

/**
 * Wait for one queued command to post, and return the server's reply.
 *
 * This is what lets an online action still show a server-minted docket number
 * while every write goes through the outbox. Offline — or if the drain is slow —
 * it times out, and the caller reports the write as queued rather than claiming it
 * was posted. It never reports success for an entry that has not landed.
 */
export async function waitForCommand(id: string, timeoutMs = 8_000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const row = await offlineDb.outbox.get(id)
    if (!row) throw new Error('The queued write disappeared from the outbox')
    if (row.status === 'done') return row.result
    if (row.status === 'failed' || row.permanent) {
      throw new Error(row.lastError ?? 'The write was rejected and will not be retried')
    }
    if (Date.now() >= deadline) throw new OutboxPendingError(id)
    await new Promise((resolve) => window.setTimeout(resolve, 150))
  }
}

/**
 * Not a failure. The write is durable in the outbox and will post; this only says
 * it has not posted yet, which is the normal state offline. Callers distinguish it
 * from a rejection so they never tell a user their work was lost when it was not.
 */
export class OutboxPendingError extends Error {
  readonly outboxId: string
  constructor(outboxId: string) {
    super('The write is queued and has not posted yet')
    this.name = 'OutboxPendingError'
    this.outboxId = outboxId
  }
}

export async function getQueueSummary() {
  const [pending, syncing, failed] = await Promise.all([
    offlineDb.outbox.where('status').equals('pending').count(),
    offlineDb.outbox.where('status').equals('syncing').count(),
    offlineDb.outbox.where('status').equals('failed').count(),
  ])
  return { pending: pending + syncing, failed }
}

async function flushOutbox() {
  if (!navigator.onLine) return

  const all = await offlineDb.outbox.toArray()
  const batch = selectDrainBatch(all as OutboxEntryState[], Date.now())

  for (const candidate of batch) {
    const row = await offlineDb.outbox.get(candidate.id)
    if (!row) continue

    await offlineDb.outbox.update(row.id, { status: 'syncing' })
    try {
      const result = await DISPATCH[row.kind](row.payload)
      await offlineDb.outbox.update(row.id, { status: 'done', result, lastError: undefined })
    } catch (error) {
      const kind = classifyFailure(error as { message?: unknown; code?: unknown })
      const message = error instanceof Error ? error.message : 'Unknown sync failure'

      if (kind === 'duplicate') {
        // The server already holds it. Marking this failed would be a lie about a
        // write that landed.
        await offlineDb.outbox.update(row.id, { status: 'done', lastError: undefined })
        continue
      }

      if (kind === 'auth') {
        // Stop without consuming an attempt, and leave the queue intact.
        await offlineDb.outbox.update(row.id, { status: 'pending', lastError: message })
        announce()
        return
      }

      if (kind === 'invalid') {
        // No retry will fix this payload. Terminal, retained, and visible.
        await offlineDb.outbox.update(row.id, {
          status: 'failed',
          permanent: true,
          lastError: message,
        })
        announce()
        return
      }

      const attempts = row.attempts + 1
      const jitter = 0.75 + Math.random() * 0.5
      await offlineDb.outbox.update(row.id, {
        status: isTerminal(attempts) ? 'failed' : 'pending',
        attempts,
        nextAttemptAt: Date.now() + nextAttemptDelayMs(attempts, jitter),
        lastError: message,
      })
      // Ordered replay: stop rather than step over the entry that just failed.
      announce()
      return
    }
  }
  announce()
}

function withSyncLock() {
  if ('locks' in navigator) {
    return navigator.locks.request('boa-outbox-sync', { ifAvailable: true }, async (lock) => {
      if (lock) await flushOutbox()
    })
  }
  return flushOutbox()
}

export function startMovementSync() {
  const sync = () => void withSyncLock()
  // A tab killed mid-post leaves an entry marked `syncing` forever, which under
  // the ordering rule would block the whole queue. Reset those on startup.
  void offlineDb.outbox
    .where('status')
    .equals('syncing')
    .modify({ status: 'pending', nextAttemptAt: Date.now() })
  window.addEventListener('online', sync)
  window.addEventListener('boa:queue-change', sync)
  window.addEventListener('boa:auth-ready', sync)
  window.setInterval(sync, 15_000)
  sync()
}

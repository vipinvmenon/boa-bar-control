// @vitest-environment jsdom
/**
 * BAR-179 — the outbox's undo window, against a real IndexedDB.
 *
 * BAR-168 gave a queued write an Undo, and justified it like this: while a
 * command is `pending` it exists only on this device, so deleting it leaves
 * nothing anywhere and nothing to compensate for. The moment the drain claims it
 * (`syncing`) or the server accepts it (`done`), the movement is real and the
 * only correction is a compensating one.
 *
 * That argument is only as good as `cancelQueuedCommand`'s guard, and it shipped
 * with no test — the suite had no IndexedDB, so the one function whose failure
 * mode is "silently deletes a write the server already has" was the one function
 * covered by nothing. `fake-indexeddb` costs two test-only dependencies and
 * closes that.
 *
 * These tests drive the real Dexie store, not a fake of it. A fake of the store
 * this function guards would assert the guard against my own assumptions about
 * Dexie's transaction semantics, which is exactly the class of verification
 * `CLAUDE.md` says not to write.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { cancelQueuedCommand, enqueueCommand, getCommand, getQueueSummary, offlineDb } from './offline-db'

const queue = (idempotencyKey: string) =>
  enqueueCommand({ kind: 'record_waste', idempotencyKey, payload: { containers: 1 } })

beforeEach(async () => {
  await offlineDb.outbox.clear()
})

describe('enqueueCommand', () => {
  it('is idempotent on the key, so a double tap is one entry', async () => {
    const first = await queue('11111111-1111-1111-1111-111111111111')
    const second = await queue('11111111-1111-1111-1111-111111111111')

    expect(second).toBe(first)
    expect(await offlineDb.outbox.count()).toBe(1)
  })

  it('durably stores the command as pending before it resolves', async () => {
    const id = await queue('22222222-2222-2222-2222-222222222222')
    const row = await getCommand(id)

    // Resolving before the row is committed would let a screen report a write
    // as saved when it was not (docs/OFFLINE-SYNC.md rule 3).
    expect(row?.status).toBe('pending')
    expect(row?.attempts).toBe(0)
  })
})

describe('cancelQueuedCommand — the undo window', () => {
  it('removes a pending command and reports that it did', async () => {
    const id = await queue('33333333-3333-3333-3333-333333333333')

    expect(await cancelQueuedCommand(id)).toBe(true)
    expect(await getCommand(id)).toBeUndefined()
  })

  /**
   * The race this function exists to lose safely. The drain marks a row
   * `syncing` before dispatching it, so by this point the RPC may already be in
   * flight — deleting the row would take the undo the user asked for while
   * leaving the movement on the ledger, and nothing would ever reconcile the two.
   */
  it('refuses a command the drain has already claimed, and leaves it alone', async () => {
    const id = await queue('44444444-4444-4444-4444-444444444444')
    await offlineDb.outbox.update(id, { status: 'syncing' })

    expect(await cancelQueuedCommand(id)).toBe(false)
    expect((await getCommand(id))?.status).toBe('syncing')
  })

  it('refuses a command the server has accepted', async () => {
    const id = await queue('55555555-5555-5555-5555-555555555555')
    await offlineDb.outbox.update(id, { status: 'done' })

    expect(await cancelQueuedCommand(id)).toBe(false)
    expect((await getCommand(id))?.status).toBe('done')
  })

  /**
   * A failed row is a retained dead letter with an audit trail and an explicit
   * human resolution path (`resolveFailedCommand`, BAR-135). Undo must not be a
   * second, quieter way to make one disappear.
   */
  it('refuses a failed command rather than discarding its audit record', async () => {
    const id = await queue('66666666-6666-6666-6666-666666666666')
    await offlineDb.outbox.update(id, { status: 'failed', lastError: 'permission denied' })

    expect(await cancelQueuedCommand(id)).toBe(false)
    expect((await getCommand(id))?.status).toBe('failed')
  })

  it('reports false for a command that is not there at all', async () => {
    expect(await cancelQueuedCommand('77777777-7777-7777-7777-777777777777')).toBe(false)
  })

  it('takes the cancelled write out of the pending count the shell reports', async () => {
    const id = await queue('88888888-8888-8888-8888-888888888888')
    await queue('99999999-9999-9999-9999-999999999999')
    expect((await getQueueSummary()).pending).toBe(2)

    await cancelQueuedCommand(id)

    // BAR-167's status strip reads this figure. An undo that removed the row but
    // left the count would say a write was waiting that no longer exists.
    expect((await getQueueSummary()).pending).toBe(1)
  })
})

describe('getQueueSummary', () => {
  it('counts a claimed command as still pending, because it has not landed', async () => {
    const id = await queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    await offlineDb.outbox.update(id, { status: 'syncing' })

    const summary = await getQueueSummary()
    expect(summary.pending).toBe(1)
    expect(summary.failed).toBe(0)
  })

  it('surfaces the newest failure, which is what More offers to resolve', async () => {
    const older = await queue('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    const newer = await queue('cccccccc-cccc-cccc-cccc-cccccccccccc')
    await offlineDb.outbox.update(older, { status: 'failed', lastError: 'older', createdAt: 1 })
    await offlineDb.outbox.update(newer, { status: 'failed', lastError: 'newer', createdAt: 2 })

    const summary = await getQueueSummary()
    expect(summary.failed).toBe(2)
    expect(summary.lastFailure).toBe('newer')
  })
})

/**
 * BAR-138 — make a service-worker update actually applicable.
 *
 * The bug this fixes: main.tsx dispatched a `boa:pwa-update` event that nothing
 * listened for, and sw.ts waited for a `SKIP_WAITING` message that nothing ever
 * sent. The consequence is worse than a missing feature — once a service worker
 * installs, a new one can NEVER activate, so a device is pinned to whatever
 * bundle it first cached. Deploy a fix on show day and the phones keep running
 * the old build, with no way to tell from the outside.
 *
 * `registerType` is 'prompt', so an update waits for a deliberate act rather
 * than reloading under someone mid-count.
 */
type UpdateFn = (reload?: boolean) => Promise<void>

let pending: UpdateFn | null = null
const listeners = new Set<(available: boolean) => void>()

/** Called by main.tsx when the service worker reports a waiting update. */
export function setPendingUpdate(update: UpdateFn) {
  pending = update
  listeners.forEach((l) => l(true))
}

export function onUpdateAvailability(listener: (available: boolean) => void): () => void {
  listeners.add(listener)
  listener(pending !== null)
  return () => listeners.delete(listener)
}

/** Activate the waiting worker and reload. This is what was missing. */
export async function applyUpdate() {
  if (!pending) return
  const update = pending
  pending = null
  listeners.forEach((l) => l(false))
  await update(true)
}

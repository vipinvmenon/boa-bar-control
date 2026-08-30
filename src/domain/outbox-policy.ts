/**
 * BAR-044 / BAR-070 / BAR-074 — the outbox's scheduling decisions, as pure
 * functions.
 *
 * These are separated from the Dexie IO for two reasons. They are the part with
 * rules in it, and rules on this project need tests; and there is no jsdom
 * environment configured yet (BAR-114), so anything touching Dexie cannot be
 * tested at all. Keeping the decisions here means the ordering guarantee is
 * asserted rather than hoped for.
 *
 * The guarantee that matters is ordering. `docs/OFFLINE-SYNC.md` rule 2: replay is
 * strictly ordered, and a failed entry blocks the entries behind it. Without it an
 * acceptance can post before its issue, and the ledger's causal history is wrong —
 * which for a two-party custody record is the whole point of the record.
 */

export type OutboxEntryState = {
  id: string
  status: 'pending' | 'syncing' | 'done' | 'failed'
  attempts: number
  /** Epoch ms. An entry is not eligible before this. */
  nextAttemptAt: number
  /** Epoch ms. The ordering key — creation order is causal order. */
  createdAt: number
}

/** How a drain failure should be treated. */
export type FailureKind = 'auth' | 'duplicate' | 'invalid' | 'transient'

/** The shape both a thrown Error and a PostgrestError satisfy. */
export type FailureLike = { message?: unknown; code?: unknown } | string | null | undefined

/** Preserve the server's explanation even when PostgREST throws a plain object. */
export function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    if (message) return message
  }
  return 'Unknown sync failure'
}

function partsOf(error: FailureLike): { message: string; code: string } {
  if (!error) return { message: '', code: '' }
  return {
    message: failureMessage(error).toLowerCase(),
    code: typeof error === 'object' ? String((error as { code?: unknown }).code ?? '') : '',
  }
}

/**
 * Classify a drain failure. The four kinds get genuinely different treatment, and
 * getting one wrong is worse than not classifying at all.
 *
 * `duplicate` is SUCCESS. The server already holds the write; this is the normal
 * outcome of a reply lost on the way back, which on a festival network is common.
 * Retrying forever against a server that has already accepted it is the wrong
 * response, and so is marking it failed.
 *
 * `auth` stops the drain without consuming an attempt. A shared phone whose JWT
 * expired mid-shift would otherwise burn all eight attempts on every queued entry
 * in under two minutes and mark the shift's work `failed` — losing it as surely as
 * deleting it.
 *
 * `invalid` is permanent: the payload breaks a rule the server will never accept,
 * so retrying is pointless. It goes terminal immediately and waits for a human
 * (BAR-135).
 *
 * `transient` retries with backoff.
 *
 * The message patterns are taken from the actual `raise exception` strings in
 * supabase/migrations/, not from guesses about what PostgreSQL might say. An
 * earlier version of this function was written from guesses and matched neither
 * 'not authorised for venue' nor 'docket % is already %'.
 */
export function classifyFailure(error: FailureLike): FailureKind {
  const { message, code } = partsOf(error)

  // ---- duplicate: the server already has it -------------------------------
  // 23505 unique_violation, and boa_bar_accept_docket's 'docket % is already %'.
  if (code === '23505' || /duplicate key|\bis already\b/.test(message)) return 'duplicate'

  // ---- permanent custody rule, despite its authorisation SQLSTATE ---------
  // Self-acceptance is rejected with 42501 because it is an authorisation
  // boundary, but re-authenticating cannot make this action valid: the issuer is
  // permanently the issuer for this docket. Classify the exact RPC message
  // before the general 42501 auth stop or this entry stays pending forever and
  // blocks every later movement on the device (BAR-135 / BAR-147).
  if (/docket cannot be accepted by the person who issued it/.test(message)) return 'invalid'

  // ---- auth: stop the drain -----------------------------------------------
  // 28000 invalid_authorization_specification, 42501 insufficient_privilege.
  if (code === '28000' || code === '42501') return 'auth'
  if (
    /not authorised|not authorized|authentication required|permission denied|jwt|unauthor|\b401\b|\b403\b/.test(
      message,
    ) ||
    // These carry 42501 in the database but arrive as prose through PostgREST.
    /^only (a manager|warehouse)/.test(message)
  ) {
    return 'auth'
  }

  // ---- transient, despite looking permanent -------------------------------
  // 'docket not found' is NOT invalid. Two-party custody means the issue and the
  // acceptance happen on DIFFERENT devices, so the accepting device can legitimately
  // reach the server before the issuing device has drained its own queue. Treating
  // this as permanent would dead-letter every acceptance that arrived first.
  if (/docket not found|token has expired/.test(message)) return 'transient'

  // ---- invalid: the server will never accept this payload ------------------
  // 22023 invalid_parameter_value, 23514 check_violation, 22001 string_too_long.
  if (code === '22023' || code === '23514' || code === '22001') return 'invalid'
  if (
    /requires lines|needs at least one line|needs distinct|must be positive|cannot be negative|cannot accept more than issued|requires difference_reason|is not on docket|must name its actor|must add stock|must remove stock|must balance across locations|idempotency_key is required/.test(
      message,
    )
  ) {
    return 'invalid'
  }

  return 'transient'
}

/**
 * Exponential backoff, capped at a minute. Uncapped backoff on a network that
 * returns after ten minutes leaves the queue asleep for hours.
 *
 * Jitter is a multiplier supplied by the caller rather than read from
 * `Math.random()` here, so this function stays pure and testable.
 */
export function nextAttemptDelayMs(attempts: number, jitter = 1): number {
  const base = Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(attempts, 0), 6))
  return Math.round(base * jitter)
}

export const MAX_ATTEMPTS = 8

/**
 * Terminal means "stop retrying and show somebody", not "discard". A terminal
 * entry is still in the outbox and still visible; BAR-135 is the dead-letter view
 * that surfaces it.
 */
export function isTerminal(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS
}

/**
 * The entries to attempt now, in causal order, stopping at the first entry that
 * is not eligible.
 *
 * This is the ordering guarantee. The previous implementation selected every
 * entry whose `nextAttemptAt` had passed and drained those — so an entry in
 * backoff was skipped while the entries behind it went ahead of it. An issue that
 * failed once could therefore be overtaken by its own acceptance, producing an
 * acceptance of a docket the ledger did not yet contain.
 */
export function selectDrainBatch(entries: OutboxEntryState[], now: number): OutboxEntryState[] {
  const ordered = [...entries].sort((a, b) =>
    a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

  const batch: OutboxEntryState[] = []
  for (const entry of ordered) {
    // Already posted. Completed entries are retained rather than deleted — they
    // carry the server's reply (a docket number is minted server-side, so it
    // exists nowhere else) and they are the local evidence that a write landed.
    // They are skipped, not treated as blocking.
    if (entry.status === 'done') continue
    // A terminal entry blocks everything behind it, permanently, until a human
    // deals with it. That is deliberate: silently stepping over a write that
    // could not be posted is how a ledger acquires a gap nobody notices.
    if (entry.status === 'failed' || isTerminal(entry.attempts)) break
    // Already in flight elsewhere (another tab holding the lock).
    if (entry.status === 'syncing') break
    // In backoff. Everything behind it waits, or ordering is not a guarantee.
    if (entry.nextAttemptAt > now) break
    batch.push(entry)
  }
  return batch
}

/**
 * BAR-044 — issuing stock.
 *
 * A use case: validate, apply the domain rules, call the repository. It is the
 * only place those three compose, which is what `docs/ARCHITECTURE.md` means by
 * "services are the only place rules and IO compose".
 *
 * A screen calls this. A screen does not call the repository directly and never
 * touches Supabase or Dexie.
 */
import { z } from 'zod'
import type { Repository, WriteOutcome } from '../data/repository'

const lineSchema = z.object({
  skuId: z.string().min(1, 'a line needs an SKU'),
  containers: z
    .number()
    .int('containers must be whole — a docket cannot issue half a bottle')
    .positive('a line must issue at least one container'),
})

const issueSchema = z.object({
  /**
   * Identifies the user's ACTION, not the attempt. Created once when the flow
   * starts and reused for every retry, so a double tap produces one docket rather
   * than two (BAR-069). The service does not mint it, because a service call is
   * one attempt.
   */
  actionId: z.string().uuid('the action id must be a UUID'),
  topUpRequestId: z.string().uuid('the top-up request id must be a UUID').optional(),
  fromLocationId: z.string().min(1, 'stock must be issued from somewhere'),
  toLocationId: z.string().min(1, 'stock must be issued to somewhere'),
  lines: z.array(lineSchema).min(1, 'a docket needs at least one line'),
})

export type IssueStockInput = z.infer<typeof issueSchema> & { repository: Repository }

/**
 * Issue stock on a docket.
 *
 * Zod runs first so a malformed action is rejected here with a sentence somebody
 * can act on, rather than as a PostgreSQL error code after a network round trip
 * (BAR-048). The database enforces the same rules regardless — this is an
 * affordance, not a control.
 */
export async function issueStock({ repository, ...input }: IssueStockInput): Promise<WriteOutcome> {
  const parsed = issueSchema.parse(input)

  if (parsed.fromLocationId === parsed.toLocationId) {
    // The database has the same CHECK. Caught here so the button can explain it.
    throw new Error('A docket cannot issue stock to the location it came from')
  }

  const seen = new Set<string>()
  for (const line of parsed.lines) {
    if (seen.has(line.skuId)) {
      // boa_bar_docket_line is unique on (docket_id, sku_id), so two lines for one
      // SKU is a unique violation on the server and a confusing docket on paper.
      throw new Error('The same product appears twice on this docket')
    }
    seen.add(line.skuId)
  }

  return repository.createDocket({
    idempotencyKey: parsed.actionId,
    fromLocationId: parsed.fromLocationId,
    toLocationId: parsed.toLocationId,
    topUpRequestId: parsed.topUpRequestId,
    lines: parsed.lines,
  })
}

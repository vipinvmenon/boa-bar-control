/**
 * BAR-044 / BAR-058 — taking custody.
 *
 * The second half of the two-party docket, and the point of the whole mechanism:
 * a discrepancy is attributed at the moment it is discovered, by the person who
 * discovered it.
 */
import { z } from 'zod'
import { acceptanceProblem, type CustodyLine } from '../domain/custody'
import type { Repository, WriteOutcome } from '../data/repository'

const acceptSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  docketId: z.string().min(1, 'an acceptance needs a docket'),
  lines: z
    .array(
      z.object({
        skuId: z.string().min(1),
        issuedContainers: z.number().int().nonnegative(),
        acceptedContainers: z
          .number()
          .int('a count must be whole')
          .nonnegative('a received quantity cannot be negative'),
      }),
    )
    .min(1, 'an acceptance needs at least one line'),
  differenceReason: z.string().trim().optional(),
})

export type AcceptDocketInput = z.infer<typeof acceptSchema> & { repository: Repository }

/** The message for each objection, in the receiver's language rather than SQL's. */
function explain(problem: NonNullable<ReturnType<typeof acceptanceProblem>>): string {
  switch (problem.kind) {
    case 'no-lines':
      return 'This acceptance has no lines'
    case 'negative':
      return 'A received quantity cannot be negative'
    case 'over-accepted':
      return 'You cannot accept more than the docket issued. If there is extra stock, it belongs to a different docket'
    case 'reason-missing':
      return 'Say why the delivery is short before accepting it'
  }
}

/**
 * Accept a docket, in full or short.
 *
 * The short-acceptance rule is enforced here AND in `boa_bar_accept_docket`, from
 * the same domain function, so the button and the database cannot disagree. If
 * they did, the user would meet a raw PostgreSQL error after committing to a
 * decision — or worse, be allowed through where the database is the only thing
 * saying no.
 */
export async function acceptDocket({ repository, ...input }: AcceptDocketInput): Promise<WriteOutcome> {
  const parsed = acceptSchema.parse(input)

  const lines: CustodyLine[] = parsed.lines.map((line) => ({
    skuId: line.skuId,
    issuedContainers: line.issuedContainers,
    acceptedContainers: line.acceptedContainers,
  }))

  const problem = acceptanceProblem(lines, parsed.differenceReason)
  if (problem) throw new Error(explain(problem))

  return repository.acceptDocket({
    idempotencyKey: parsed.actionId,
    docketId: parsed.docketId,
    lines: parsed.lines.map((line) => ({ skuId: line.skuId, containers: line.acceptedContainers })),
    differenceReason: parsed.differenceReason || undefined,
  })
}

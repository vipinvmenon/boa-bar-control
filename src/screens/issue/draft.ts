import { z } from 'zod'

const issueDraftSearchSchema = z.object({
  actionId: z.string().uuid().optional(),
  topUpRequestId: z.string().uuid().optional(),
  fromLocationId: z.string().min(1).optional(),
  toLocationId: z.string().min(1).optional(),
  skuId: z.string().min(1).optional(),
  containers: z.coerce.number().int().positive().optional(),
  unit: z.enum(['case', 'container']).optional(),
})

export type IssueDraftSearch = z.infer<typeof issueDraftSearchSchema>

/** URL search is a trust boundary. Invalid drafts degrade to the repository defaults. */
export function parseIssueDraftSearch(search: Record<string, unknown>): IssueDraftSearch {
  const parsed = issueDraftSearchSchema.safeParse(search)
  return parsed.success ? parsed.data : {}
}

/**
 * BAR-177 / ADR-016 — the staged docket.
 *
 * Several products going to one place, held on the device rather than in the
 * URL. The URL still carries a SINGLE line, and deliberately: that is how a home
 * alert seeds an issue (BAR-173), how the fidelity gate reaches the review
 * screen, and how a shared link continues to work. The basket is what a person
 * builds up over a minute at the warehouse door, which is the receipt screen's
 * problem too, and it is solved the same way — `useDraft`, so a dropped tab does
 * not lose it.
 *
 * `toLocationId` is part of the basket because a docket goes to exactly one
 * place. Storing it here is what lets the review screen refuse a basket that was
 * built for somewhere else rather than silently issuing to the wrong bar.
 */
export type StagedLine = { skuId: string; containers: number }
export type IssueBasket = {
  actionId: string
  toLocationId: string | null
  lines: StagedLine[]
}

const issueBasketSchema = z.object({
  actionId: z.string().uuid(),
  toLocationId: z.string().min(1).nullable(),
  lines: z.array(z.object({
    skuId: z.string().min(1),
    containers: z.number().int().positive(),
  })),
})

/**
 * Validated, not cast. A basket written by an older build must not reach a
 * create — the same rule the count draft follows, for the same reason: feeding a
 * mis-shaped draft into a ledger write is worse than losing it.
 */
export function isIssueBasket(raw: unknown): raw is IssueBasket {
  return issueBasketSchema.safeParse(raw).success
}

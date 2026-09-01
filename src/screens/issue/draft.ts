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

/**
 * BAR-063 / BAR-133 — recording waste.
 *
 * Waste is a ledger movement, not an edit — the design's own advisory says so on
 * the screen: "Waste is a ledger movement, not an edit. It appears in variance as
 * accounted depletion." That is the whole reason it matters: waste that is
 * recorded is depletion the variance report can account for, and waste that is not
 * recorded is indistinguishable from theft.
 */
import { z } from 'zod'
import type { CountWriteOutcome, Repository } from '../data/repository'

/** design-script.jsx:308. The database enforces the same five. */
export const WASTE_REASONS = ['Breakage', 'Spillage', 'Foam / line loss', 'Refused pour', 'Other'] as const

const wasteSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  /**
   * BAR-133. Required, with no default. The previous implementation posted every
   * waste to whichever location was coded `bar_3`, so Bar 1's variance was
   * understated by exactly what Bar 3's was overstated.
   */
  locationId: z.string().min(1, 'waste must be recorded against a location'),
  skuId: z.string().min(1, 'choose a product'),
  containers: z
    .number()
    .int('waste is counted in whole containers')
    .positive('waste must be at least one container'),
  reason: z.enum(WASTE_REASONS, {
    message: 'Choose one of the five reasons. Free text cannot be grouped on the excise return',
  }),
})

/**
 * `reason` is accepted as a plain string and narrowed by Zod here, so a screen
 * never has to cast a value it read from the repository into a literal union.
 * The validation is the narrowing.
 */
export type RecordWasteInput = Omit<z.infer<typeof wasteSchema>, 'reason'> & {
  reason: string
  repository: Repository
}

export async function recordWaste({ repository, ...input }: RecordWasteInput): Promise<CountWriteOutcome> {
  const parsed = wasteSchema.parse(input)
  return repository.recordWaste({
    idempotencyKey: parsed.actionId,
    locationId: parsed.locationId,
    skuId: parsed.skuId,
    containers: parsed.containers,
    reason: parsed.reason,
  })
}

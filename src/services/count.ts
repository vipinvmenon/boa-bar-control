/**
 * BAR-082 — submitting a blind count.
 *
 * The rules here are about what a count IS, and two of them are the point of the
 * whole feature:
 *
 *   - A count covers the whole sheet. A partial count silently understates the
 *     lines nobody reached, and understated stock reads as shrinkage.
 *   - Nothing in this file, or in anything it returns, carries an expected
 *     quantity. The counter must not be able to learn the expected position by
 *     submitting (non-negotiable 3).
 */
import { z } from 'zod'
import { mlFromGrossWeight } from '../domain/inventory'
import type { CountWriteOutcome, Repository, SubmitCountCommand } from '../data/repository'

const lineSchema = z.object({
  skuId: z.string().min(1),
  fullContainers: z
    .number()
    .int('a container count must be whole — weigh the open one instead')
    .nonnegative('a counted quantity cannot be negative'),
  partialMl: z
    .number()
    .int()
    .nonnegative('a partial cannot be negative')
    .default(0),
  /** The scale reading, retained as evidence where a partial was weighed. */
  grossWeightG: z.number().nonnegative().optional(),
})

const countSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  locationId: z.string().min(1, 'a count needs a location'),
  countKind: z.enum(['opening_warehouse', 'opening_bar', 'mid_event', 'close_out']),
  lines: z.array(lineSchema).min(1, 'a count needs at least one line'),
  /** Total lines on the sheet, so a partial count can be refused. */
  expectedLineCount: z.number().int().positive(),
})

export type SubmitCountInput = z.infer<typeof countSchema> & { repository: Repository }

export async function submitCount({ repository, ...input }: SubmitCountInput): Promise<CountWriteOutcome> {
  const parsed = countSchema.parse(input)

  const seen = new Set<string>()
  for (const line of parsed.lines) {
    if (seen.has(line.skuId)) {
      // boa_bar_count_line is unique on (count_session_id, sku_id).
      throw new Error('The same product was counted twice')
    }
    seen.add(line.skuId)
  }

  /**
   * A count must be complete. Submitting 12 of 18 lines does not produce a count
   * with six gaps — it produces a count that reports six SKUs as zero, and zero
   * reads as "all of it is missing". That is the most damaging wrong number this
   * system can record, so it is refused rather than warned about.
   */
  if (parsed.lines.length !== parsed.expectedLineCount) {
    throw new Error(
      `This count has ${parsed.lines.length} of ${parsed.expectedLineCount} lines. Count every line before submitting — a missing line records as zero.`,
    )
  }

  return repository.submitCount({
    idempotencyKey: parsed.actionId,
    locationId: parsed.locationId,
    countKind: parsed.countKind,
    lines: parsed.lines,
  } satisfies SubmitCountCommand)
}

/**
 * Millilitres from a scale reading, for a spirit counted by weight.
 *
 * Wraps the domain function so the count screen never does the arithmetic itself.
 * Specification §6: "(gross − tare) ≈ ml for spirits". This is the first caller
 * `mlFromGrossWeight` has ever had outside its own test (BAR-046, BAR-081).
 */
export function partialMlFromWeight(grossWeightG: number, tareWeightG: number): number {
  return mlFromGrossWeight(grossWeightG, tareWeightG)
}

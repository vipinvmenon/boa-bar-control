/**
 * BAR-060 — recording a delivery.
 *
 * Specification §4: a receipt is posted "against a delivery note / invoice
 * number". That document is what the excise return and the STOK settlement are
 * both reconciled to, so a receipt without one cannot be defended later — which is
 * why the reference is required here and in the database, not merely encouraged.
 */
import { z } from 'zod'
import type { CountWriteOutcome, Repository } from '../data/repository'

const lineSchema = z.object({
  skuId: z.string().min(1),
  containers: z
    .number()
    .int('a delivery is counted in whole containers')
    .positive('a delivery line must be at least one container'),
})

const receiptSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  locationId: z.string().min(1, 'a delivery needs a destination'),
  supplier: z.string().trim().min(1, 'Who delivered this?'),
  deliveryNote: z.string().trim().min(1, 'Enter the delivery note or invoice number'),
  lines: z.array(lineSchema).min(1, 'Add at least one product to the delivery'),
})

export type RecordReceiptInput = z.infer<typeof receiptSchema> & { repository: Repository }

export async function recordReceipt({
  repository,
  ...input
}: RecordReceiptInput): Promise<CountWriteOutcome> {
  const parsed = receiptSchema.parse(input)

  const seen = new Set<string>()
  for (const line of parsed.lines) {
    if (seen.has(line.skuId)) {
      // Two lines for one SKU on a paper delivery note is ambiguous — is it 12 or
      // 24? The database refuses it too.
      throw new Error('The same product appears twice on this delivery')
    }
    seen.add(line.skuId)
  }

  return repository.recordReceipt({
    idempotencyKey: parsed.actionId,
    locationId: parsed.locationId,
    supplier: parsed.supplier,
    deliveryNote: parsed.deliveryNote,
    lines: parsed.lines,
  })
}

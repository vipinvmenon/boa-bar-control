/**
 * BAR-064 — requesting stock and cancelling an unissued request.
 *
 * Docket creation owns the requested → issued transition. Keeping that link in
 * the issue transaction means the warehouse cannot claim it issued a request
 * without a real custody record.
 */
import { z } from 'zod'
import type { Repository, TopUpWriteOutcome } from '../data/repository'

const requestSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  locationId: z.string().min(1, 'a top-up needs a bar'),
  skuId: z.string().min(1, 'a top-up needs a product'),
  requestedContainers: z.number().int('containers must be whole').positive('request at least one container'),
  urgency: z.enum(['normal', 'urgent']),
  note: z.string().trim().max(240, 'the note must be 240 characters or fewer').optional(),
})

export type RequestTopUpInput = z.infer<typeof requestSchema> & { repository: Repository }

export async function requestTopUp({ repository, ...input }: RequestTopUpInput): Promise<TopUpWriteOutcome> {
  const parsed = requestSchema.parse(input)
  return repository.requestTopUp({
    idempotencyKey: parsed.actionId,
    locationId: parsed.locationId,
    skuId: parsed.skuId,
    requestedContainers: parsed.requestedContainers,
    urgency: parsed.urgency,
    note: parsed.note || undefined,
  })
}

const cancelSchema = z.object({
  actionId: z.string().uuid('the action id must be a UUID'),
  requestId: z.string().uuid('the top-up request id must be a UUID'),
})

export type CancelTopUpInput = z.infer<typeof cancelSchema> & { repository: Repository }

export async function cancelTopUp({ repository, ...input }: CancelTopUpInput): Promise<TopUpWriteOutcome> {
  const parsed = cancelSchema.parse(input)
  return repository.updateTopUp({
    idempotencyKey: parsed.actionId,
    requestId: parsed.requestId,
    status: 'cancelled',
  })
}

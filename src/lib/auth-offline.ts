/**
 * BAR-068 — cached membership access is allowed only during an offline cold
 * start and only while the Supabase session's JWT remains valid.
 */
export function canUseCachedMemberships(input: {
  online: boolean
  expiresAt?: number | null
  now?: number
}): boolean {
  if (input.online) return false
  return !input.expiresAt || input.expiresAt * 1000 > (input.now ?? Date.now())
}

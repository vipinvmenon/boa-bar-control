import { describe, expect, it } from 'vitest'
import { canUseCachedMemberships } from './auth-offline'

describe('canUseCachedMemberships', () => {
  const now = 1_000_000

  it('allows a valid session while offline', () => {
    expect(canUseCachedMemberships({ online: false, expiresAt: 1_001, now })).toBe(true)
  })

  it('rejects an expired session while offline', () => {
    expect(canUseCachedMemberships({ online: false, expiresAt: 999, now })).toBe(false)
  })

  it('rejects cached membership while online', () => {
    expect(canUseCachedMemberships({ online: true, expiresAt: 1_001, now })).toBe(false)
  })

  it('allows sessions without an expiry, as Supabase may omit it', () => {
    expect(canUseCachedMemberships({ online: false, now })).toBe(true)
  })
})

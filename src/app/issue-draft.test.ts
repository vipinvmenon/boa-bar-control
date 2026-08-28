import { describe, expect, it } from 'vitest'
import { parseIssueDraftSearch } from '../screens/issue/draft'

describe('issue draft search', () => {
  it('coerces a URL quantity and keeps valid draft ids', () => {
    expect(parseIssueDraftSearch({
      actionId: '3f1c9a52-8d4e-4b21-9f77-1c2b6d5a0e33',
      fromLocationId: 'warehouse',
      toLocationId: 'bar-3',
      skuId: 'kf',
      containers: '48',
      unit: 'case',
    })).toMatchObject({ containers: 48, skuId: 'kf', unit: 'case' })
  })

  it('drops a malformed draft instead of trusting URL input', () => {
    expect(parseIssueDraftSearch({ containers: '-4', actionId: 'not-a-uuid' })).toEqual({})
  })
})

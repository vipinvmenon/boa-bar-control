import { describe, expect, it } from 'vitest'
import { CATALOGUE, ISSUE_OPTIONS } from './design-data'

describe('fixture issue options', () => {
  it('offers every catalogue SKU rather than a visual-only slice', () => {
    const catalogueIds = CATALOGUE.flatMap((group) => group.items.map((item) => item.skuId))
    expect(ISSUE_OPTIONS.products.map((product) => product.skuId)).toEqual(catalogueIds)
  })

  it('reproduces the design destinations and default stock figures', () => {
    expect(ISSUE_OPTIONS.destinations).toHaveLength(5)
    expect(ISSUE_OPTIONS.products.find((product) => product.skuId === ISSUE_OPTIONS.defaultProductId))
      .toMatchObject({ unitsPerCase: 24, warehouseContainers: 288 })
  })
})

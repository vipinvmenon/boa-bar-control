/**
 * BAR-156 — the opening warehouse quantities, checked against the design.
 *
 * The bootstrap seeds the warehouse with the design's own catalogue figures. That
 * is deliberate: it turns the seed into a verification artefact. Once the
 * migration is applied and `pnpm bootstrap` has run, the live warehouse screen
 * must reproduce `references/ui/warehouse.png` — and if it does not, the live
 * repository is wrong in a way somebody can see, rather than plausible in a way
 * nobody checks.
 *
 * That only works while the seed and the design agree, so this asserts it. The
 * quantities live in `supabase/bootstrap/opening-warehouse.json`, read by both
 * this test and `scripts/bootstrap.mjs`, so there is one copy.
 *
 * Note what this does NOT prove: that the migration applies, that the RPC posts,
 * or that the screen renders. Those need a database and are recorded as
 * outstanding in docs/CURRENT-STATE.md.
 */
import { describe, expect, it } from 'vitest'
import opening from '../../../supabase/bootstrap/opening-warehouse.json'
import { CATALOGUE } from '../fixture/design-data'
import { groupKey, type CategoryKey } from '../live/format'

/**
 * SKU code -> the category the bootstrap migration assigns it. Transcribed from
 * `supabase/migrations/202608280002_bootstrap.sql`; if a category changes there
 * and not here, the group totals below stop matching and this test fails, which
 * is the intent.
 */
const CATEGORY_BY_CODE: Record<string, CategoryKey> = {
  KF650: 'bottled_beer',
  BUD500: 'bottled_beer',
  COR355: 'bottled_beer',
  BIRA330: 'bottled_beer',
  STOK30: 'draught_beer',
  OM750: 'spirits',
  SIG750: 'spirits',
  SMI750: 'spirits',
  COKE300: 'mixers',
  TON200: 'mixers',
  SOD300: 'mixers',
}

const lines = opening.lines as { sku_code: string; containers: number }[]

/** '380 CONTAINERS' -> 380 */
function designTotal(groupName: string): number {
  const group = CATALOGUE.find((g) => g.key === groupName)
  if (!group) throw new Error(`the design has no ${groupName} group`)
  const parsed = Number(group.totalLabel.replace(/[^0-9]/g, ''))
  if (!Number.isFinite(parsed)) throw new Error(`cannot parse ${group.totalLabel}`)
  return parsed
}

function openingTotal(groupName: string): number {
  return lines
    .filter((line) => groupKey(CATEGORY_BY_CODE[line.sku_code]!) === groupName)
    .reduce((sum, line) => sum + line.containers, 0)
}

describe('opening warehouse stock reproduces the design', () => {
  it('every seeded SKU code has a known category', () => {
    for (const line of lines) {
      expect(CATEGORY_BY_CODE[line.sku_code], `unmapped SKU code ${line.sku_code}`).toBeDefined()
    }
  })

  it.each(['BEER', 'SPIRITS', 'MIXERS'])('%s group total matches the design', (group) => {
    expect(openingTotal(group)).toBe(designTotal(group))
  })

  it('the venue total matches the design warehouse figure of 638', () => {
    const total = lines.reduce((sum, line) => sum + line.containers, 0)
    expect(total).toBe(638)
    // And that figure is itself the sum of the design's three group labels, so
    // this is not two independent transcriptions of the same number.
    expect(total).toBe(designTotal('BEER') + designTotal('SPIRITS') + designTotal('MIXERS'))
  })

  it('opens no SKU at zero', () => {
    // boa_bar_open_stock rejects a non-positive line: opening at zero is
    // indistinguishable from never opening, and the RPC says so rather than
    // recording a receipt that adds nothing.
    for (const line of lines) {
      expect(line.containers, line.sku_code).toBeGreaterThan(0)
    }
  })

  it('names no SKU twice', () => {
    const codes = lines.map((l) => l.sku_code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

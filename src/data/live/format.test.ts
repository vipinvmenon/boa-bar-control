/**
 * BAR-042 — the live repository's formatting rules, tested against the design.
 *
 * This suite is an acceptance artefact, not a unit-test formality. The fixture
 * repository reproduces the design by transcribing its strings; the live
 * repository has to *derive* them. Every case below is a quantity the approved
 * design actually renders, with the SKU shape that must produce it. If a rule
 * here drifts, a live screen stops matching references/ui/ — silently, because a
 * plausible wrong number looks exactly like a right one.
 */
import { describe, expect, it } from 'vitest'
import {
  actorLabel,
  categoryWord,
  groupKey,
  issueSpecLabel,
  makeClock,
  partialHintFor,
  partialModeFor,
  partialStepFor,
  quantityPair,
  signed,
  signedPct,
  specLabel,
  thousands,
  trimDecimal,
  unitWord,
  volumeLabel,
  type SkuShape,
} from './format'

const kingfisher: SkuShape = { categoryKey: 'bottled_beer', containerType: 'bottle', mlPerContainer: 650, unitsPerCase: 24, tareWeightG: null }
const corona: SkuShape = { categoryKey: 'bottled_beer', containerType: 'bottle', mlPerContainer: 355, unitsPerCase: 24, tareWeightG: null }
const bira: SkuShape = { categoryKey: 'bottled_beer', containerType: 'can', mlPerContainer: 330, unitsPerCase: 24, tareWeightG: null }
const stok: SkuShape = { categoryKey: 'draught_beer', containerType: 'keg', mlPerContainer: 30_000, unitsPerCase: 1, tareWeightG: null }
const oldMonk: SkuShape = { categoryKey: 'spirits', containerType: 'bottle', mlPerContainer: 750, unitsPerCase: 12, tareWeightG: 480 }
const coke: SkuShape = { categoryKey: 'mixers', containerType: 'bottle', mlPerContainer: 300, unitsPerCase: 24, tareWeightG: null }
const tonic: SkuShape = { categoryKey: 'mixers', containerType: 'bottle', mlPerContainer: 200, unitsPerCase: 24, tareWeightG: null }

describe('quantityPair reproduces every warehouse row in the design', () => {
  // Each expectation is transcribed from references/design-source/design-script.jsx
  // via src/data/fixture/design-data.ts CATALOGUE.
  const cases: [string, SkuShape, number, string, string][] = [
    ['Kingfisher Premium', kingfisher, 288, '12 cases', '288 bottles'],
    ['Corona Extra', corona, 48, '2 cases', '48 bottles'],
    ['Bira 91 White', bira, 36, '1.5 cases', '36 cans'],
    ['STOK Draught', stok, 8, '8 kegs', '240 L'],
    ['Old Monk', oldMonk, 62, '62 bottles', '46,500 ml'],
    ['Coca-Cola', coke, 96, '4 cases', '96 bottles'],
    ['Tonic Water', tonic, 12, '12 bottles', '2,400 ml'],
  ]

  for (const [name, sku, containers, primary, secondary] of cases) {
    it(`${name}: ${containers} -> ${primary} / ${secondary}`, () => {
      expect(quantityPair(sku, containers)).toEqual({ primary, secondary })
    })
  }

  it('never expresses a spirit in cases, however many bottles there are', () => {
    // 62 bottles at 12 per case would be "5.2 cases", which is not how a spirit
    // is issued, counted or written on an excise return.
    expect(quantityPair(oldMonk, 240).primary).toBe('240 bottles')
  })

  it('falls back to containers below a full case rather than showing a fraction', () => {
    expect(quantityPair(coke, 23).primary).toBe('23 bottles')
    expect(quantityPair(coke, 24).primary).toBe('1 cases')
  })

  it('handles an empty position without producing NaN', () => {
    expect(quantityPair(kingfisher, 0)).toEqual({ primary: '0 bottles', secondary: '0 ml' })
    expect(quantityPair(stok, 0)).toEqual({ primary: '0 kegs', secondary: '0 L' })
  })
})

describe('specLabel reproduces the design spec lines', () => {
  it.each([
    [kingfisher, 'Beer · 650 ml bottle'],
    [corona, 'Beer · 355 ml bottle'],
    [bira, 'Beer · 330 ml can'],
    [stok, 'Beer · 30 L keg'],
    [oldMonk, 'Spirit · 750 ml bottle'],
    [coke, 'Mixer · 300 ml bottle'],
  ] as [SkuShape, string][])('%#', (sku, expected) => {
    expect(specLabel(sku)).toBe(expected)
  })
})

describe('issueSpecLabel reproduces the issue product card', () => {
  it('shows the case equivalence without duplicating the container type', () => {
    expect(issueSpecLabel(kingfisher)).toBe('Beer · 650 ml · 24 per case')
    expect(issueSpecLabel(oldMonk)).toBe('Spirit · 750 ml · 12 per case')
    expect(issueSpecLabel(stok)).toBe('Beer · 30 L · 1 per case')
  })
})

describe('partial capture modes follow specification section 6', () => {
  it('a keg is metered in litres', () => {
    expect(partialModeFor(stok)).toBe('litres')
    expect(partialStepFor('litres')).toBe(1)
  })

  it('a spirit with a recorded tare is weighed in millilitres', () => {
    expect(partialModeFor(oldMonk)).toBe('ml')
    expect(partialStepFor('ml')).toBe(50)
    expect(partialHintFor(oldMonk, 'ml')).toBe('WEIGH · TARE 480 G')
  })

  it('a spirit with NO recorded tare offers no partial stepper', () => {
    // Otherwise the screen shows a control that cannot be used correctly: without
    // a tare weight a gross reading cannot be turned into millilitres.
    expect(partialModeFor({ ...oldMonk, tareWeightG: null })).toBe('none')
  })

  it('bottled beer and mixers have no partial to capture', () => {
    expect(partialModeFor(kingfisher)).toBe('none')
    expect(partialModeFor(coke)).toBe('none')
  })
})

describe('grouping', () => {
  it('collapses bottled and draught beer into the design\'s single BEER group', () => {
    expect(groupKey('bottled_beer')).toBe('BEER')
    expect(groupKey('draught_beer')).toBe('BEER')
    expect(groupKey('spirits')).toBe('SPIRITS')
    expect(groupKey('mixers')).toBe('MIXERS')
  })

  it('keeps them distinct as words, because their tolerances differ', () => {
    expect(categoryWord('draught_beer')).toBe('Beer')
    expect(categoryWord('spirits')).toBe('Spirit')
  })
})

describe('numbers and signs', () => {
  it('groups thousands as the design does', () => {
    expect(thousands(46_500)).toBe('46,500')
    expect(thousands(2_400)).toBe('2,400')
    expect(thousands(240)).toBe('240')
  })

  it('trims a trailing zero decimal', () => {
    expect(trimDecimal(1.5)).toBe('1.5')
    expect(trimDecimal(12)).toBe('12')
  })

  it('uses a true minus sign, not a hyphen', () => {
    expect(signed(-12, ' L')).toBe('−12 L')
    expect(signed(3)).toBe('+3')
    expect(signed(0)).toBe('0')
    expect(signedPct(-6.4)).toBe('−6.4%')
    expect(signedPct(2.4)).toBe('+2.4%')
  })

  it('renders an uncomputable percentage as an em dash, never as zero', () => {
    // Zero would read as "no variance", which is a different and much more
    // reassuring claim than "we cannot compute this".
    expect(signedPct(null)).toBe('—')
  })

  it('states a volume in the unit that SKU is spoken about in', () => {
    expect(volumeLabel(stok, 96_000)).toBe('96 L')
    expect(volumeLabel(oldMonk, 11_400)).toBe('11,400 ml')
  })
})

describe('unitWord', () => {
  it('pluralises and upper-cases', () => {
    expect(unitWord('bottle')).toBe('BOTTLES')
    expect(unitWord('can')).toBe('CANS')
    expect(unitWord('keg')).toBe('KEGS')
  })

  it('does not double a plural already present in the column', () => {
    expect(unitWord('bottles')).toBe('BOTTLES')
  })

  it('degrades readably on an unexpected container type rather than throwing', () => {
    // Naive `+s` pluralisation. `POUCHS` is not English, but container_type is
    // free text and a wrong plural on an unexpected value is a great deal better
    // than a thrown error on the night. The four types the venue actually uses
    // (bottle, can, keg, case) all pluralise correctly.
    expect(unitWord('pouch')).toBe('POUCHS')
    expect(unitWord('')).toBe('CONTAINERS')
  })
})

describe('actorLabel', () => {
  it('upper-cases a first name for the ledger', () => {
    expect(actorLabel('Chandan')).toBe('CHANDAN')
  })

  it('reads as a defect when no name resolves', () => {
    // Deliberately not "Authenticated staff": a custody row that cannot name its
    // two parties documents nothing, and must look wrong (BAR-124).
    expect(actorLabel(null)).toBe('UNNAMED')
    expect(actorLabel('   ')).toBe('UNNAMED')
  })
})

describe('the clock is the venue\'s, not the device\'s', () => {
  const clock = makeClock('Asia/Kolkata')

  it('renders venue-local wall-clock time from an instant', () => {
    // 14:13 UTC is 19:43 IST — the design's AS OF stamp.
    expect(clock.time('2026-10-10T14:13:00Z')).toBe('19:43')
  })

  it('is unaffected by the timezone the instant was expressed in', () => {
    expect(clock.time('2026-10-10T19:43:00+05:30')).toBe('19:43')
  })

  it('uses the design\'s three age forms', () => {
    const now = new Date('2026-10-10T14:13:00Z')
    expect(clock.ago('2026-10-10T14:01:00Z', now)).toBe('12 MIN AGO')
    expect(clock.ago('2026-10-10T13:13:00Z', now)).toBe('1 H AGO')
    expect(clock.ago('2026-10-10T11:13:00Z', now)).toBe('3 H AGO')
  })

  it('says so when there is no movement at all', () => {
    expect(clock.ago(null, new Date('2026-10-10T14:13:00Z'))).toBe('NO MOVEMENT')
  })

  it('never reports a negative age from a device clock running behind', () => {
    const now = new Date('2026-10-10T14:13:00Z')
    expect(clock.minutesBetween('2026-10-10T14:20:00Z', now)).toBe(0)
  })

  it('does not crash on an unparseable stamp', () => {
    expect(clock.time('not a date')).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'
import { caseCountLabel, containersFor, issuePresets, issueStep, partialToMl, quantityFor } from './units'

describe('issue unit conversion', () => {
  it('reproduces the design default in both modes', () => {
    expect(containersFor(2, 'case', 24)).toBe(48)
    expect(quantityFor(48, 'case', 24)).toBe(2)
    expect(quantityFor(48, 'container', 24)).toBe(48)
  })

  it('derives the design presets from the SKU case size', () => {
    expect(issuePresets('case', 24)).toEqual([1, 2, 4, 6])
    expect(issuePresets('container', 24)).toEqual([24, 48, 96, 144])
    expect(issuePresets('container', 12)).toEqual([12, 24, 48, 72])
  })

  it('uses a quarter-case container step, with a one-container floor', () => {
    expect(issueStep('container', 24)).toBe(6)
    expect(issueStep('container', 12)).toBe(3)
    expect(issueStep('container', 1)).toBe(1)
    expect(issueStep('case', 24)).toBe(24)
  })

  it("formats cases with the design's own formula, two decimals and all", () => {
    // design-script.jsx:222 — `(bottles / 24).toFixed(2).replace(/\.00$/, '')`.
    // A whole number loses its decimals; a fraction keeps both digits. `1.5` was
    // what this returned first, and it is a visual deviation (non-negotiable 5).
    expect(caseCountLabel(48, 24)).toBe('2')
    expect(caseCountLabel(36, 24)).toBe('1.50')
    expect(caseCountLabel(25, 24)).toBe('1.04')
    expect(caseCountLabel(12, 24)).toBe('0.50')
  })
})

describe('partialToMl', () => {
  it('converts a keg reading from litres, because the ledger holds millilitres', () => {
    // A keg read as `12` stored as 12 ml rather than 12,000 ml is a 1000x
    // understatement on the largest container the venue has.
    expect(partialToMl(12, 'litres')).toBe(12_000)
    expect(partialToMl(0.5, 'litres')).toBe(500)
  })

  it('passes a weighed spirit reading through unchanged', () => {
    expect(partialToMl(550, 'ml')).toBe(550)
  })

  it('treats a line with no partial as zero', () => {
    expect(partialToMl(0, 'none')).toBe(0)
    expect(partialToMl(-3, 'ml')).toBe(0)
  })

  it('never stores a fractional millilitre', () => {
    expect(partialToMl(1.4, 'litres')).toBe(1_400)
    expect(partialToMl(12.7, 'ml')).toBe(13)
  })
})

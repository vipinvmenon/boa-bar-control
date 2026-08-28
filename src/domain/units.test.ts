import { describe, expect, it } from 'vitest'
import { caseCountLabel, containersFor, issuePresets, issueStep, quantityFor } from './units'

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

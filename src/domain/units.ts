/**
 * Case/container conversion for BAR-051.
 *
 * The issue screen offers the design's two entry modes but the command always
 * carries whole containers. Keeping that conversion here means the picker,
 * review and service cannot quietly disagree about what "2 cases" means.
 */

export type IssueUnit = 'case' | 'container'

export function containersFor(quantity: number, unit: IssueUnit, unitsPerCase: number): number {
  return unit === 'case' ? quantity * unitsPerCase : quantity
}

export function quantityFor(containers: number, unit: IssueUnit, unitsPerCase: number): number {
  return unit === 'case' ? containers / unitsPerCase : containers
}

/** The approved presets are 1, 2, 4 and 6 cases in either representation. */
export function issuePresets(unit: IssueUnit, unitsPerCase: number): number[] {
  const cases = [1, 2, 4, 6]
  return unit === 'case' ? cases : cases.map((count) => count * unitsPerCase)
}

/** The design increments cases by one and containers by a quarter case. */
export function issueStep(unit: IssueUnit, unitsPerCase: number): number {
  return unit === 'case' ? unitsPerCase : Math.max(1, Math.floor(unitsPerCase / 4))
}

/**
 * Cases, as the design writes them.
 *
 * The formula is transcribed from design-script.jsx:222 and :241 —
 * `(bottles / 24).toFixed(2).replace(/\.00$/, '')` — and the two decimals are
 * deliberate: 36 bottles reads `1.50 cases`, not `1.5 cases`.
 *
 * A stripped trailing zero looks tidier and was what this function did first, but
 * it is a visual deviation from the approved design (non-negotiable 5), and the
 * design's own inconsistency is not licence to pick: the warehouse catalogue's
 * sample data says `1.5 cases` because it is a hand-written string, while every
 * figure the issue and review screens COMPUTE goes through this formula.
 */
export function caseCountLabel(containers: number, unitsPerCase: number): string {
  return (containers / unitsPerCase).toFixed(2).replace(/\.00$/, '')
}

/**
 * The millilitres a partial-container reading represents.
 *
 * The count screen shows litres for a keg and millilitres for a weighed spirit,
 * because that is what the meter and the scale report — but the ledger holds
 * millilitres only. Converting in the screen put unit arithmetic in a component
 * and risked a keg reading of `12` being stored as 12 ml rather than 12 litres,
 * which is a 1000x understatement on the single largest container the venue has.
 */
export function partialToMl(reading: number, mode: 'none' | 'ml' | 'litres'): number {
  if (reading <= 0) return 0
  return mode === 'litres' ? Math.round(reading * 1000) : Math.round(reading)
}

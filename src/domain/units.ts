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

export function caseCountLabel(containers: number, unitsPerCase: number): string {
  return (containers / unitsPerCase).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

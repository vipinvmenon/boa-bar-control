/**
 * Container / case / volume arithmetic for the custody flow.
 *
 * Derived, never stored. The design shows "2 cases · 650 ml · 31.2 L" beside a
 * container count; the previous implementation stored such strings, which is how
 * a "1.5 cases" label ended up next to a figure that could not produce it.
 *
 * Its own module rather than living beside the components, so React Fast Refresh
 * is not disabled for the whole file.
 */
export function describeQuantity(containers: number, unitsPerCase: number, mlPerContainer: number): string {
  const cases = (containers / unitsPerCase).toFixed(2).replace(/\.0+$/, '')
  const litres = ((containers * mlPerContainer) / 1000).toFixed(1)
  return `${cases} cases · ${mlPerContainer} ml · ${litres} L`
}

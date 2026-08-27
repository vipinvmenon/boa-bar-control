/**
 * BAR-043 — the fixture repository.
 *
 * Serves the approved design's own data (design-data.ts) through the same
 * interface the live repository will implement. A screen written against this
 * needs no change when the live implementation lands — which is the point of
 * BAR-042 preceding all screen work.
 *
 * Selected once at bootstrap, never reached as a fallback from a failed live
 * load. That fallback is how the previous implementation rendered fixture stock
 * as live festival inventory (BAR-067).
 */
import type {
  ActivityGroup,
  Alert,
  AsOf,
  BarDetail,
  BarSummary,
  CatalogueGroup,
  LedgerEntry,
  MovementDetail,
  Repository,
  StockPosition,
} from '../repository'
import { ALERTS, AS_OF, BARS, BAR_DETAIL, CATALOGUE, LEDGER, MOVEMENTS, STOCK_POSITION, variant } from './design-data'

export type FixtureVariant = 'a' | 'b'

export function createFixtureRepository(which: FixtureVariant = 'a'): Repository {
  const v = which === 'b' ? variant() : null

  return {
    kind: 'fixture',

    async asOf(): Promise<AsOf> {
      return v?.asOf ?? AS_OF
    },

    async stockPosition(): Promise<StockPosition> {
      return v?.stockPosition ?? STOCK_POSITION
    },

    async alerts(): Promise<Alert[]> {
      return ALERTS
    },

    async listBars(): Promise<BarSummary[]> {
      return v?.bars ?? BARS
    },

    async barDetail(barId: string): Promise<BarDetail | null> {
      return BAR_DETAIL[barId] ?? null
    },

    async catalogue(): Promise<CatalogueGroup[]> {
      return v?.catalogue ?? CATALOGUE
    },

    async ledger(group: ActivityGroup = 'All'): Promise<LedgerEntry[]> {
      const all = v?.ledger ?? LEDGER
      return group === 'All' ? all : all.filter((e) => e.group === group)
    },

    async movementDetail(id: string): Promise<MovementDetail | null> {
      return MOVEMENTS[id] ?? null
    },
  }
}

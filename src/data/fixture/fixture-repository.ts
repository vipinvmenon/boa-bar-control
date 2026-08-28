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
  AcceptDocketCommand,
  ActivityGroup,
  Alert,
  AsOf,
  BarDetail,
  BarSummary,
  CatalogueGroup,
  CountSession,
  CountWriteOutcome,
  Custody,
  IssueOptions,
  LedgerEntry,
  MovementDetail,
  Repository,
  SessionInfo,
  StockPosition,
  SubmitCountCommand,
  VarianceReport,
  WriteOutcome,
} from '../repository'
import { ALERTS, AS_OF, BARS, BAR_DETAIL, CATALOGUE, COUNT_SESSION, CUSTODY, ISSUE_OPTIONS, LEDGER, MOVEMENTS, SESSION, STOCK_POSITION, VARIANCE, variant } from './design-data'

export type FixtureVariant = 'a' | 'b'

export function createFixtureRepository(which: FixtureVariant = 'a'): Repository {
  const v = which === 'b' ? variant() : null

  return {
    kind: 'fixture',

    async asOf(): Promise<AsOf> {
      return v?.asOf ?? AS_OF
    },

    async session(): Promise<SessionInfo> {
      return SESSION
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

    async issueOptions(): Promise<IssueOptions> {
      return v?.issueOptions ?? ISSUE_OPTIONS
    },

    async ledger(group: ActivityGroup = 'All'): Promise<LedgerEntry[]> {
      const all = v?.ledger ?? LEDGER
      return group === 'All' ? all : all.filter((e) => e.group === group)
    },

    async movementDetail(id: string): Promise<MovementDetail | null> {
      return MOVEMENTS[id] ?? null
    },

    async custody(): Promise<Custody> {
      return v?.custody ?? CUSTODY
    },

    async countSession(): Promise<CountSession> {
      return v?.countSession ?? COUNT_SESSION
    },

    async variance(): Promise<VarianceReport> {
      return v?.variance ?? VARIANCE
    },

    /**
     * BAR-044. The fixture commands record nothing durable and say so by
     * returning the design's own docket, so the walkthrough still reaches the
     * docket and received screens.
     *
     * They deliberately do NOT simulate a ledger. A fixture that pretended to
     * post movements would let the custody chain look functional in demo mode,
     * and the shell already announces DEMO DATA · NOTHING IS RECORDED on every
     * screen precisely because that must not be in doubt (BAR-139).
     */
    async createDocket(): Promise<WriteOutcome> {
      const custody = v?.custody ?? CUSTODY
      return { status: 'posted', docketId: custody.docketId, docketNo: custody.docketNo }
    },

    /**
     * Records nothing, like the other fixture commands, and reports the design's
     * own line count so the confirmation screen has something true to show about
     * the walkthrough. The shell says DEMO DATA · NOTHING IS RECORDED throughout.
     */
    async submitCount(command: SubmitCountCommand): Promise<CountWriteOutcome> {
      return { status: 'posted', countSessionId: 'CT-0041', lines: command.lines.length }
    },

    async acceptDocket(command: AcceptDocketCommand): Promise<WriteOutcome> {
      const custody = v?.custody ?? CUSTODY
      return { status: 'posted', docketId: command.docketId || custody.docketId, docketNo: custody.docketNo }
    },
  }
}

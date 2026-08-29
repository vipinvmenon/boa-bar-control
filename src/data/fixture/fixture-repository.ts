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
  CustodyOverview,
  IssueOptions,
  LedgerEntry,
  MovementDetail,
  Repository,
  SessionInfo,
  StockPosition,
  CreateInviteCommand,
  PrintPack,
  ReceiptOptions,
  Team,
  VenueRole,
  RecordReceiptCommand,
  RecordWasteCommand,
  SubmitCountCommand,
  VarianceReport,
  WasteOptions,
  WriteOutcome,
} from '../repository'
import { ALERTS, AS_OF, BARS, BAR_DETAIL, CATALOGUE, COUNT_SESSION, CUSTODY, CUSTODY_BY_DOCKET, CUSTODY_OVERVIEW, ISSUE_OPTIONS, PRINT_PACK, TEAM, RECEIPT_OPTIONS, WASTE_OPTIONS, LEDGER, MOVEMENTS, SESSION, STOCK_POSITION, VARIANCE, variant } from './design-data'

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
      // BAR-043. The variant branch was missing, so this returned the same object
      // under both fixture sets and the bar workspace could never be proved to
      // read its data.
      return v?.barDetail[barId] ?? BAR_DETAIL[barId] ?? null
    },

    async catalogue(): Promise<CatalogueGroup[]> {
      return v?.catalogue ?? CATALOGUE
    },

    async team(): Promise<Team> {
      return v?.team ?? TEAM
    },

    /**
     * A fixed code, not a random one: the fidelity gate compares two renders of
     * the same screen, and a fresh code each call would read as data changing when
     * nothing had.
     */
    async createInvite(command: CreateInviteCommand): Promise<{ code: string; name: string }> {
      return { code: 'DEMO42', name: command.displayName }
    },

    async claimInvite(): Promise<{ name: string; role: VenueRole }> {
      return { name: 'Demo', role: 'crew' }
    },

    async setMembership(): Promise<void> {
      // Records nothing, like every other fixture command.
    },

    async printPack(): Promise<PrintPack> {
      return v?.printPack ?? PRINT_PACK
    },

    async receiptOptions(): Promise<ReceiptOptions> {
      return v?.receiptOptions ?? RECEIPT_OPTIONS
    },

    async recordReceipt(command: RecordReceiptCommand): Promise<CountWriteOutcome> {
      return { status: 'posted', countSessionId: `MV-${command.deliveryNote}`, lines: command.lines.length }
    },

    async wasteOptions(locationId?: string): Promise<WasteOptions> {
      const base = v?.wasteOptions ?? WASTE_OPTIONS
      if (!locationId) return base
      const bar = (v?.bars ?? BARS).find((item) => item.id === locationId)
      if (!bar) throw new Error('Unknown location')
      return { ...base, locationId: bar.id, locationName: bar.name.toUpperCase() }
    },

    async recordWaste(command: RecordWasteCommand): Promise<CountWriteOutcome> {
      return { status: 'posted', countSessionId: `MV-${command.skuId}`, lines: 1 }
    },

    async custodyOverview(): Promise<CustodyOverview> {
      return v?.custodyOverview ?? CUSTODY_OVERVIEW
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

    /**
     * Honours the docket number, so opening the second docket in the list does
     * not show the first one's contents (BAR-146). The variant path keeps its
     * single shifted docket, which is what the two-state gate compares.
     */
    async custody(docketNo?: string): Promise<Custody> {
      if (v?.custody) return v.custody
      if (docketNo && CUSTODY_BY_DOCKET[docketNo]) return CUSTODY_BY_DOCKET[docketNo]!
      return CUSTODY
    },

    async countSession(locationId?: string): Promise<CountSession> {
      const base = v?.countSession ?? COUNT_SESSION
      if (!locationId) return base
      const bar = (v?.bars ?? BARS).find((item) => item.id === locationId)
      if (!bar) throw new Error('Unknown location')
      const locationName = bar.name.toUpperCase()
      return {
        ...base,
        locationId: bar.id,
        locationName,
        scopeLabel: `${locationName} · BLIND`,
      }
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
     * No blind to enforce here: the fixture repository has no position to
     * withhold, and the shell announces DEMO DATA throughout. Returns the
     * design's own count id so the walkthrough reads consistently.
     */
    async openCount(): Promise<{ countSessionId: string }> {
      return { countSessionId: 'CT-0041' }
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

/**
 * BAR-043 — the approved design's own data, as fixture data.
 *
 * Every value here is transcribed from
 * `references/design-source/design-script.jsx`. It is the design's sample data,
 * so a screen fed from this repository should match `references/ui/<screen>.png`
 * exactly — which is what makes the reference captures usable as an acceptance
 * artefact.
 *
 * This file is the ONLY place these literals may appear. A screen file
 * containing an SKU name, a stock figure or a bar name is a defect (ADR-010),
 * because a hardcoded screen passes a screenshot comparison while being
 * non-functional — the precise failure this project is recovering from.
 *
 * `variant()` returns a second, visibly different data set for the two-state
 * fidelity gate (BAR-008). A screen that ignores its data renders identically
 * under both and fails.
 */
import type {
  Alert,
  BarDetail,
  BarSummary,
  CatalogueGroup,
  LedgerEntry,
  MovementDetail,
  StockPosition,
} from '../repository'

export const AS_OF = { label: '19:43', at: '2026-10-10T19:43:00+05:30' }

// design-markup.html:1090-1098 — the sync card's DEVICE / SIGNED IN pair.
export const SESSION = { deviceLabel: 'BAR-3-01', signedInName: 'RAHUL' }

// design-script.jsx:72-75
export const BARS: BarSummary[] = [
  { id: 'bar-1', name: 'BAR 1', containers: 182, status: 'HEALTHY',   tone: 'green', lead: 'Aditi',   countedAt: '17:40' },
  { id: 'bar-2', name: 'BAR 2', containers: 140, status: 'COUNT DUE', tone: 'gold',  lead: 'Gabe',    countedAt: '15:10', flag: 'MID-COUNT OVERDUE' },
  { id: 'bar-3', name: 'BAR 3', containers: 108, status: 'LOW STOCK', tone: 'red',   lead: 'Chandan', countedAt: '17:55', flag: '1 DOCKET INCOMING' },
  { id: 'bar-4', name: 'BAR 4', containers: 90,  status: 'HEALTHY',   tone: 'green', lead: 'Rahul',   countedAt: '17:32' },
]

// design-script.jsx: hero card and breakdown grid
export const STOCK_POSITION: StockPosition = {
  totalContainers: 1284,
  byArea: [
    { label: 'WAREHOUSE', containers: 638 },
    { label: 'BARS', containers: 520 },
    { label: 'HOSPITALITY', containers: 126 },
  ],
  asOf: AS_OF,
}

// design-script.jsx:183-186 — the three alerts, verbatim
export const ALERTS: Alert[] = [
  {
    id: 'kingfisher-low', level: 'CRITICAL', ageLabel: 'RUN-OUT ~20:10',
    title: 'Bar 3 · Kingfisher low', subtitle: 'Depleting 38 bottles/hr',
    metric: '12', metricUnit: 'LEFT', meterPct: 14, meterNote: '26 MIN OF COVER',
    actionLabel: 'ISSUE', tone: 'red', target: 'issue',
  },
  {
    id: 'dockets-open', level: 'WARNING', ageLabel: 'OLDEST 18 MIN',
    title: 'Dockets awaiting acceptance', subtitle: 'D-0184 Warehouse → Bar 3',
    metric: '2', metricUnit: 'OPEN', meterPct: 60, meterNote: '30 MIN SLA',
    actionLabel: 'OPEN', tone: 'gold', target: 'accept',
  },
  {
    id: 'bar2-count', level: 'WARNING', ageLabel: 'DUE 19:30',
    title: 'Bar 2 mid-count overdue', subtitle: 'Last counted 15:10 · Gabe',
    metric: '22', metricUnit: 'MIN LATE', meterPct: 73, meterNote: 'COUNT WINDOW CLOSES 20:30',
    actionLabel: 'COUNT', tone: 'gold', target: 'count',
  },
]

// design-script.jsx:92-113 — allGroups
export const CATALOGUE: CatalogueGroup[] = [
  {
    key: 'BEER', name: 'BEER', totalLabel: '380 CONTAINERS',
    items: [
      { skuId: 'kf',        name: 'Kingfisher Premium', spec: 'Beer · 650 ml bottle', primary: '12 cases',   secondary: '288 bottles', lastMovement: 'LAST MOVEMENT 12 MIN AGO', tone: 'muted' },
      { skuId: 'corona',    name: 'Corona Extra',       spec: 'Beer · 355 ml bottle', primary: '2 cases',    secondary: '48 bottles',  lastMovement: 'LAST MOVEMENT 1 H AGO',    tone: 'muted' },
      { skuId: 'bira',      name: 'Bira 91 White',      spec: 'Beer · 330 ml can',    primary: '1.5 cases',  secondary: '36 cans',     lastMovement: 'LAST MOVEMENT 2 H AGO',    tone: 'muted' },
      { skuId: 'stok',      name: 'STOK Draught',       spec: 'Beer · 30 L keg',      primary: '8 kegs',     secondary: '240 L',       lastMovement: 'LAST MOVEMENT 34 MIN AGO', tone: 'gold' },
    ],
  },
  {
    key: 'SPIRITS', name: 'SPIRITS', totalLabel: '142 CONTAINERS',
    items: [
      { skuId: 'monk',      name: 'Old Monk',       spec: 'Spirit · 750 ml bottle', primary: '62 bottles', secondary: '46,500 ml', lastMovement: 'LAST MOVEMENT 26 MIN AGO', tone: 'muted' },
      { skuId: 'signature', name: 'Signature Rare', spec: 'Spirit · 750 ml bottle', primary: '48 bottles', secondary: '36,000 ml', lastMovement: 'LAST MOVEMENT 1 H AGO',    tone: 'muted' },
      { skuId: 'smirnoff',  name: 'Smirnoff No.21', spec: 'Spirit · 750 ml bottle', primary: '32 bottles', secondary: '24,000 ml', lastMovement: 'LAST MOVEMENT 2 H AGO',    tone: 'muted' },
    ],
  },
  {
    key: 'MIXERS', name: 'MIXERS', totalLabel: '116 CONTAINERS',
    items: [
      { skuId: 'coke',  name: 'Coca-Cola',   spec: 'Mixer · 300 ml bottle', primary: '4 cases',    secondary: '96 bottles', lastMovement: 'LAST MOVEMENT 40 MIN AGO', tone: 'muted' },
      { skuId: 'tonic', name: 'Tonic Water', spec: 'Mixer · 200 ml bottle', primary: '12 bottles', secondary: '2,400 ml',   lastMovement: 'LAST MOVEMENT 2 H AGO',    tone: 'gold' },
      { skuId: 'soda',  name: 'Soda',        spec: 'Mixer · 300 ml bottle', primary: '8 bottles',  secondary: '2,400 ml',   lastMovement: 'LAST MOVEMENT 3 H AGO',    tone: 'red' },
    ],
  },
]

// design-script.jsx:157-163 — allLedger. Note the design's five groups.
export const LEDGER: LedgerEntry[] = [
  { id: 'd0184', group: 'Transfers',   at: '19:38', title: 'Docket D-0184 accepted', detail: 'Warehouse → Bar 3 · 48 Kingfisher',                    who: 'CHANDAN → RAHUL', tone: 'green', flagged: false },
  { id: 'issue', group: 'Transfers',   at: '19:31', title: 'Stock issued',           detail: 'Warehouse → Bar 3 · 48 Kingfisher',                    who: 'CHANDAN',         tone: 'muted', flagged: false },
  { id: 'waste', group: 'Waste',       at: '19:22', title: 'Waste recorded',         detail: 'Bar 2 · 2 Corona · breakage',                          who: 'GABE',            tone: 'red',   flagged: false },
  { id: 'count', group: 'Counts',      at: '19:18', title: 'Mid-count started',      detail: 'Bar 1 · blind · 18 lines',                             who: 'CHANDAN',         tone: 'muted', flagged: false },
  { id: 'adjust', group: 'Adjustments', at: '18:52', title: 'Adjustment',            detail: 'Bar 4 · +12 Budweiser · reason: incorrect issue entry', who: 'SALMAN',          tone: 'red',   flagged: true },
]

// design-script.jsx:130-140 — mvData
export const MOVEMENTS: Record<string, MovementDetail> = {
  d0184: {
    id: 'd0184', kindLabel: 'TRANSFER · ACCEPTED', tone: 'green',
    title: 'DOCKET D-0184 ACCEPTED', detail: 'Warehouse → Bar 3 · 48 Kingfisher Premium',
    rows: [
      { label: 'Movement ID', value: 'MV-11482' },
      { label: 'Type', value: 'ISSUE / ACCEPT', tone: 'green' },
      { label: 'Containers', value: '48 BOTTLES' },
      { label: 'Volume', value: '31,200 ML' },
      { label: 'Issued by', value: 'CHANDAN · 19:31' },
      { label: 'Accepted by', value: 'RAHUL · 19:38' },
    ],
  },
  adjust: {
    id: 'adjust', kindLabel: 'ADJUSTMENT · AUDIT', tone: 'red',
    title: 'ADJUSTMENT +12 BUDWEISER', detail: 'Bar 4 · reason: incorrect issue entry',
    rows: [
      { label: 'Movement ID', value: 'MV-11455' },
      { label: 'Signed delta', value: '+12 BOTTLES', tone: 'red' },
      { label: 'Reason', value: 'INCORRECT ISSUE ENTRY' },
      { label: 'Entered by', value: 'SALMAN · 18:52' },
      { label: 'Reverses', value: 'MV-11402' },
      { label: 'Audit flag', value: 'REVIEW NEXT MORNING', tone: 'red' },
    ],
  },
}

// design-script.jsx:121-127 — barInv, plus the bar screen's header and grid
export const BAR_DETAIL: Record<string, BarDetail> = {
  'bar-3': {
    id: 'bar-3', name: 'BAR 3', managerName: 'Chandan', asOf: AS_OF,
    categoryTotals: [
      { label: 'BEER', containers: 44 },
      { label: 'SPIRITS', containers: 34 },
      { label: 'MIXERS', containers: 30 },
    ],
    incoming: {
      docketNo: 'D-0184', fromName: 'Warehouse', toName: 'Bar 3',
      summary: '48 × Kingfisher Premium', ageLabel: '18 MIN',
    },
    inventory: [
      { skuId: 'kf',        name: 'Kingfisher Premium', quantity: '12', unit: 'BOTTLES', tone: 'red',   movementSummary: 'RECEIVED 48 · WASTE 2 · RETURNED 0' },
      { skuId: 'corona',    name: 'Corona Extra',       quantity: '18', unit: 'BOTTLES', tone: 'muted', movementSummary: 'RECEIVED 24 · WASTE 0 · RETURNED 0' },
      { skuId: 'bira',      name: 'Bira 91 White',      quantity: '14', unit: 'CANS',    tone: 'muted', movementSummary: 'RECEIVED 24 · WASTE 1 · RETURNED 0' },
      { skuId: 'monk',      name: 'Old Monk',           quantity: '14', unit: 'BOTTLES', tone: 'muted', movementSummary: 'RECEIVED 18 · WASTE 0 · RETURNED 0' },
      { skuId: 'signature', name: 'Signature Rare',     quantity: '12', unit: 'BOTTLES', tone: 'muted', movementSummary: 'RECEIVED 12 · WASTE 0 · RETURNED 0' },
      { skuId: 'coke',      name: 'Coca-Cola',          quantity: '18', unit: 'BOTTLES', tone: 'muted', movementSummary: 'RECEIVED 24 · WASTE 0 · RETURNED 0' },
    ],
  },
}

/**
 * A visibly different second data set for the two-state fidelity gate.
 * Values are shifted, not merely relabelled, so a screen reading any of them
 * renders differently. A screen that renders identically is not reading its data.
 */
export function variant() {
  return {
    asOf: { label: '21:07', at: '2026-10-10T21:07:00+05:30' },
    bars: BARS.map((b, i) => ({
      ...b,
      name: `BAR ${i + 5}`,
      containers: b.containers + 11 * (i + 1),
      lead: ['Priya', 'Imran', 'Nikhil', 'Sana'][i] ?? b.lead,
      countedAt: `18:${String(10 + i * 5).padStart(2, '0')}`,
      flag: i === 0 ? 'COUNT DUE SOON' : b.flag,
    })),
    stockPosition: {
      ...STOCK_POSITION,
      totalContainers: 1502,
      byArea: STOCK_POSITION.byArea.map((a, i) => ({ ...a, containers: a.containers + 30 * (i + 1) })),
    },
    ledger: LEDGER.map((e, i) => ({ ...e, title: `${e.title} (v2)`, at: `18:${String(5 + i * 4).padStart(2, '0')}` })),
    catalogue: CATALOGUE.map((g) => ({
      ...g,
      totalLabel: g.totalLabel.replace(/^\d+/, (n) => String(Number(n) + 40)),
      items: g.items.map((it) => ({ ...it, name: `${it.name} (v2)` })),
    })),
  }
}

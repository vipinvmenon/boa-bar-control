<script type="text/x-dc" data-dc-script="" data-props="{"$preview":{"width":470,"height":980},"offline":{"editor":"boolean","default":false,"tsType":"boolean","section":"Operations"},"blindCount":{"editor":"boolean","default":true,"tsType":"boolean","section":"Operations"},"role":{"editor":"enum","options":["Crew","Manager"],"default":"Manager","tsType":"string","section":"Operations"}}">
const GREEN = '#00F5A5', GOLD = '#E3BB72', RED = '#FF4A3D', MUTED = 'rgba(166,201,180,0.72)';

class Component extends DCLogic {
  state = {
    screen: 'home', stack: [], whFilter: 'ALL',
    issueQty: 2, issueUnit: 'CASE', issueTo: 'Bar 3',
    wasteQty: 2, wasteReason: 'Breakage',
    countIdx: 4, countFull: 0, countPartial: 0,
    filter: 'All', mv: null, sku: null,
    recvMode: 'accept', recvQty: 46, recvReason: null,
    incomingOpen: true, docketMade: false,
    toast: null, proposal: false,
  };

  componentWillUnmount() { clearTimeout(this._t); }

  go = (s) => this.setState(st => ({ screen: s, stack: [...st.stack, st.screen] }));
  back = () => this.setState(st => { const k = [...st.stack]; const p = k.pop() || 'home'; return { screen: p, stack: k }; });
  tab = (s) => this.setState({ screen: s, stack: [] });
  flash = (msg) => { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 2600); };

  renderVals() {
    const s = this.state;
    const offline = this.props.offline ?? false;
    const blind = this.props.blindCount ?? true;
    const role = this.props.role ?? 'Manager';
    const go = this.go, flash = this.flash;

    const _st = this.state, _rp = _st.repPeriod || 'DAY 1', _rid = _st.repId || 'excise';
    const REP = {
      excise: { name: 'EXCISE DAILY RETURN', sub: 'Consumption by category, duty basis', badge: 'PDF', badgeColor: '#E3BB72',
        cols: ['CATEGORY', 'CONSUMED', 'CLOSING'],
        rows: [ { k: 'Beer', a: '268', b: '642' }, { k: 'Spirits', a: '54', b: '218' }, { k: 'Mixers', a: '38', b: '424' }, { k: 'Total', a: '360', b: '1,284' } ],
        note: 'Consumed = sale + comp + waste. Filed against licence CL-11 / BOA 2026. Manager sign-off required before submission.' },
      settle: { name: 'STOCK SETTLEMENT', sub: 'Opening to closing, per location', badge: 'CSV', badgeColor: '#A6C9B4',
        cols: ['LOCATION', 'ISSUED', 'CLOSING'],
        rows: [ { k: 'Warehouse', a: '638', b: '638' }, { k: 'Bar 1', a: '196', b: '182' }, { k: 'Bar 2', a: '168', b: '140' }, { k: 'Bar 3', a: '156', b: '108', color: '#E3BB72' }, { k: 'Bar 4', a: '118', b: '90' }, { k: 'Hospitality', a: '134', b: '126' }, { k: 'Lounges', a: '0', b: '0' } ],
        note: 'Closing positions are derived, not counted. Bar 3 closing is pre-count — mid-event count at 19:52 supersedes it.' },
      hourly: { name: 'SALES PER HOUR', sub: 'Containers rung, peak bar', badge: 'CSV', badgeColor: '#A6C9B4',
        cols: ['HOUR', 'SOLD', 'PEAK BAR'],
        rows: [ { k: '15:00', a: '22', b: 'BAR 1' }, { k: '16:00', a: '38', b: 'BAR 1' }, { k: '17:00', a: '64', b: 'BAR 2' }, { k: '18:00', a: '118', b: 'BAR 3' }, { k: '19:00', a: '106', b: 'BAR 3' }, { k: 'Total', a: '348', b: '—' } ],
        note: '19:00 row is part-hour to 19:43. Doors 14:30, headline 21:15.' },
      waste: { name: 'WASTE SUMMARY', sub: 'By reason, by bar', badge: 'PDF', badgeColor: '#E3BB72',
        cols: ['REASON', 'QTY', 'SHARE'],
        rows: [ { k: 'Breakage', a: '5', b: '42%' }, { k: 'Foam / line loss', a: '4', b: '33%' }, { k: 'Spillage', a: '2', b: '17%' }, { k: 'Refused pour', a: '1', b: '8%' }, { k: 'Total', a: '12', b: '0.9%' } ],
        note: 'Share of total consumption. Line loss above 3% usually means a cellar problem, not staff.' },
      variance: { name: 'VARIANCE SUMMARY', sub: 'Counted vs theoretical, all locations', badge: 'PDF', badgeColor: '#E3BB72',
        cols: ['LOCATION', 'VARIANCE', 'STATUS'],
        rows: [ { k: 'Bar 1', a: '-0.8%', b: 'GREEN', color: '#00F5A5' }, { k: 'Bar 2', a: '—', b: 'NOT COUNTED', color: 'rgba(166,201,180,0.6)' }, { k: 'Bar 3', a: '-3.2%', b: 'AMBER', color: '#E3BB72' }, { k: 'Bar 4', a: '+1.4%', b: 'REVIEW', color: '#E3BB72' }, { k: 'Hospitality', a: '-0.4%', b: 'GREEN', color: '#00F5A5' } ],
        note: 'Positive variance is reviewed the same as negative — it usually means a missed receipt or an unaccepted docket.' },
      ledger: { name: 'MOVEMENT LEDGER EXPORT', sub: 'Full append-only ledger, audit format', badge: 'CSV', badgeColor: '#A6C9B4',
        cols: ['MOVEMENT', 'COUNT', 'LAST'],
        rows: [ { k: 'Receipt', a: '14', b: '18:20' }, { k: 'Issue', a: '38', b: '19:31' }, { k: 'Transfer', a: '6', b: '19:05' }, { k: 'Return', a: '2', b: '18:44' }, { k: 'Sale', a: '348', b: '19:43' }, { k: 'Comp', a: '9', b: '19:12' }, { k: 'Waste', a: '7', b: '19:22' }, { k: 'Adjustment', a: '3', b: '18:52', color: '#FF4A3D' } ],
        note: 'Every row carries actor, device and timestamp. Adjustments export with their reason string attached.' },
    };
    const _rep = REP[_rid];
    const _repList = ['excise', 'settle', 'hourly', 'waste', 'variance', 'ledger'].map(id => ({
      name: REP[id].name, sub: REP[id].sub, badge: REP[id].badge, badgeColor: REP[id].badgeColor,
      onClick: () => this.setState(x => ({ screen: 'rep', repId: id, stack: [...x.stack, x.screen] })),
    }));
    const _settle = [
      { k: 'OPENING', v: '1,404', color: 'rgba(242,239,226,0.88)' },
      { k: 'RECEIVED', v: '+240', color: '#00F5A5' },
      { k: 'ISSUED', v: '638', color: 'rgba(242,239,226,0.88)' },
      { k: 'SOLD', v: '-348', color: 'rgba(242,239,226,0.88)' },
      { k: 'WASTE', v: '-12', color: '#E3BB72' },
      { k: 'CLOSING', v: '1,284', color: '#00F5A5' },
    ];

    const bars = [
      { name: 'BAR 1', qty: 182, status: 'HEALTHY', color: GREEN, meta: 'Lead: Aditi · counted 17:40', flag: '', flagColor: MUTED },
      { name: 'BAR 2', qty: 140, status: 'COUNT DUE', color: GOLD, meta: 'Lead: Gabe · counted 15:10', flag: 'MID-COUNT OVERDUE', flagColor: GOLD },
      { name: 'BAR 3', qty: 108, status: 'LOW STOCK', color: RED, meta: 'Lead: Chandan · counted 17:55', flag: '1 DOCKET INCOMING', flagColor: GOLD },
      { name: 'BAR 4', qty: 90, status: 'HEALTHY', color: GREEN, meta: 'Lead: Rahul · counted 17:32', flag: '', flagColor: MUTED },
    ];
    const openBar = (b) => () => { if (b.name === 'BAR 3') go('bar'); else flash(b.name + ' · DEMO USES BAR 3'); };

    const screenLabels = {
      home: 'LIVE HOME', warehouse: 'WAREHOUSE', sku: 'SKU LEDGER', issue: 'ISSUE STOCK',
      review: 'REVIEW ISSUE', docket: 'DOCKET CREATED', bars: 'BARS', bar: 'BAR 3',
      accept: 'RECEIVE STOCK', diff: 'REPORT DIFFERENCE', received: 'RECEIVED', waste: 'RECORD WASTE',
      count: 'MID-EVENT COUNT', countDone: 'COUNT SUBMITTED', variance: 'VARIANCE',
      activity: 'ACTIVITY', mv: 'MOVEMENT', control: 'CONTROL', cowork: 'COWORK', more: 'MORE',
      reports: 'REPORTS', rep: 'REPORT',
    };

    const navColor = (k) => (s.screen === k ? GREEN : 'rgba(166,201,180,0.55)');
    const fullScreens = ['issue', 'review', 'docket', 'accept', 'diff', 'received', 'waste', 'count', 'countDone', 'sku', 'mv'];

    const whFilters = ['ALL', 'BEER', 'SPIRITS'].map(l => ({
      label: l,
      onClick: () => this.setState({ whFilter: l }),
      color: s.whFilter === l ? '#0D0D12' : 'rgba(166,201,180,0.8)',
      bg: s.whFilter === l ? GREEN : 'transparent',
      border: s.whFilter === l ? GREEN : 'rgba(166,201,180,0.22)',
    }));

    const allGroups = [
      { name: 'BEER', total: '380 CONTAINERS', items: [
        { name: 'Kingfisher Premium', spec: 'Beer · 650 ml bottle', qty: '12 cases', qty2: '288 bottles', last: 'LAST MOVEMENT 12 MIN AGO', qtyColor: '#F2EFE2' },
        { name: 'Corona Extra', spec: 'Beer · 355 ml bottle', qty: '2 cases', qty2: '48 bottles', last: 'LAST MOVEMENT 1 H AGO', qtyColor: '#F2EFE2' },
        { name: 'Bira 91 White', spec: 'Beer · 330 ml can', qty: '1.5 cases', qty2: '36 cans', last: 'LAST MOVEMENT 2 H AGO', qtyColor: '#F2EFE2' },
        { name: 'STOK Draught', spec: 'Beer · 30 L keg', qty: '8 kegs', qty2: '240 L', last: 'LAST MOVEMENT 34 MIN AGO', qtyColor: GOLD },
      ] },
      { name: 'SPIRITS', total: '142 CONTAINERS', items: [
        { name: 'Old Monk', spec: 'Spirit · 750 ml bottle', qty: '62 bottles', qty2: '46,500 ml', last: 'LAST MOVEMENT 26 MIN AGO', qtyColor: '#F2EFE2' },
        { name: 'Signature Rare', spec: 'Spirit · 750 ml bottle', qty: '48 bottles', qty2: '36,000 ml', last: 'LAST MOVEMENT 1 H AGO', qtyColor: '#F2EFE2' },
        { name: 'Smirnoff No.21', spec: 'Spirit · 750 ml bottle', qty: '32 bottles', qty2: '24,000 ml', last: 'LAST MOVEMENT 2 H AGO', qtyColor: '#F2EFE2' },
      ] },
      { name: 'MIXERS', total: '116 CONTAINERS', items: [
        { name: 'Coca-Cola', spec: 'Mixer · 300 ml bottle', qty: '4 cases', qty2: '96 bottles', last: 'LAST MOVEMENT 40 MIN AGO', qtyColor: '#F2EFE2' },
        { name: 'Tonic Water', spec: 'Mixer · 200 ml bottle', qty: '12 bottles', qty2: '2,400 ml', last: 'LAST MOVEMENT 2 H AGO', qtyColor: GOLD },
        { name: 'Soda', spec: 'Mixer · 300 ml bottle', qty: '8 bottles', qty2: '2,400 ml', last: 'LAST MOVEMENT 3 H AGO', qtyColor: RED },
      ] },
    ];
    const whGroups = allGroups
      .filter(g => s.whFilter === 'ALL' || g.name === s.whFilter)
      .map(g => ({ ...g, items: g.items.map(i => ({ ...i, onClick: () => go('sku') })) }));

    const barInv = [
      { name: 'Kingfisher Premium', qty: '12', unit: 'BOTTLES', color: RED, meta: 'RECEIVED 48 · WASTE 2 · RETURNED 0' },
      { name: 'Corona Extra', qty: '18', unit: 'BOTTLES', color: '#F2EFE2', meta: 'RECEIVED 24 · WASTE 0 · RETURNED 0' },
      { name: 'Bira 91 White', qty: '14', unit: 'CANS', color: '#F2EFE2', meta: 'RECEIVED 24 · WASTE 1 · RETURNED 0' },
      { name: 'Old Monk', qty: '14', unit: 'BOTTLES', color: '#F2EFE2', meta: 'RECEIVED 18 · WASTE 0 · RETURNED 0' },
      { name: 'Signature Rare', qty: '12', unit: 'BOTTLES', color: '#F2EFE2', meta: 'RECEIVED 12 · WASTE 0 · RETURNED 0' },
      { name: 'Coca-Cola', qty: '18', unit: 'BOTTLES', color: '#F2EFE2', meta: 'RECEIVED 24 · WASTE 0 · RETURNED 0' },
    ].map(i => ({ ...i, onClick: () => go('sku') }));

    const bottles = s.issueUnit === 'CASE' ? s.issueQty * 24 : s.issueQty;

    const countSkus = [
      { name: 'Kingfisher Premium', spec: 'Beer · 650 ml bottle', partial: false, partialUnit: 'OPEN BOTTLES', step: 1 },
      { name: 'Old Monk', spec: 'Spirit · 750 ml bottle · tare 480 g', partial: true, partialUnit: 'ML BY WEIGHT', step: 50 },
      { name: 'STOK Draught', spec: 'Beer · 30 L keg · line 2', partial: true, partialUnit: 'LITRES REMAINING', step: 1 },
    ];
    const countSku = countSkus[(s.countIdx - 1) % countSkus.length];

    const mvData = {
      d0184: { kind: 'TRANSFER · ACCEPTED', color: GREEN, title: 'DOCKET D-0184 ACCEPTED', detail: 'Warehouse → Bar 3 · 48 Kingfisher Premium',
        rows: [ { k: 'Movement ID', v: 'MV-11482', color: '#F2EFE2' }, { k: 'Type', v: 'ISSUE / ACCEPT', color: GREEN }, { k: 'Containers', v: '48 BOTTLES', color: '#F2EFE2' }, { k: 'Volume', v: '31,200 ML', color: '#F2EFE2' }, { k: 'Issued by', v: 'CHANDAN · 19:31', color: '#F2EFE2' }, { k: 'Accepted by', v: 'RAHUL · 19:38', color: '#F2EFE2' } ] },
      issue: { kind: 'ISSUE', color: '#F2EFE2', title: 'STOCK ISSUED', detail: 'Warehouse → Bar 3 · 48 Kingfisher Premium',
        rows: [ { k: 'Movement ID', v: 'MV-11479', color: '#F2EFE2' }, { k: 'Docket', v: 'D-0184', color: '#F2EFE2' }, { k: 'Containers', v: '48 BOTTLES', color: '#F2EFE2' }, { k: 'Warehouse after', v: '240 BOTTLES', color: '#F2EFE2' }, { k: 'Entered by', v: 'CHANDAN · 19:31', color: '#F2EFE2' } ] },
      waste: { kind: 'WASTE', color: RED, title: 'WASTE RECORDED', detail: 'Bar 2 · 2 Corona Extra · breakage',
        rows: [ { k: 'Movement ID', v: 'MV-11471', color: '#F2EFE2' }, { k: 'Containers', v: '2 BOTTLES', color: RED }, { k: 'Volume', v: '710 ML', color: '#F2EFE2' }, { k: 'Reason', v: 'BREAKAGE', color: '#F2EFE2' }, { k: 'Entered by', v: 'GABE · 19:22', color: '#F2EFE2' } ] },
      count: { kind: 'COUNT', color: '#F2EFE2', title: 'MID-COUNT STARTED', detail: 'Bar 1 · blind · 18 lines',
        rows: [ { k: 'Count ID', v: 'CT-0041', color: '#F2EFE2' }, { k: 'Type', v: 'MID-EVENT · BLIND', color: '#F2EFE2' }, { k: 'Counted by', v: 'CHANDAN · 19:18', color: '#F2EFE2' }, { k: 'Status', v: 'IN PROGRESS', color: GOLD } ] },
      adjust: { kind: 'ADJUSTMENT · AUDIT', color: RED, title: 'ADJUSTMENT +12 BUDWEISER', detail: 'Bar 4 · reason: incorrect issue entry',
        rows: [ { k: 'Movement ID', v: 'MV-11455', color: '#F2EFE2' }, { k: 'Signed delta', v: '+12 BOTTLES', color: RED }, { k: 'Reason', v: 'INCORRECT ISSUE ENTRY', color: '#F2EFE2' }, { k: 'Entered by', v: 'SALMAN · 18:52', color: '#F2EFE2' }, { k: 'Reverses', v: 'MV-11402', color: '#F2EFE2' }, { k: 'Audit flag', v: 'REVIEW NEXT MORNING', color: RED } ] },
    };
    const mv = mvData[s.mv] || mvData.d0184;
    const openMv = (k) => () => { this.setState({ mv: k }); go('mv'); };

    const allLedger = [
      { id: 'd0184', group: 'Transfers', at: '19:38', title: 'Docket D-0184 accepted', detail: 'Warehouse → Bar 3 · 48 Kingfisher', who: 'CHANDAN → RAHUL', color: GREEN, bg: 'transparent', flag: null },
      { id: 'issue', group: 'Transfers', at: '19:31', title: 'Stock issued', detail: 'Warehouse → Bar 3 · 48 Kingfisher', who: 'CHANDAN', color: 'rgba(166,201,180,0.4)', bg: 'transparent', flag: null },
      { id: 'waste', group: 'Waste', at: '19:22', title: 'Waste recorded', detail: 'Bar 2 · 2 Corona · breakage', who: 'GABE', color: RED, bg: 'transparent', flag: null },
      { id: 'count', group: 'Counts', at: '19:18', title: 'Mid-count started', detail: 'Bar 1 · blind · 18 lines', who: 'CHANDAN', color: 'rgba(166,201,180,0.4)', bg: 'transparent', flag: null },
      { id: 'adjust', group: 'Adjustments', at: '18:52', title: 'Adjustment', detail: 'Bar 4 · +12 Budweiser · reason: incorrect issue entry', who: 'SALMAN', color: RED, bg: 'rgba(255,74,61,0.06)', flag: 'AUDIT' },
    ];
    const ledger = allLedger
      .filter(m => s.filter === 'All' || m.group === s.filter)
      .map(m => ({ ...m, onClick: openMv(m.id) }));

    return {
      isHome: s.screen === 'home', isWarehouse: s.screen === 'warehouse', isBars: s.screen === 'bars', isBar: s.screen === 'bar',
      screenLabel: screenLabels[s.screen] || '',
      showNav: !fullScreens.includes(s.screen),
      toast: s.toast,
      back: this.back,
      liveDotColor: offline ? GOLD : GREEN,
      liveLabel: offline ? 'OFFLINE · 4 CHANGES PENDING' : 'LIVE · 19:44 IST',
      syncLabel: offline ? 'LAST SYNC 19:42' : 'LAST SYNCED 19:43',
      navHome: navColor('home'), navWarehouse: navColor('warehouse'), navBars: navColor('bars'),
      navActivity: navColor('activity'), navMore: navColor('more'),
      tabHome: () => this.tab('home'), tabWarehouse: () => this.tab('warehouse'), tabBars: () => this.tab('bars'),
      tabActivity: () => this.tab('activity'), tabMore: () => this.tab('more'),
      goCowork: () => go('cowork'), goIssue: () => go('issue'), goAccept: () => go('accept'),
      goWaste: () => go('waste'), goCount: () => go('count'),
      goReceive: () => flash('RECEIVE DELIVERY · NOT IN THIS FLOW'),
      goTopUp: () => flash('TOP-UP REQUESTED FROM WAREHOUSE'),
      alerts: [
        { level: 'CRITICAL', age: 'RUN-OUT ~20:10', title: 'Bar 3 · Kingfisher low', sub: 'Depleting 38 bottles/hr', metric: '12', metricUnit: 'LEFT', meter: '14%', meterNote: '26 MIN OF COVER', action: 'ISSUE', color: RED, tint: 'rgba(255,74,61,0.14)', onClick: () => go('issue') },
        { level: 'WARNING', age: 'OLDEST 18 MIN', title: 'Dockets awaiting acceptance', sub: 'D-0184 Warehouse → Bar 3', metric: '2', metricUnit: 'OPEN', meter: '60%', meterNote: '30 MIN SLA', action: 'OPEN', color: GOLD, tint: 'rgba(227,187,114,0.14)', onClick: () => go('accept') },
        { level: 'WARNING', age: 'DUE 19:30', title: 'Bar 2 mid-count overdue', sub: 'Last counted 15:10 · Gabe', metric: '22', metricUnit: 'MIN LATE', meter: '73%', meterNote: 'COUNT WINDOW CLOSES 20:30', action: 'COUNT', color: GOLD, tint: 'rgba(227,187,114,0.14)', onClick: () => go('count') },
      ],
      barCards: bars.map(b => ({ name: b.name, qty: String(b.qty), status: b.status, color: b.color, onClick: openBar(b) })),
      barRows: bars.map(b => ({ name: b.name, qty: String(b.qty), status: b.status, color: b.color, meta: b.meta, flag: b.flag, flagColor: b.flagColor, onClick: openBar(b) })),
      whFilters, whGroups, barInv,
      incomingOpen: s.incomingOpen,
      role, blind, offline,
      noop: () => {},

      isIssue: s.screen === 'issue', isReview: s.screen === 'review', isDocket: s.screen === 'docket',
      isSku: s.screen === 'sku', isAccept: s.screen === 'accept', isReceived: s.screen === 'received',
      isWaste: s.screen === 'waste', isCount: s.screen === 'count', isCountDone: s.screen === 'countDone',
      isVariance: s.screen === 'variance', isActivity: s.screen === 'activity', isMv: s.screen === 'mv',
      isReports: s.screen === 'reports', isRep: s.screen === 'rep',
      repList: _repList, settleCells: _settle, repPeriodLabel: _rp === 'EVENT' ? 'EVENT TO DATE' : _rp,
      repPeriods: ['DAY 1', 'DAY 2', 'EVENT'].map(p => ({
        label: p,
        color: _rp === p ? '#0D0D12' : 'rgba(166,201,180,0.8)',
        bg: _rp === p ? GREEN : 'transparent',
        border: _rp === p ? GREEN : 'rgba(166,201,180,0.24)',
        onClick: () => this.setState({ repPeriod: p }),
      })),
      repTitle: _rep.name, repBadge: _rep.badge,
      repMeta: _rp === 'EVENT' ? 'EVENT TO DATE · GENERATED 19:43 · LEDGER-DERIVED' : _rp + ' · GENERATED 19:43 · LEDGER-DERIVED',
      repColK: _rep.cols[0], repColA: _rep.cols[1], repColB: _rep.cols[2],
      repRows: _rep.rows.map(r => ({ k: r.k, a: r.a, b: r.b, color: r.color || 'rgba(166,201,180,0.72)' })),
      repNote: _rep.note,
      repExport: () => flash(_rep.badge + ' EXPORTED · ' + _rep.name),
      repShare: () => flash('SENT TO OPS · ' + _rep.name),
      isControl: s.screen === 'control', isCowork: s.screen === 'cowork', isMore: s.screen === 'more',

      issueTo: s.issueTo,
      issueToUpper: s.issueTo.toUpperCase(),
      issueQty: s.issueQty,
      issueUnitLabel: s.issueUnit === 'CASE' ? (s.issueQty === 1 ? 'CASE' : 'CASES') : 'BOTTLES',
      issueEquiv: s.issueUnit === 'CASE'
        ? s.issueQty + ' cases = ' + bottles + ' bottles'
        : bottles + ' bottles = ' + (bottles / 24).toFixed(2).replace(/\.00$/, '') + ' cases',
      unitTabs: ['CASE', 'BOTTLE'].map(u => ({
        label: u, onClick: () => this.setState({ issueUnit: u, issueQty: u === 'CASE' ? 2 : 48 }),
        color: s.issueUnit === u ? '#0D0D12' : 'rgba(166,201,180,0.8)',
        bg: s.issueUnit === u ? GREEN : 'transparent',
      })),
      qtyUp: () => this.setState(st => ({ issueQty: st.issueQty + (st.issueUnit === 'CASE' ? 1 : 6) })),
      qtyDown: () => this.setState(st => ({ issueQty: Math.max(st.issueUnit === 'CASE' ? 1 : 6, st.issueQty - (st.issueUnit === 'CASE' ? 1 : 6)) })),
      presets: (s.issueUnit === 'CASE' ? [1, 2, 4, 6] : [24, 48, 96, 144]).map(n => ({
        label: n + (s.issueUnit === 'CASE' ? ' CS' : ''),
        onClick: () => this.setState({ issueQty: n }),
        color: s.issueQty === n ? '#0D0D12' : 'rgba(166,201,180,0.8)',
        bg: s.issueQty === n ? GREEN : 'transparent',
        border: s.issueQty === n ? GREEN : 'rgba(166,201,180,0.22)',
      })),
      pickTo: () => { const l = ['Bar 1', 'Bar 2', 'Bar 3', 'Bar 4', 'Hospitality']; this.setState(st => ({ issueTo: l[(l.indexOf(st.issueTo) + 1) % l.length] })); },
      whAfter: '288 → ' + (288 - bottles) + ' bottles',
      goReview: () => go('review'),
      reviewQty: bottles,
      reviewCases: (bottles / 24).toFixed(2).replace(/\.00$/, '') + ' cases · 650 ml · ' + (bottles * 0.65).toFixed(1) + ' L',
      reviewRows: [
        { k: 'Product', v: 'KINGFISHER PREMIUM', color: '#F2EFE2' },
        { k: 'Quantity', v: bottles + ' BOTTLES', color: '#F2EFE2' },
        { k: 'Warehouse after issue', v: (288 - bottles) + ' BOTTLES', color: '#F2EFE2' },
        { k: 'Issued by', v: 'CHANDAN · 19:31', color: '#F2EFE2' },
        { k: 'Movement type', v: 'ISSUE', color: GREEN },
      ],
      createDocket: () => { this.setState({ docketMade: true }); go('docket'); },
      docketRows: [
        { k: 'Route', v: 'WAREHOUSE → ' + s.issueTo.toUpperCase(), color: '#F2EFE2' },
        { k: 'Items', v: bottles + ' × KINGFISHER', color: '#F2EFE2' },
        { k: 'Issued by', v: 'CHANDAN', color: '#F2EFE2' },
        { k: 'Issued at', v: '19:31', color: '#F2EFE2' },
        { k: 'Status', v: 'AWAITING ACCEPTANCE', color: GOLD },
      ],
      goAcceptFromDocket: () => go('accept'),
      doneToWarehouse: () => this.tab('warehouse'),

      skuLedger: [
        { at: '19:31', kind: 'ISSUE', route: 'Warehouse → Bar 3', by: 'Chandan · docket D-0184 · awaiting acceptance', delta: '−48', color: GOLD },
        { at: '19:12', kind: 'ISSUE', route: 'Warehouse → Bar 1', by: 'Chandan → Aditi · docket D-0181', delta: '−24', color: '#F2EFE2' },
        { at: '18:40', kind: 'RECEIPT', route: 'STOK → Warehouse', by: 'Invoice STK-2261 · 6 cases', delta: '+144', color: GREEN },
        { at: '18:22', kind: 'WASTE', route: 'Bar 2', by: 'Gabe · breakage', delta: '−2', color: RED },
        { at: '17:55', kind: 'ISSUE', route: 'Warehouse → Bar 2', by: 'Chandan → Gabe · docket D-0176', delta: '−48', color: '#F2EFE2' },
        { at: '16:30', kind: 'RECEIPT', route: 'STOK → Warehouse', by: 'Invoice STK-2248 · 12 cases', delta: '+288', color: GREEN },
      ],

      diffOpen: s.recvMode === 'diff',
      recvQty: s.recvQty,
      recvShort: (48 - s.recvQty) + ' BOTTLES',
      recvUp: () => this.setState(st => ({ recvQty: Math.min(48, st.recvQty + 1) })),
      recvDown: () => this.setState(st => ({ recvQty: Math.max(0, st.recvQty - 1) })),
      diffReasons: ['Short on pallet', 'Breakage in transit', 'Miscount at issue', 'Other'].map(r => ({
        label: r, onClick: () => this.setState({ recvReason: r }),
        color: s.recvReason === r ? '#0D0D12' : 'rgba(166,201,180,0.85)',
        bg: s.recvReason === r ? RED : 'transparent',
        border: s.recvReason === r ? RED : 'rgba(166,201,180,0.22)',
      })),
      acceptLabel: s.recvMode === 'diff' ? 'ACCEPT ' + s.recvQty + ' · REPORT SHORT ' + (48 - s.recvQty) : 'ACCEPT 48 BOTTLES',
      acceptBg: s.recvMode === 'diff' ? GOLD : GREEN,
      diffLabel: s.recvMode === 'diff' ? 'CANCEL DIFFERENCE' : 'REPORT DIFFERENCE',
      diffColor: s.recvMode === 'diff' ? 'rgba(166,201,180,0.8)' : RED,
      diffBorder: s.recvMode === 'diff' ? 'rgba(166,201,180,0.28)' : RED,
      toggleDiff: () => this.setState(st => ({ recvMode: st.recvMode === 'diff' ? 'accept' : 'diff', recvReason: null, recvQty: 46 })),
      acceptDocket: () => {
        if (s.recvMode === 'diff' && !s.recvReason) { flash('SELECT A REASON FIRST'); return; }
        this.setState({ incomingOpen: false });
        go('received');
      },
      receivedTitle: s.recvMode === 'diff' ? 'RECEIVED SHORT' : 'RECEIVED',
      receivedSub: s.recvMode === 'diff'
        ? 'Bar 3 credited with ' + s.recvQty + ' bottles. The shortfall is now an open discrepancy.'
        : 'Bar 3 credited with 48 bottles. Docket D-0184 closed.',
      receiptRows: [
        { k: 'Docket', v: 'D-0184', color: '#F2EFE2' },
        { k: 'Expected', v: '48 BOTTLES', color: '#F2EFE2' },
        { k: 'Accepted', v: (s.recvMode === 'diff' ? s.recvQty : 48) + ' BOTTLES', color: s.recvMode === 'diff' ? RED : GREEN },
        { k: 'Difference', v: s.recvMode === 'diff' ? '−' + (48 - s.recvQty) + ' · ' + (s.recvReason || '') : 'NONE', color: s.recvMode === 'diff' ? RED : '#F2EFE2' },
        { k: 'Issued by', v: 'CHANDAN · 19:31', color: '#F2EFE2' },
        { k: 'Accepted by', v: 'RAHUL · 19:38', color: '#F2EFE2' },
      ],
      doneToBar: () => this.setState({ screen: 'bar', stack: ['home'] }),

      wasteQty: s.wasteQty,
      wasteUp: () => this.setState(st => ({ wasteQty: st.wasteQty + 1 })),
      wasteDown: () => this.setState(st => ({ wasteQty: Math.max(1, st.wasteQty - 1) })),
      wasteReasons: ['Breakage', 'Spillage', 'Foam / line loss', 'Refused pour', 'Other'].map(r => ({
        label: r, onClick: () => this.setState({ wasteReason: r }),
        color: s.wasteReason === r ? '#0D0D12' : 'rgba(166,201,180,0.85)',
        bg: s.wasteReason === r ? RED : 'transparent',
        border: s.wasteReason === r ? RED : 'rgba(166,201,180,0.22)',
      })),
      wasteCta: 'RECORD ' + s.wasteQty + ' AS WASTE',
      recordWaste: () => { this.setState({ screen: 'bar', stack: ['home'] }); flash(s.wasteQty + ' KINGFISHER RECORDED · ' + s.wasteReason.toUpperCase()); },

      countProgress: s.countIdx + ' OF 18',
      countPct: Math.round((s.countIdx / 18) * 100) + '%',
      countSkuName: countSku.name,
      countSkuSpec: countSku.spec,
      countFull: s.countFull,
      countPartial: s.countPartial,
      countPresets: [0, 6, 12, 24].map(n => ({ label: String(n), onClick: () => this.setState({ countFull: n }) })),
      fullUp: () => this.setState(st => ({ countFull: st.countFull + 1 })),
      fullDown: () => this.setState(st => ({ countFull: Math.max(0, st.countFull - 1) })),
      partialShow: countSku.partial,
      partialLabel: 'PARTIAL / OPEN CONTAINER',
      partialHint: countSku.partialUnit === 'ML BY WEIGHT' ? 'WEIGH · TARE 480 G' : 'FLOW METER · LINE 2',
      partialUnit: countSku.partialUnit,
      partialUp: () => this.setState(st => ({ countPartial: st.countPartial + countSku.step })),
      partialDown: () => this.setState(st => ({ countPartial: Math.max(0, st.countPartial - countSku.step) })),
      blindNote: blind
        ? 'Blind count. Expected stock, previous counts and variance stay hidden until a manager opens the variance screen.'
        : 'BLIND MODE OFF · expected 42 shown. Never ship this state — the counter will type the expected figure.',
      countCta: s.countIdx >= 18 ? 'SUBMIT COUNT' : 'SAVE & NEXT',
      saveNext: () => {
        if (s.countIdx >= 18) { go('countDone'); return; }
        this.setState(st => ({ countIdx: st.countIdx + 1, countFull: 0, countPartial: 0 }));
        flash('SAVED · ' + countSku.name.toUpperCase());
      },
      countDoneRows: [
        { k: 'Location', v: 'BAR 3', color: '#F2EFE2' },
        { k: 'Count type', v: 'MID-EVENT · BLIND', color: '#F2EFE2' },
        { k: 'Counted by', v: 'RAHUL', color: '#F2EFE2' },
        { k: 'Witnessed by', v: 'CHANDAN', color: '#F2EFE2' },
        { k: 'Lines', v: '18 OF 18', color: GREEN },
      ],
      varianceCta: role === 'Manager' ? 'OPEN VARIANCE' : 'VARIANCE · MANAGER ONLY',
      openVariance: () => { if (role === 'Manager') go('variance'); else flash('MANAGER ACCESS REQUIRED'); },
      varianceRows: [
        { name: 'STOK Draught', expected: '96 L', counted: '84 L', delta: '−12 L', pct: '−12.5%', color: GOLD, note: 'Draught band 8–15% · line purge and foam across two lines', noteColor: 'rgba(166,201,180,0.6)' },
        { name: 'Old Monk', expected: '11,400 ml', counted: '10,620 ml', delta: '−780 ml', pct: '−6.4%', color: GOLD, note: 'Consistent all evening — overpour pattern, not a step change', noteColor: 'rgba(166,201,180,0.6)' },
        { name: 'Corona Extra', expected: '16', counted: '19', delta: '+3', pct: '+2.4%', color: GOLD, note: 'Positive — check for a missed receipt or a wrong-SKU ring-up', noteColor: GOLD },
        { name: 'Kingfisher', expected: '42', counted: '40', delta: '−2', pct: '−1.8%', color: GOLD, note: 'Bottled beer band 1–3% · watch, no action', noteColor: 'rgba(166,201,180,0.6)' },
        { name: 'Coca-Cola', expected: '22', counted: '21', delta: '−1', pct: '−0.9%', color: GREEN, note: 'Within tolerance', noteColor: 'rgba(166,201,180,0.6)' },
      ],

      filters: ['All', 'Transfers', 'Counts', 'Waste', 'Adjustments'].map(f => ({
        label: f.toUpperCase(), onClick: () => this.setState({ filter: f }),
        color: s.filter === f ? '#0D0D12' : 'rgba(166,201,180,0.8)',
        bg: s.filter === f ? GREEN : 'transparent',
        border: s.filter === f ? GREEN : 'rgba(166,201,180,0.22)',
      })),
      ledger,
      mvKind: mv.kind, mvColor: mv.color, mvTitle: mv.title, mvDetail: mv.detail, mvRows: mv.rows,
      proposeAdjust: () => flash('ADJUSTMENT REQUIRES MANAGER SIGN-OFF'),

      controlStats: [
        { k: 'TOTAL STOCK', v: '1,284', color: '#F2EFE2' },
        { k: 'OPEN DOCKETS', v: '2', color: GOLD },
        { k: 'BARS NEEDING ATTENTION', v: '1', color: RED },
        { k: 'LAST SYNC', v: '2m', color: '#F2EFE2' },
      ],
      coworkPrompts: ["What's running low?", 'Show open dockets', 'Show Bar 3 stock', 'Show discrepancies', 'Prepare a stock transfer']
        .map(p => ({ label: p, onClick: () => flash('COWORK · ' + p.toUpperCase()) })),
      confirmTransfer: () => { go('docket'); flash('DOCKET D-0184 CREATED'); },

      roleLabel: role.toUpperCase(),
      moreItems: [
        { label: 'CONTROL', sub: 'Live board · run-out projections · open dockets', color: '#F2EFE2', onClick: () => { if (role === 'Manager') go('control'); else flash('MANAGER ACCESS REQUIRED'); } },
        { label: 'COUNTS', sub: 'Opening · mid-event · close-out, per location', color: '#F2EFE2', onClick: () => go('count') },
        { label: 'VARIANCE', sub: 'Counted vs theoretical · tolerance bands', color: '#F2EFE2', onClick: () => { if (role === 'Manager') go('variance'); else flash('MANAGER ACCESS REQUIRED'); } },
        { label: 'REPORTS', sub: 'Excise return · stock settlement · sales per hour', color: '#F2EFE2', onClick: () => go('reports') },
        { label: 'COWORK', sub: 'Inventory assistant', color: '#F2EFE2', onClick: () => go('cowork') },
        { label: 'SETTINGS', sub: 'Device · sync · printed fallback sheets', color: '#F2EFE2', onClick: () => flash('SETTINGS') },
      ],
      syncBadge: offline ? '○ OFFLINE' : '✓ SYNCED',
      syncCopy: offline
        ? '4 actions queued on this device. They are recorded locally and will post in order when the network returns. Nothing is lost.'
        : 'All movements posted. Last sync 19:43. The device keeps a local copy of the SKU list and this bar’s ledger.',
    };
  }
}
</script>



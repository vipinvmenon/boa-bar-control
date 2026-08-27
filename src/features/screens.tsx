import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Chip, Panel, RitualButton, SectionLabel, StatusDot, Stepper } from '../components/ui'
import { useDemoStore } from '../lib/demo-store'
import { useAuth } from '../lib/auth'

const bars = [
  { name: 'Bar 1', stock: 182, status: 'Healthy', detail: 'Lead: Aditi · counted 17:40', tone: 'green' as const },
  { name: 'Bar 2', stock: 140, status: 'Count due', detail: 'Lead: Gabe · counted 15:10', note: 'Mid-count overdue', tone: 'gold' as const },
  { name: 'Bar 3', stock: 108, status: 'Low stock', detail: 'Lead: Chandan · counted 17:55', note: '1 docket incoming', tone: 'red' as const },
  { name: 'Bar 4', stock: 90, status: 'Healthy', detail: 'Lead: Rahul · counted 17:32', tone: 'green' as const },
]

const warehouseCatalog = [
  { id: 'kf', category: 'BEER', name: 'Kingfisher Premium', detail: 'Beer · 650 ml bottle', movement: 'Last movement 12 min ago', primary: '12 cases', secondary: '288 bottles' },
  { id: 'corona', category: 'BEER', name: 'Corona Extra', detail: 'Beer · 355 ml bottle', movement: 'Last movement 1 h ago', primary: '2 cases', secondary: '48 bottles' },
  { id: 'bira', category: 'BEER', name: 'Bira 91 White', detail: 'Beer · 330 ml can', movement: 'Last movement 2 h ago', primary: '1.5 cases', secondary: '36 cans' },
  { id: 'stok', category: 'BEER', name: 'STOK Draught', detail: 'Beer · 30 L keg', movement: 'Last movement 34 min ago', primary: '8 kegs', secondary: '240 L', tone: 'gold' },
  { id: 'monk', category: 'SPIRITS', name: 'Old Monk', detail: 'Spirit · 750 ml bottle', movement: 'Last movement 26 min ago', primary: '62 bottles', secondary: '46,500 ml' },
  { id: 'signature', category: 'SPIRITS', name: 'Signature Rare', detail: 'Spirit · 750 ml bottle', movement: 'Last movement 1 h ago', primary: '48 bottles', secondary: '36,000 ml' },
  { id: 'smirnoff', category: 'SPIRITS', name: 'Smirnoff No.21', detail: 'Spirit · 750 ml bottle', movement: 'Last movement 2 h ago', primary: '32 bottles', secondary: '24,000 ml' },
  { id: 'coke', category: 'MIXERS', name: 'Coca-Cola', detail: 'Mixer · 300 ml bottle', movement: 'Last movement 40 min ago', primary: '4 cases', secondary: '96 bottles' },
  { id: 'tonic', category: 'MIXERS', name: 'Tonic Water', detail: 'Mixer · 200 ml bottle', movement: 'Last movement 2 h ago', primary: '12 bottles', secondary: '2,400 ml' },
  { id: 'soda', category: 'MIXERS', name: 'Soda', detail: 'Mixer · 300 ml bottle', movement: 'Last movement 3 h ago', primary: '8 bottles', secondary: '2,400 ml' },
]

const warehouseTotals = { BEER: 380, SPIRITS: 142, MIXERS: 116 } as const

function BackTitle({ children }: { children: string }) {
  return (
    <div className="flow-title">
      <Link to="/" aria-label="Back to home"><ArrowLeft size={21} /></Link>
      <h1>{children}</h1>
    </div>
  )
}

function Metric({ value, label, tone = 'bone' }: { value: string | number; label: string; tone?: string }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>
}

export function HomeScreen() {
  const store = useDemoStore()
  return (
    <div className="screen home-screen">
      <Panel className="hero-stock">
        <div className="hero-total"><div><span>Total stock</span><p><strong>1,284</strong><small>containers</small></p></div><time>As of<br />19:43</time></div>
        <div className="hero-breakdown"><Metric value="638" label="Warehouse" /><Metric value="520" label="Bars" /><Metric value="126" label="Hospitality" /></div>
      </Panel>

      <SectionLabel action={<span className="attention-count">3</span>}>Needs attention</SectionLabel>
      <div className="alert-stack">
        <Link className="alert-card alert-detail red" to="/issue">
          <div className="alert-top"><b>● Critical</b><span>Run-out ~20:10</span></div>
          <div className="alert-middle"><div><strong>Bar 3 · Kingfisher low</strong><span>Depleting 38 bottles/hr</span></div><em>12<small>left</small></em></div>
          <i className="alert-progress"><u style={{ width: '14%' }} /></i>
          <div className="alert-bottom"><span>26 min of cover</span><b>Issue <ArrowRight size={14} /></b></div>
        </Link>
        <button className="alert-card alert-detail gold" onClick={() => store.flash('DOCKET WATCH ACTIVE · WAREHOUSE NOTIFIED')}>
          <div className="alert-top"><b>● Warning</b><span>Oldest 18 min</span></div>
          <div className="alert-middle"><div><strong>Dockets awaiting acceptance</strong><span>D-0184 Warehouse → Bar 3</span></div><em>2<small>open</small></em></div>
          <i className="alert-progress"><u style={{ width: '61%' }} /></i>
          <div className="alert-bottom"><span>30 min SLA</span><b>Open <ArrowRight size={14} /></b></div>
        </button>
        <Link className="alert-card alert-detail gold" to="/count">
          <div className="alert-top"><b>● Warning</b><span>Due 19:30</span></div>
          <div className="alert-middle"><div><strong>Bar 2 mid-count overdue</strong><span>Last counted 15:10 · Gabe</span></div><em>22<small>min late</small></em></div>
          <i className="alert-progress"><u style={{ width: '73%' }} /></i>
          <div className="alert-bottom"><span>Count window closes 20:30</span><b>Count <ArrowRight size={14} /></b></div>
        </Link>
      </div>

      <SectionLabel action={<Link to="/bars">All bars</Link>}>Bar status</SectionLabel>
      <div className="bar-grid">
        {bars.map((bar) => (
          <Link to="/bars" className="bar-card" key={bar.name}>
            <span><StatusDot tone={bar.tone} />{bar.name}</span>
            <strong>{bar.stock}</strong>
            <small>{bar.status}</small>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function WarehouseScreen() {
  const store = useDemoStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'BEER' | 'SPIRITS'>('ALL')
  const visibleCatalog = warehouseCatalog.filter((item) => {
    const matchesFilter = filter === 'ALL' || item.category === filter
    const matchesQuery = `${item.name} ${item.detail}`.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  })
  const categories = ['BEER', 'SPIRITS', 'MIXERS'] as const
  return (
    <div className="screen warehouse-screen">
      <div className="section-page-title"><h1>Warehouse</h1><span>As of 19:43</span></div>
      <div className="warehouse-summary">
        {categories.map((category) => <Metric key={category} value={warehouseTotals[category]} label={category} />)}
      </div>
      <div className="warehouse-actions">
        <button onClick={() => store.flash('RECEIPT CAPTURE READY')}>Receive stock</button>
        <Link to="/issue">Issue to bar</Link>
      </div>
      <div className="warehouse-tools">
        <label><Search size={14} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU" aria-label="Search SKU" /></label>
        <div className="warehouse-filters" aria-label="Inventory category">
          {(['ALL', 'BEER', 'SPIRITS'] as const).map((value) => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{value}</button>)}
        </div>
      </div>
      <div className="warehouse-catalog">
        {categories.map((category) => {
          const rows = visibleCatalog.filter((item) => item.category === category)
          if (!rows.length) return null
          return <section className="inventory-section" key={category}>
            <div className="inventory-section-title"><span>{category}</span><strong>{warehouseTotals[category]} containers</strong></div>
            {rows.map((item) => <button className="inventory-product" key={item.id} onClick={() => store.flash(`${item.name.toUpperCase()} · STOCK DETAIL`)}>
              <div><strong>{item.name}</strong><span>{item.detail}</span><small>{item.movement}</small></div>
              <div><strong className={item.tone === 'gold' ? 'gold' : ''}>{item.primary}</strong><span>{item.secondary}</span></div>
              <ChevronRight size={15} aria-hidden="true" />
            </button>)}
          </section>
        })}
        {!visibleCatalog.length && <Panel className="empty-stock">No matching stock item.</Panel>}
      </div>
    </div>
  )
}

export function BarsScreen() {
  return (
    <div className="screen">
      <p className="eyebrow">Live floor</p><h1>Bars</h1>
      <div className="location-list">
        {bars.map((bar, index) => (
          <Panel className="location-card" key={bar.name}>
            <div className="location-heading"><div><span><StatusDot tone={bar.tone} />{bar.name}</span><small>{bar.status}</small></div><strong>{bar.stock}</strong></div>
            <div className="mini-bars"><i style={{ width: `${74 - index * 9}%` }} /><i style={{ width: `${48 + index * 7}%` }} /><i style={{ width: `${35 + index * 4}%` }} /></div>
            {index === 2 && <div className="inline-actions"><Link to="/waste">Record waste</Link><Link to="/count">Blind count</Link></div>}
          </Panel>
        ))}
      </div>
    </div>
  )
}

export function ActivityScreen() {
  const store = useDemoStore()
  const [filter, setFilter] = useState('ALL')
  const rows = filter === 'ALL' ? store.activity : store.activity.filter((item) => item.kind === filter)
  return (
    <div className="screen">
      <p className="eyebrow">Append-only audit trail</p><h1>Activity</h1>
      <div className="chips"><Chip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>All</Chip><Chip active={filter === 'TRANSFER'} onClick={() => setFilter('TRANSFER')}>Transfers</Chip><Chip active={filter === 'WASTE'} tone="red" onClick={() => setFilter('WASTE')}>Waste</Chip></div>
      <div className="timeline">
        {rows.map((item) => <article key={item.id} className={`timeline-row ${item.tone}`}><time>{item.at}</time><div><span>{item.kind}</span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.actor}</small></div></article>)}
      </div>
    </div>
  )
}

export function MoreScreen() {
  const store = useDemoStore()
  const auth = useAuth()
  return (
    <div className="screen">
      <p className="eyebrow">Controls & settlement</p><h1>More</h1>
      <Panel className="profile-panel"><div><strong>{store.role === 'Manager' ? 'Salman U. Syed' : 'Rahul · Bar 3'}</strong><span>{store.role} · BOA 2026</span></div><ShieldCheck /></Panel>
      <div className="menu-list">
        <Link to="/count"><ClipboardCheck /><span>Blind counts<small>Opening, mid-event, close-out</small></span><ChevronRight /></Link>
        <Link to="/reports"><BarChart3 /><span>Variance & reports<small>Manager review and sign-off</small></span><ChevronRight /></Link>
        <Link to="/waste"><TriangleAlert /><span>Record waste<small>Breakage, spill, quality</small></span><ChevronRight /></Link>
      </div>
      <SectionLabel>{auth.mode === 'live' ? 'Live session' : 'Demo controls'}</SectionLabel>
      <Panel className="demo-controls">{auth.mode === 'live' ? <><label>Venue<button disabled>{auth.activeMembership?.venueCode}</button></label><label>Access role<button disabled>{auth.activeMembership?.role}</button></label></> : <><label>Access view<button onClick={() => store.setRole(store.role === 'Manager' ? 'Crew' : 'Manager')}>{store.role}</button></label><label>Connection<button onClick={() => store.setOffline(!store.offline)}>{store.offline ? 'Offline' : 'Online'}</button></label></>}</Panel>
      {auth.mode === 'live' && <RitualButton wide tone="ghost" onClick={() => void auth.signOut()}>Sign out securely</RitualButton>}
    </div>
  )
}

export function IssueScreen() {
  const store = useDemoStore()
  const navigate = useNavigate()
  const [destination, setDestination] = useState('Bar 3')
  const [skuId, setSkuId] = useState(() => store.stock[0]?.id ?? '')
  const [quantity, setQuantity] = useState(24)
  const selectedSkuId = store.stock.some((candidate) => candidate.id === skuId) ? skuId : store.stock[0]?.id ?? ''
  const item = store.stock.find((candidate) => candidate.id === selectedSkuId)
  const submit = () => {
    if (!item) return
    const docket = store.issue({ to: destination, skuId: selectedSkuId, quantity })
    void navigate({ to: '/dockets/$docketId', params: { docketId: docket.id } })
  }
  return (
    <div className="screen flow-screen">
      <BackTitle>Issue stock</BackTitle>
      <p className="step-label">1 / 3 · Destination</p>
      <div className="chips wrap">{bars.map((bar) => <Chip key={bar.name} active={destination === bar.name} onClick={() => setDestination(bar.name)}>{bar.name.split(' · ')[0]}</Chip>)}</div>
      <p className="step-label">2 / 3 · SKU</p>
      <div className="select-list">{store.stock.slice(0, 4).map((candidate) => <button key={candidate.id} className={selectedSkuId === candidate.id ? 'selected' : ''} onClick={() => setSkuId(candidate.id)}><span>{candidate.name}<small>{candidate.container}</small></span><strong>{candidate.warehouse}</strong></button>)}</div>
      <p className="step-label">3 / 3 · Quantity</p>
      <Panel className="quantity-panel"><span>{item?.name ?? 'No active SKU'}</span><Stepper label="issue quantity" value={quantity} min={1} onChange={setQuantity} /><div className="presets">{[12, 24, 48].map((value) => <button key={value} onClick={() => setQuantity(value)}>+{value}</button>)}</div></Panel>
      <Panel className="review-card"><span>Warehouse <ArrowRight size={15} /> {destination}</span><strong>{quantity} × {item?.name ?? 'No active SKU'}</strong><small>{item ? quantity * item.mlPerContainer / 1000 : 0} L total · issued by Chandan</small></Panel>
      <RitualButton wide onClick={submit} disabled={quantity < 1 || !item}>Create QR docket</RitualButton>
    </div>
  )
}

export function DocketScreen() {
  const { docketId } = useParams({ from: '/dockets/$docketId' })
  const store = useDemoStore()
  const docket = store.dockets.find((candidate) => candidate.id === docketId)
  const [received, setReceived] = useState(docket?.quantity ?? 0)
  const [reason, setReason] = useState('Short received')
  const [confirmed, setConfirmed] = useState(false)
  const item = store.stock.find((candidate) => candidate.id === docket?.skuId)
  if (!docket) return <div className="screen flow-screen"><BackTitle>Docket</BackTitle><Panel>Docket not found. Create an issue first.</Panel></div>
  const accepted = confirmed || docket.status !== 'awaiting'
  const acceptDocket = () => {
    store.accept({ docketId, quantity: received, reason: received === docket.quantity ? undefined : reason })
    setConfirmed(true)
  }
  return (
    <div className="screen flow-screen docket-screen">
      <BackTitle>{docket.id}</BackTitle>
      <Panel className={`docket-status ${accepted ? 'accepted' : ''}`}><StatusDot tone={accepted ? 'green' : 'gold'} /><div><strong>{accepted ? 'Accepted' : 'Awaiting acceptance'}</strong><span>{docket.from} → {docket.to}</span></div></Panel>
      <div className="qr-wrap"><QRCodeSVG value={`https://bar.bangaloreopenair.com/d/${docket.token}`} size={164} bgColor="#F2EFE2" fgColor="#0D0D12" level="M" /><small>Scan at receiving bar</small></div>
      <Panel className="docket-lines"><div><span>Item</span><strong>{item?.name}</strong></div><div><span>Issued</span><strong>{docket.quantity} containers</strong></div><div><span>Issued by</span><strong>{docket.issuedBy} · {docket.issuedAt}</strong></div></Panel>
      {!accepted ? <>
        <p className="step-label">Receiver check</p>
        <Stepper label="received quantity" value={received} onChange={setReceived} />
        {received !== docket.quantity && <div className="difference"><label htmlFor="difference-reason">Difference reason</label><select id="difference-reason" value={reason} onChange={(event) => setReason(event.target.value)}><option>Short received</option><option>Damaged in transit</option><option>Counting error</option></select></div>}
        <RitualButton wide tone={received === docket.quantity ? 'green' : 'gold'} onClick={acceptDocket}>Accept {received} received</RitualButton>
      </> : <Panel className="success-panel"><Check /><div><strong>Chain of custody complete</strong><span>{docket.acceptedBy ?? 'Rahul'} accepted {docket.acceptedQuantity ?? received} at {docket.acceptedAt ?? 'now'}</span></div></Panel>}
    </div>
  )
}

export function WasteScreen() {
  const store = useDemoStore()
  const navigate = useNavigate()
  const [skuId, setSkuId] = useState(() => store.stock.find((item) => item.id === 'corona')?.id ?? store.stock[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('Breakage')
  const selectedSkuId = store.stock.some((candidate) => candidate.id === skuId) ? skuId : store.stock[0]?.id ?? ''
  const item = store.stock.find((candidate) => candidate.id === selectedSkuId)
  const submit = () => { if (!item) return; store.waste({ skuId: selectedSkuId, quantity, reason }); void navigate({ to: '/bars' }) }
  return (
    <div className="screen flow-screen">
      <BackTitle>Record waste</BackTitle>
      <p className="helper">Fast capture for Bar 3. This writes a signed ledger movement.</p>
      <p className="step-label">Item</p>
      <div className="select-list compact">{store.stock.slice(0, 5).map((candidate) => <button key={candidate.id} className={selectedSkuId === candidate.id ? 'selected' : ''} onClick={() => setSkuId(candidate.id)}><span>{candidate.name}<small>{candidate.bar3} at Bar 3</small></span></button>)}</div>
      <p className="step-label">Quantity</p><Panel className="quantity-panel"><span>{item?.name ?? 'No active SKU'}</span><Stepper label="waste quantity" value={quantity} min={1} onChange={setQuantity} /></Panel>
      <p className="step-label">Reason</p><div className="chips wrap">{['Breakage', 'Spill', 'Quality', 'Other'].map((value) => <Chip tone="red" key={value} active={reason === value} onClick={() => setReason(value)}>{value}</Chip>)}</div>
      <RitualButton tone="red" wide onClick={submit} disabled={!item}>Record {quantity} as waste</RitualButton>
    </div>
  )
}

export function CountScreen() {
  const store = useDemoStore()
  const countItems = useMemo(() => store.stock.slice(0, 3), [store.stock])
  // BAR-151. These inputs were seeded with { kf: 11, bud: 36, corona: 19 } —
  // two of the three exact expected figures from the store, the third one below.
  // Specification §6: "If the app shows 'expected 47' next to the input box, you
  // will get 47 every time and the count is worthless." Count inputs start
  // empty, always. Never seed this state.
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="screen flow-screen">
      <BackTitle>Blind count</BackTitle>
      <Panel className="blind-banner"><ShieldCheck /><div><strong>Expected stock is hidden</strong><span>Bar 3 · mid-event · 3 lines</span></div></Panel>
      <div className="count-list">{countItems.map((item) => <Panel key={item.id} className="count-row"><div><strong>{item.name}</strong><span>{item.container}</span></div><Stepper label={`${item.name} count`} value={counts[item.id] ?? 0} onChange={(value) => setCounts((current) => ({ ...current, [item.id]: value }))} /></Panel>)}</div>
      {/*
        BAR-151/BAR-152. The manager reveal previously hardcoded −1 / 0 / 0 to
        match the pre-filled counts. Variance must be derived from the ledger
        (BAR-086/BAR-087) and sealed server-side at submit (BAR-084). Until that
        exists, say so rather than showing an invented figure.
      */}
      {submitted
        ? store.role === 'Manager'
          ? <Panel className="variance-preview"><strong>Manager review</strong><small>Variance is derived from the ledger and is not yet available — see BAR-086. No figure is shown rather than an invented one.</small></Panel>
          : <Panel className="success-panel"><Check /><div><strong>Count submitted</strong><span>Variance remains hidden until manager review.</span></div></Panel>
        : <RitualButton wide onClick={() => setSubmitted(true)}>Submit blind count</RitualButton>}
    </div>
  )
}

export function ReportsScreen() {
  const store = useDemoStore()
  if (store.role !== 'Manager') return <div className="screen"><p className="eyebrow">Restricted</p><h1>Reports</h1><Panel className="blind-banner"><ShieldCheck /><div><strong>Manager access required</strong><span>Settlement and currency values are protected.</span></div></Panel></div>
  return (
    <div className="screen">
      <p className="eyebrow">Manager settlement</p><h1>Variance</h1>
      {/*
        BAR-152. This screen previously displayed −2.1% overall, ₹18.4K at risk,
        94% mapped POS, and four category variances — none of which any code
        computed, and none of which appear in the approved design. Variance
        requires the ledger views (BAR-014), a real count (BAR-082) and POS
        ingest (BAR-094). An empty state is honest; an invented figure that a
        manager might act on, or defend to STOK or excise, is not.

        This whole screen is replaced by the design's `reports` and `rep` screens
        in BAR-107/BAR-108 — it is not the approved design.
      */}
      <Panel className="method-note">
        <strong>Not yet available</strong>
        <span>
          Variance is derived from the movement ledger and cannot be computed until the
          ledger views, count persistence and POS ingest exist. No figure is shown here
          rather than an estimated one.
        </span>
      </Panel>
      <Panel className="method-note"><strong>How variance will be calculated</strong><span>Counted closing − (opening + in − out − sold − comped − wasted), divided by sold + comped + wasted. Banding is signed: positive variance is reviewed, never graded green.</span></Panel>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Chip, Panel, RitualButton, StatusDot, Stepper } from '../components/ui'
import { useDemoStore } from '../lib/demo-store'
import { useRepositoryQuery } from '../data/RepositoryProvider'


function BackTitle({ children }: { children: string }) {
  return (
    <div className="flow-title">
      <Link to="/" aria-label="Back to home"><ArrowLeft size={21} /></Link>
      <h1>{children}</h1>
    </div>
  )
}

export function IssueScreen() {
  const store = useDemoStore()
  const navigate = useNavigate()
  // BAR-051 rebuilds this screen properly. Until then read destinations from the
  // repository rather than a hardcoded const, so ADR-010 holds meanwhile.
  const barsQuery = useRepositoryQuery(['bars'], (r) => r.listBars())
  const destinations = barsQuery.data ?? []
  const [destination, setDestination] = useState('BAR 3')
  const [skuId, setSkuId] = useState(() => store.stock[0]?.id ?? '')
  const [quantity, setQuantity] = useState(24)
  const selectedSkuId = store.stock.some((candidate) => candidate.id === skuId) ? skuId : store.stock[0]?.id ?? ''
  const item = store.stock.find((candidate) => candidate.id === selectedSkuId)
  // BAR-052: the design requires a review step before a docket exists. The old
  // flow created one straight from the quantity picker.
  const submit = () => {
    if (!item) return
    void navigate({ to: '/issue/review', search: { qty: quantity } })
  }
  return (
    <div className="screen flow-screen">
      <BackTitle>Issue stock</BackTitle>
      <p className="step-label">1 / 3 · Destination</p>
      <div className="chips wrap">{destinations.map((bar) => <Chip key={bar.id} active={destination === bar.name} onClick={() => setDestination(bar.name)}>{bar.name}</Chip>)}</div>
      <p className="step-label">2 / 3 · SKU</p>
      <div className="select-list">{store.stock.slice(0, 4).map((candidate) => <button key={candidate.id} className={selectedSkuId === candidate.id ? 'selected' : ''} onClick={() => setSkuId(candidate.id)}><span>{candidate.name}<small>{candidate.container}</small></span><strong>{candidate.warehouse}</strong></button>)}</div>
      <p className="step-label">3 / 3 · Quantity</p>
      <Panel className="quantity-panel"><span>{item?.name ?? 'No active SKU'}</span><Stepper label="issue quantity" value={quantity} min={1} onChange={setQuantity} /><div className="presets">{[12, 24, 48].map((value) => <button key={value} onClick={() => setQuantity(value)}>+{value}</button>)}</div></Panel>
      <Panel className="review-card"><span>Warehouse <ArrowRight size={15} /> {destination}</span><strong>{quantity} × {item?.name ?? 'No active SKU'}</strong><small>{item ? quantity * item.mlPerContainer / 1000 : 0} L total · issued by Chandan</small></Panel>
      <RitualButton wide onClick={submit} disabled={quantity < 1 || !item}>Review issue</RitualButton>
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

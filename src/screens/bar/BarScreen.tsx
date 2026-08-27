/**
 * BAR-061 — the bar workspace. NOT YET BUILT.
 *
 * Specification §14 calls this "the one that has to be excellent, because it is
 * used by temporary staff, one-handed, in the dark, at speed". Its reference
 * capture is references/ui/bar.png, and the design's composition is the
 * `isBar` branch of references/design-source/design-markup.html:220-300:
 * a per-bar header with a live dot, a three-cell category grid, a gold INCOMING
 * STOCK sheet with REVIEW & ACCEPT, a TOP-UP / WASTE / COUNT action row, and a
 * ledger-derived inventory list with per-SKU RECEIVED / WASTE / RETURNED meta.
 *
 * This placeholder exists so the bars list is not a dead end. It states what is
 * missing rather than showing an empty screen, because a silent dead end is what
 * the bars screen previously offered.
 */
export function BarScreen() {
  return (
    <div className="section-screen">
      <header className="section-head">
        <h1 className="section-head-title">Bar</h1>
        <span className="section-head-asof">BAR-061</span>
      </header>
      <div className="section-body">
        <p className="section-empty">
          The bar workspace is not built yet. It is the next screen: the incoming-docket
          sheet, the top-up / waste / count actions, and a ledger-derived inventory list.
          Its reference capture is <code>references/ui/bar.png</code>.
        </p>
      </div>
    </div>
  )
}

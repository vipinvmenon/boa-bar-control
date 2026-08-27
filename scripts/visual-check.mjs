/**
 * BAR-008 — the design-fidelity gate.
 *
 * Two independent checks per screen:
 *
 * 1. DERIVATION. Render the screen against two different fixture sets. If both
 *    renders are byte-identical, the screen is not reading the data layer — it
 *    is displaying literals. This is the check that matters most, because the
 *    previous QA gate was a single screenshot comparison and the cheapest way to
 *    pass one of those is to hardcode the screenshot's values. That is exactly
 *    what happened to `home` and `warehouse`, and both were then certified as
 *    passing. A two-state comparison cannot be satisfied by hardcoding.
 *
 * 2. COVERAGE. Report which of the design's 22 screens have a route at all, so
 *    an 11-screen shortfall cannot sit unrecorded for five weeks again.
 *
 * Pixel-diffing the implementation against references/ui/ is deliberately NOT
 * done yet: 11 screens do not exist and 11 more are being rewritten, so every
 * diff would be ~100% and the number would carry no information. It becomes
 * meaningful per screen as each is rebuilt, and is wired then.
 *
 * Usage:  node scripts/visual-check.mjs
 * Requires the dev server on 5173 (pnpm dev), or pass --build to serve dist/.
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '.visual-diff')
const BASE = process.env.VISUAL_BASE_URL ?? 'http://localhost:5173'

/** The design's 22 screens, and the implementation route that serves each. */
const SCREENS = [
  { key: 'home', label: 'LIVE HOME', route: '/' },
  { key: 'warehouse', label: 'WAREHOUSE', route: '/warehouse' },
  { key: 'sku', label: 'SKU LEDGER', route: null },
  { key: 'issue', label: 'ISSUE STOCK', route: '/issue' },
  { key: 'review', label: 'REVIEW ISSUE', route: null },
  { key: 'docket', label: 'DOCKET CREATED', route: null, note: 'route is /dockets/$id — needs a created docket' },
  { key: 'bars', label: 'BARS', route: '/bars' },
  { key: 'bar', label: 'BAR 3', route: '/bars/bar-3' },
  { key: 'accept', label: 'RECEIVE STOCK', route: null },
  { key: 'diff', label: 'REPORT DIFFERENCE', route: null },
  { key: 'received', label: 'RECEIVED', route: null },
  { key: 'waste', label: 'RECORD WASTE', route: '/waste' },
  { key: 'count', label: 'MID-EVENT COUNT', route: '/count' },
  { key: 'countDone', label: 'COUNT SUBMITTED', route: null },
  { key: 'variance', label: 'VARIANCE', route: null },
  { key: 'activity', label: 'ACTIVITY', route: '/activity' },
  { key: 'mv', label: 'MOVEMENT', route: null },
  { key: 'control', label: 'CONTROL', route: null },
  { key: 'cowork', label: 'COWORK', route: null },
  { key: 'more', label: 'MORE', route: '/more', expectsData: false, note: 'menu, sync card and role badge read live state, not fixture SKU data' },
  { key: 'reports', label: 'REPORTS', route: '/reports', expectsData: false, note: 'honest empty state until the ledger views exist (BAR-107)' },
  { key: 'rep', label: 'REPORT', route: null },
]

/**
 * Capture a settled render.
 *
 * Screens now read asynchronously through React Query, so a fixed delay races
 * the loading state: one capture can catch "Loading…" and the other the settled
 * screen, or both can catch the loading state and be identical — which the
 * derivation check would report as hardcoded. That made the gate flaky, and a
 * flaky gate is worse than none because it teaches people to re-run until green.
 *
 * So wait for every loading placeholder to clear, then for two consecutive
 * identical frames, before capturing.
 */
async function shoot(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' })

  await page
    .waitForFunction(() => !/Loading[^]*?…/.test(document.body.innerText), null, { timeout: 8000 })
    .catch(() => {}) // a screen with no loading state never matches; not a failure

  let previous = null
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(180)
    const frame = await page.screenshot()
    if (previous && Buffer.compare(previous, frame) === 0) return frame
    previous = frame
  }
  return previous
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

  const rows = []
  for (const s of SCREENS) {
    if (!s.route) {
      rows.push({ ...s, status: 'missing' })
      continue
    }
    const sep = s.route.includes('?') ? '&' : '?'
    let status = 'derived', note = s.note ?? ''
    try {
      const a = await shoot(page, `${BASE}${s.route}${sep}fixture=a`)
      const b = await shoot(page, `${BASE}${s.route}${sep}fixture=b`)
      fs.writeFileSync(path.join(OUT, `${s.key}.impl.png`), a)
      if (Buffer.compare(a, b) === 0) {
        if (s.expectsData === false) {
          status = 'static-ok'
        } else {
          status = 'hardcoded'
          note = 'identical under two fixture sets — screen does not read the data layer'
        }
      }
    } catch (err) {
      status = 'error'
      note = String(err).split('\n')[0].slice(0, 100)
    }
    rows.push({ ...s, status, note })
  }

  await browser.close()

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  const refs = new Set(fs.existsSync(path.join(ROOT, 'references', 'ui')) ? fs.readdirSync(path.join(ROOT, 'references', 'ui')).map((f) => f.replace(/\.png$/, '')) : [])

  console.log('\nBAR-008 — design fidelity gate\n')
  console.log(`  screens in design      ${SCREENS.length}`)
  console.log(`  reference captures     ${refs.size}`)
  console.log(`  implemented routes     ${SCREENS.filter((s) => s.route).length}`)
  console.log(`  reading the data layer ${counts.derived ?? 0}`)
  console.log(`  legitimately static    ${counts['static-ok'] ?? 0}`)
  console.log(`  hardcoded              ${counts.hardcoded ?? 0}`)
  console.log(`  missing entirely       ${counts.missing ?? 0}`)
  console.log(`  errored                ${counts.error ?? 0}\n`)

  for (const r of rows) {
    const mark = { derived: '  ok  ', 'static-ok': ' stat ', hardcoded: ' HARD ', missing: ' MISS ', error: ' ERR  ' }[r.status]
    console.log(`${mark} ${r.key.padEnd(11)} ${r.label.padEnd(18)} ${r.note ?? ''}`)
  }

  const hardcoded = rows.filter((r) => r.status === 'hardcoded')
  if (hardcoded.length) {
    console.log(`\n${hardcoded.length} screen(s) render identically under two fixture sets.`)
    console.log('A screen that ignores its data cannot be accepted, however closely it')
    console.log('matches the reference image. See docs/DECISIONS.md ADR-010.')
    process.exitCode = 1
  }
}

main()

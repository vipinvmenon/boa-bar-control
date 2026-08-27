/**
 * BAR-007 — capture screen-keyed reference images from the approved design.
 *
 * The approved design is `BOA-Bar.html`, a bundled artifact whose real source
 * (a 22-screen state machine) lives compressed inside a __bundler/manifest
 * script tag. It is the UI contract; these captures are the acceptance artefact
 * every UI task is measured against.
 *
 * This script does not trust its own navigation. The design renders its current
 * screen label into the stage caption ("BOA BAR INVENTORY / 390 x 844 / <LABEL>"),
 * so after walking a route we assert the label matches the screen we intended to
 * reach. A route that lands somewhere else is reported as a failure rather than
 * silently saving a mislabelled reference — the whole point of this file is that
 * it cannot lie about coverage.
 *
 * Usage:  node scripts/capture-design-reference.mjs
 * Serves the repo root itself; no external server required.
 */
import { chromium } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'references', 'ui')
const PORT = 8123
const FRAME = { width: 390, height: 844 }

/** The design's own screenLabels map (design-script.jsx:79-86). The oracle. */
const LABELS = {
  home: 'LIVE HOME', warehouse: 'WAREHOUSE', sku: 'SKU LEDGER', issue: 'ISSUE STOCK',
  review: 'REVIEW ISSUE', docket: 'DOCKET CREATED', bars: 'BARS', bar: 'BAR 3',
  accept: 'RECEIVE STOCK', diff: 'REPORT DIFFERENCE', received: 'RECEIVED', waste: 'RECORD WASTE',
  count: 'MID-EVENT COUNT', countDone: 'COUNT SUBMITTED', variance: 'VARIANCE',
  activity: 'ACTIVITY', mv: 'MOVEMENT', control: 'CONTROL', cowork: 'COWORK', more: 'MORE',
  reports: 'REPORTS', rep: 'REPORT',
}

/**
 * Route to each screen from a fresh load. Steps are click targets described by
 * visible text or a role, because the design has no stable ids or classes —
 * every style is inline.
 */
const ROUTES = {
  home: [],
  warehouse: [{ nav: 'WAREHOUSE' }],
  bars: [{ nav: 'BARS' }],
  activity: [{ nav: 'ACTIVITY' }],
  more: [{ nav: 'MORE' }],

  issue: [{ text: 'ISSUE' }],
  accept: [{ text: 'OPEN' }],
  count: [{ text: 'COUNT' }],
  cowork: [{ star: true }],

  sku: [{ nav: 'WAREHOUSE' }, { text: 'Kingfisher Premium' }],
  bar: [{ nav: 'BARS' }, { text: 'BAR 3' }],
  mv: [{ nav: 'ACTIVITY' }, { text: 'Docket D-0184 accepted' }],

  reports: [{ nav: 'MORE' }, { text: 'REPORTS' }],
  rep: [{ nav: 'MORE' }, { text: 'REPORTS' }, { text: 'EXCISE DAILY RETURN' }],
  control: [{ nav: 'MORE' }, { text: 'CONTROL' }],
  variance: [{ nav: 'MORE' }, { text: 'VARIANCE' }],

  review: [{ text: 'ISSUE' }, { text: 'REVIEW ISSUE' }],
  // The review screen's CTA is "CREATE DOCKET & ISSUE" (bound to createDocket).
  // "CONFIRM TRANSFER" is a different route to the same screen, from the control
  // screen's proposed-transfer sheet (design-script.jsx:376).
  docket: [{ text: 'ISSUE' }, { text: 'REVIEW ISSUE' }, { text: 'CREATE DOCKET' }],
  received: [{ text: 'OPEN' }, { text: 'ACCEPT 48 BOTTLES' }],
  waste: [{ nav: 'BARS' }, { text: 'BAR 3' }, { text: 'WASTE' }],

  // countIdx starts at 4 and the CTA only becomes SUBMIT COUNT at 18
  // (design-script.jsx: `countCta: s.countIdx >= 18 ? 'SUBMIT COUNT' : 'SAVE & NEXT'`).
  countDone: [{ text: 'SAVE & NEXT', repeat: 14 }, { text: 'SUBMIT COUNT' }],

  // `diff` is not a screen — it is the accept screen with recvMode === 'diff'
  // (design-script.jsx `toggleDiff`). There is no `screen === 'diff'` branch, so
  // the stage caption still reads RECEIVE STOCK. screenLabels lists a label for
  // it that the design never displays. Verified by the reason picker instead.
  diff: [{ text: 'OPEN' }, { text: 'REPORT DIFFERENCE' }],
}

/** Screens whose caption differs from their screenLabels entry, with why. */
const LABEL_OVERRIDE = {
  diff: { expect: 'RECEIVE STOCK', alsoRequireText: 'REASON · REQUIRED' },
}

/** Routes that need a screen visited first (countDone continues from count). */
const PREFIX = { countDone: [{ text: 'COUNT' }] }

function serve() {
  const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain',
  }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
    const file = path.join(ROOT, rel)
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found')
    }
    res.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

/** Read the screen label the design prints into its own stage caption. */
async function currentLabel(page) {
  return page.evaluate(() => {
    // The stage caption is a div of spans reading
    // "BOA BAR INVENTORY / 390 × 844 / <LABEL>". Match on the dimensions so we
    // do not pick up the More screen's own "BOA BAR INVENTORY · BUILD 0.4" line.
    const el = Array.from(document.querySelectorAll('div')).find(
      (d) => d.children.length > 0 && /390\s*×\s*844/.test(d.textContent ?? '') && /BOA BAR INVENTORY/.test(d.textContent ?? ''),
    )
    if (!el) return null
    const spans = Array.from(el.querySelectorAll('span'))
    const last = spans[spans.length - 1]
    return last ? (last.textContent ?? '').trim() : null
  })
}

async function clickStep(page, step) {
  if (step.nav) {
    // Bottom nav: the label sits in a small caps div inside a button.
    await page.locator(`button:has-text("${step.nav}"), div[role=button]:has-text("${step.nav}")`).last().click({ timeout: 4000 })
    return
  }
  if (step.star) {
    // The header's manager/cowork shortcut is the only 36x36 button in the header.
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((el) => {
        const r = el.getBoundingClientRect()
        return Math.abs(r.width - 36) < 3 && Math.abs(r.height - 36) < 3
      })
      b?.click()
    })
    return
  }
  await page.getByText(step.text, { exact: false }).first().click({ timeout: 4000 })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const server = await serve()
  const browser = await chromium.launch()
  const results = []

  for (const [screen, route] of Object.entries(ROUTES)) {
    const page = await browser.newPage({ viewport: { width: 840, height: 1000 }, deviceScaleFactor: 2 })
    let status = 'ok', note = ''
    try {
      await page.goto(`http://localhost:${PORT}/BOA-Bar.html`, { waitUntil: 'load' })
      // The bundle unpacks and mounts asynchronously; wait for the frame.
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('div')).some((el) => {
          const r = el.getBoundingClientRect()
          return Math.abs(r.width - 390) < 3 && Math.abs(r.height - 844) < 3
        })
      }, null, { timeout: 20000 })
      await page.waitForTimeout(700) // fonts + gradients settle

      for (const step of [...(PREFIX[screen] ?? []), ...route]) {
        for (let i = 0; i < (step.repeat ?? 1); i += 1) {
          await clickStep(page, step)
          await page.waitForTimeout(step.repeat ? 90 : 350)
        }
      }

      const label = await currentLabel(page)
      const override = LABEL_OVERRIDE[screen]
      const expected = override?.expect ?? LABELS[screen]
      if (label !== expected) {
        status = 'wrong-screen'
        note = `expected "${expected}", landed on "${label}"`
      } else if (override?.alsoRequireText) {
        const present = await page.getByText(override.alsoRequireText, { exact: false }).count()
        if (!present) {
          status = 'wrong-state'
          note = `on ${label} but "${override.alsoRequireText}" not visible`
        } else {
          note = `variant of accept (recvMode=diff); caption reads ${label}`
        }
      }

      const frame = await page.evaluateHandle(() => Array.from(document.querySelectorAll('div')).find((el) => {
        const r = el.getBoundingClientRect()
        return Math.abs(r.width - 390) < 3 && Math.abs(r.height - 844) < 3
      }))
      const el = frame.asElement()
      if (!el) throw new Error('app frame not found for capture')

      // Only save a capture we could verify. A mislabelled reference is worse
      // than a missing one: it would silently certify the wrong composition.
      if (status === 'ok') {
        await el.screenshot({ path: path.join(OUT, `${screen}.png`) })
      }
    } catch (err) {
      status = 'error'
      note = String(err).split('\n')[0].slice(0, 120)
    }
    results.push({ screen, label: LABELS[screen], status, note })
    await page.close()
  }

  await browser.close()
  server.close()

  const ok = results.filter((r) => r.status === 'ok')
  console.log(`\nBAR-007 — captured ${ok.length} of ${results.length} screens into references/ui/\n`)
  for (const r of results) {
    const mark = r.status === 'ok' ? '  ok  ' : ' FAIL '
    console.log(`${mark} ${r.screen.padEnd(11)} ${r.label.padEnd(18)} ${r.note}`)
  }

  // Machine-enumerable target, so a missing screen fails CI rather than going
  // unnoticed the way an 11-screen shortfall did for five weeks.
  fs.writeFileSync(
    path.join(ROOT, 'references', 'design-source', 'screens.json'),
    JSON.stringify(
      {
        note: 'The 22 screens of the approved design. Generated by scripts/capture-design-reference.mjs. `captured` reflects verified reference images in references/ui/.',
        source: 'references/design-source/design-script.jsx:79-86',
        screens: Object.entries(LABELS).map(([key, label]) => ({
          key,
          label,
          captured: ok.some((r) => r.screen === key),
        })),
      },
      null,
      2,
    ) + '\n',
  )

  if (ok.length !== results.length) {
    console.log(`\n${results.length - ok.length} screen(s) not captured. Routes need correcting — see notes above.`)
    process.exitCode = 1
  }
}

main()

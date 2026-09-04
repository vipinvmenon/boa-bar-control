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
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '.visual-diff')

/**
 * BAR-179 — the gate serves the tree it is testing, rather than assuming a port.
 *
 * This defaulted to `http://localhost:5173` and probed whatever answered there —
 * a long-running server started by somebody else, in a process this gate does
 * not control and cannot inspect.
 *
 * What that cost, on 4 September: a clean tree was reported as
 * `0 reading the data layer / 18 hardcoded / home HARD` — the exact shape of the
 * defect this gate exists to catch, against code that did not have it. Two
 * agents hit the same false verdict within the hour.
 *
 * The cause is worth stating precisely, because the obvious explanation is the
 * wrong one. The server on 5173 was serving THIS tree, not another checkout;
 * running `pnpm add -D` mid-session invalidated its dependency optimisation, and
 * for a window it served a degraded module graph in which every screen rendered
 * alike. "Identical under two fixture sets" is exactly what this gate calls
 * hardcoded. It recovered on its own and the same probe then returned
 * `0 hardcoded`, which is worse than a stable failure: the verdict depended on
 * when you happened to run it.
 *
 * So the rule is not "beware other checkouts". It is that a gate must control
 * the thing it measures. Any state in a server this script did not start — a
 * stale optimisation, an in-flight HMR update, a different branch, another
 * project entirely — arrives as a finding about the code. A gate that can
 * fabricate its own headline finding is worse than no gate on a project whose
 * documented root cause is verifications that were never performed.
 *
 * So: with no explicit override, start a dev server from THIS directory on a
 * free port, measure that, and shut it down. `VISUAL_BASE_URL` still wins — CI
 * and a developer with a server already up both have reasons to point it
 * somewhere — but it is now a deliberate act, announced in the output, rather
 * than a silent default that is wrong exactly when the machine is busy.
 */
let BASE = process.env.VISUAL_BASE_URL ?? null

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) throw new Error(`The dev server did not answer at ${url}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

/** The local vite binary, not `pnpm dev` — one less shell to be wrong about. */
async function startOwnServer() {
  const port = await freePort()
  const bin = path.join(ROOT, 'node_modules', '.bin', 'vite')
  if (!fs.existsSync(bin)) {
    throw new Error('node_modules/.bin/vite is missing — run `corepack pnpm install` first')
  }
  const child = spawn(bin, ['--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  })
  child.on('error', (error) => {
    console.error(`\nCould not start the dev server: ${error.message}`)
    process.exit(1)
  })
  const url = `http://127.0.0.1:${port}`
  await waitForServer(`${url}/`)
  return { url, stop: () => { try { child.kill('SIGTERM') } catch { /* already gone */ } } }
}

/** The design's 22 screens, and the implementation route that serves each. */
const SCREENS = [
  { key: 'home', label: 'LIVE HOME', route: '/' },
  { key: 'warehouse', label: 'WAREHOUSE', route: '/warehouse' },
  { key: 'sku', label: 'SKU LEDGER', route: null },
  { key: 'issue', label: 'ISSUE STOCK', route: '/issue' },
  // The review screen requires an explicit draft and refuses to invent one: reached
  // bare it renders "NO ISSUE TO REVIEW", which is identical under both fixture sets
  // and so reads to this gate as a hardcoded screen. The draft below is how the
  // screen is actually reached, and its ids exist in BOTH fixture variants (variant
  // b renames bars and products but keeps their ids), so the two renders still
  // differ and the derivation check remains meaningful.
  {
    key: 'review',
    label: 'REVIEW ISSUE',
    route: '/issue/review?fromLocationId=warehouse&toLocationId=bar-3&skuId=kf&containers=36&unit=container',
  },
  { key: 'docket', label: 'DOCKET CREATED', route: '/dockets/D-0184' },
  { key: 'bars', label: 'BARS', route: '/bars' },
  { key: 'bar', label: 'BAR 3', route: '/bars/bar-3' },
  { key: 'accept', label: 'RECEIVE STOCK', route: '/dockets/D-0184/accept' },
  { key: 'diff', label: 'REPORT DIFFERENCE', route: null, note: 'not a route — the accept screen with its difference panel open (design toggleDiff)' },
  { key: 'received', label: 'RECEIVED', route: '/dockets/D-0184/received' },
  { key: 'waste', label: 'RECORD WASTE', route: '/waste' },
  { key: 'count', label: 'MID-EVENT COUNT', route: '/count' },
  { key: 'countDone', label: 'COUNT SUBMITTED', route: '/count/submitted' },
  { key: 'variance', label: 'VARIANCE', route: '/variance' },
  { key: 'activity', label: 'ACTIVITY', route: '/activity' },
  { key: 'mv', label: 'MOVEMENT', route: null },
  { key: 'control', label: 'CONTROL', route: null },
  { key: 'cowork', label: 'COWORK', route: null },
  { key: 'more', label: 'MORE', route: '/more', expectsData: false, note: 'menu, sync card and role badge read live state, not fixture SKU data' },
  { key: 'reports', label: 'REPORTS', route: '/reports', expectsData: false, note: 'honest empty state until the ledger views exist (BAR-107)' },
  { key: 'rep', label: 'REPORT', route: null },
]

/**
 * BAR-165. The routes the app has that the design does not.
 *
 * This gate covered only the 22 design screens, so `receipt`, `dockets`, `team`,
 * `print` and now `settings` had **no visual coverage at all** — five built
 * screens nobody was checking. Three separate defects lived there unseen: the
 * receipt and waste headers named two class names that exist nowhere in the
 * stylesheet and therefore rendered in the root Archivo face while every other
 * flow header is Oswald, and the print sheet's entire typography was defined only
 * inside `@media print`, so its on-screen preview had no styling.
 *
 * They are held to the same standard as the design screens — a route that renders
 * identically under two fixture sets is not reading the data layer — because that
 * is the property that matters and it has nothing to do with whether a designer
 * drew the screen.
 */
const EXTRA_SCREENS = [
  { key: 'receipt', label: 'RECORD DELIVERY', route: '/receipt' },
  { key: 'dockets', label: 'IN CUSTODY', route: '/dockets' },
  { key: 'team', label: 'TEAM', route: '/team' },
  { key: 'print', label: 'PAPER FALLBACK', route: '/print' },
  {
    key: 'settings',
    label: 'SETTINGS',
    route: '/settings',
    expectsData: false,
    note: 'compatibility redirect to More; options now live in the More index',
  },
  {
    key: 'settings-invite',
    label: 'INVITE CREW',
    route: '/settings/invite',
    expectsData: false,
    note: 'permission-gated account invitation flow',
  },
  {
    key: 'settings-password',
    label: 'CHANGE PASSWORD',
    route: '/settings/password',
    expectsData: false,
    note: 'authenticated account password update flow',
  },
]

const ALL_SCREENS = [...SCREENS, ...EXTRA_SCREENS]

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

  // Every async screen renders a "Loading …" placeholder; wait for all of them
  // to clear. A screen with no loading state simply satisfies this immediately.
  await page
    .waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 10000 })
    .catch(() => {})

  // Then require THREE consecutive identical frames. Two was not enough: a
  // placeholder that is stable for one interval satisfied it, which is why
  // consecutive runs still disagreed (0, 0, 1).
  let previous = null
  let stable = 0
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await page.waitForTimeout(150)
    const frame = await page.screenshot()
    if (previous && Buffer.compare(previous, frame) === 0) {
      stable += 1
      if (stable >= 2) return frame
    } else {
      stable = 0
    }
    previous = frame
  }

  // Never settled. The previous version RETURNED THE LAST FRAME ANYWAY, with no
  // signal that it had given up — so two unsettled captures of the same still-
  // moving screen could compare equal by chance and the screen was reported as
  // hardcoded. That is the intermittent false positive: roughly one run in four,
  // clean on every re-run, which teaches people to re-run until it passes.
  //
  // A capture that did not settle is not evidence either way, so it is now an
  // error the gate reports rather than a verdict it invents.
  throw new Error('screen never settled: 25 frames without three identical in a row')
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  // BAR-179. Establish what is being measured, and say so, before measuring it.
  let ownServer = null
  if (BASE) {
    console.log(`\n  serving                ${BASE}  (VISUAL_BASE_URL — this gate cannot verify it is this tree)`)
  } else {
    ownServer = await startOwnServer()
    BASE = ownServer.url
    console.log(`\n  serving                ${BASE}  (started from ${ROOT})`)
  }
  try {
    await run()
  } finally {
    ownServer?.stop()
  }
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    /**
     * The live dot pulses at 2.4s forever (BAR-037), and `bar` and `docket` are
     * the two screens that render it — so those two could NEVER produce three
     * identical consecutive frames. That was the real cause of this gate's
     * intermittent false positives: the capture gave up, silently returned a
     * moving frame, and two moving frames sometimes compared equal.
     *
     * The stylesheet already stops the animation under `prefers-reduced-motion`,
     * so the gate asks for it rather than injecting CSS of its own. The captures
     * are then exactly what a reduced-motion user sees, and deterministic.
     */
    reducedMotion: 'reduce',
  })

  // Warm-up pass. Vite compiles modules on first request, so the first render of
  // each route is slower than the settle logic allows and can be captured
  // mid-compile — which showed up as one screen falsely reporting "hardcoded" on
  // the first run after a server restart, and clean on every run after. Touch
  // every route once before measuring anything.
  for (const s of ALL_SCREENS) {
    if (!s.route) continue
    await page.goto(`${BASE}${s.route}`, { waitUntil: 'networkidle' }).catch(() => {})
  }
  await page.waitForTimeout(400)

  const rows = []
  for (const s of ALL_SCREENS) {
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
  console.log(`  routes off the design  ${EXTRA_SCREENS.length}   (BAR-165 — previously uncovered)`)
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

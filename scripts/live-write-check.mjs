#!/usr/bin/env node

/**
 * Manual-assisted Playwright smoke runner for the five release write journeys.
 *
 * It deliberately uses saved Playwright storage states instead of automating
 * credentials or OTPs.  Run with --write only after confirming that the target
 * is the live database; without it, the runner stops before every write.
 *
 * Example:
 *   LIVE_ISSUER_STATE=.auth/issuer.json LIVE_RECEIVER_STATE=.auth/receiver.json \
 *   node scripts/live-write-check.mjs --write
 */
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'
const issuerState = process.env.LIVE_ISSUER_STATE
const receiverState = process.env.LIVE_RECEIVER_STATE
const writeMode = process.argv.includes('--write')
const interactive = !process.argv.includes('--non-interactive')

if (!issuerState || !receiverState) {
  console.error('Set LIVE_ISSUER_STATE and LIVE_RECEIVER_STATE to saved Playwright storage-state files.')
  process.exit(2)
}
for (const file of [issuerState, receiverState]) {
  if (!existsSync(file)) {
    console.error(`Storage state not found: ${file}`)
    process.exit(2)
  }
}
if (writeMode && process.env.LIVE_WRITE_CONFIRM !== 'I_UNDERSTAND_LIVE_WRITES') {
  console.error('Refusing live writes. Set LIVE_WRITE_CONFIRM=I_UNDERSTAND_LIVE_WRITES when you are ready.')
  process.exit(2)
}

const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null
const pause = async (message) => {
  if (!writeMode) {
    console.log(`DRY RUN · ${message}`)
    return
  }
  if (rl) await rl.question(`CHECKPOINT · ${message} Press Enter to continue, or Ctrl-C to stop. `)
}
const expectVisible = async (page, locator, label) => {
  await locator.waitFor({ state: 'visible' })
  console.log(`PASS · ${label}`)
}
const browser = await chromium.launch({ headless: true })
const context = async (state) => browser.newContext({
  viewport: { width: 390, height: 844 },
  storageState: state,
})

async function receipt(page) {
  await page.goto(`${baseURL}/receipt`)
  await expectVisible(page, page.getByText('RECORD DELIVERY'), 'receipt screen')
  await page.locator('input').nth(0).fill(`PLAYWRIGHT-${Date.now()}`)
  await page.locator('input').nth(1).fill(`E2E-${Date.now()}`)
  await page.getByRole('button', { name: 'Add to delivery' }).click()
  await expectVisible(page, page.getByText(/Record delivery · 1 line/), 'receipt line')
  await pause('receipt is ready to post')
  if (writeMode) {
    await page.getByRole('button', { name: /Record delivery/ }).click()
    await page.waitForURL(/\/warehouse$/)
    console.log('PASS · receipt posted')
  }
}

async function issue(page) {
  await page.goto(`${baseURL}/issue`)
  await expectVisible(page, page.getByText('Issue stock'), 'issue screen')
  await page.getByRole('button', { name: 'Review issue' }).click()
  await expectVisible(page, page.getByRole('button', { name: 'Create docket & issue' }), 'issue review')
  await pause('issue is ready to create a docket')
  if (writeMode) {
    await page.getByRole('button', { name: 'Create docket & issue' }).click()
    await page.waitForURL(/\/dockets\/[^/]+$/)
    console.log(`PASS · docket created (${new URL(page.url()).pathname.split('/').pop()})`)
  }
}

async function waste(page) {
  await page.goto(`${baseURL}/waste`)
  await expectVisible(page, page.getByText('RECORD WASTE'), 'waste screen')
  await page.getByRole('button').filter({ hasText: /Spillage|Breakage|Expired|Other|Foam/i }).first().click().catch(() => {})
  const reason = page.locator('.waste-reasons button').first()
  await reason.click()
  await pause('waste is ready to record')
  if (writeMode) {
    await page.getByRole('button', { name: /Record 1 as waste/ }).click()
    await page.waitForURL(/\/bars$/)
    console.log('PASS · waste recorded')
  }
}

async function count(page) {
  await page.goto(`${baseURL}/count`)
  await expectVisible(page, page.getByRole('button', { name: /Save & next|Submit count/ }).first(), 'count screen')
  let steps = 0
  while (writeMode && steps < 100) {
    const submit = page.getByRole('button', { name: 'Submit count' })
    if (await submit.isVisible().catch(() => false)) break
    await page.getByRole('button', { name: 'Save & next' }).click()
    steps += 1
  }
  await pause(`count is ready to submit after ${steps} line${steps === 1 ? '' : 's'}`)
  if (writeMode) {
    await page.getByRole('button', { name: 'Submit count' }).click()
    await page.waitForURL(/\/count\/submitted$/)
    console.log('PASS · count submitted')
  }
}

async function accept(page) {
  await page.goto(`${baseURL}/dockets`)
  await expectVisible(page, page.getByText('AWAITING ACCEPTANCE'), 'dockets screen')
  const docket = page.locator('.docket-row').first()
  await expectVisible(page, docket, 'pending docket')
  await docket.click()
  await expectVisible(page, page.getByRole('button', { name: /Accept \d+ bottles/ }), 'accept screen')
  await pause('acceptance is ready; verify this is an independent receiver account')
  if (writeMode) {
    await page.getByRole('button', { name: /Accept \d+ bottles/ }).click()
    await page.waitForURL(/\/received$/)
    console.log('PASS · docket accepted')
  }
}

const issuer = await context(issuerState)
const receiver = await context(receiverState)
try {
  const issuerPage = await issuer.newPage()
  const receiverPage = await receiver.newPage()
  await receipt(issuerPage)
  await issue(issuerPage)
  await waste(issuerPage)
  await count(issuerPage)
  await accept(receiverPage)
  console.log(writeMode ? 'ALL FIVE LIVE WRITE JOURNEYS COMPLETE' : 'DRY RUN COMPLETE · no writes were posted')
} finally {
  await issuer.close()
  await receiver.close()
  await browser.close()
  await rl?.close()
}

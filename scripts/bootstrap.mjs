#!/usr/bin/env node
/**
 * BAR-156 — bootstrap a venue so the system can be started.
 *
 * Run this once, after `supabase db push`, and after at least one person has
 * signed in to the app (which is what creates the `auth.users` row this needs —
 * there is no way to conjure one from here).
 *
 * It does four things, all idempotent:
 *
 *   1. checks the reference data landed
 *   2. claims the venue for a named admin, if it is still unclaimed
 *   3. posts opening warehouse stock as a `receipt` movement through the ledger
 *   4. prints the resulting position, and confirms the claim window is CLOSED
 *
 * It talks to PostgreSQL directly rather than through the REST API, because
 * claiming a venue and opening a warehouse are operator actions that happen once
 * at load-in, and because the app has no UI for either yet (that is BAR-140).
 *
 * Needs SUPABASE_DB_PASSWORD. Nothing here is written to disk.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { resolveDbUrl } from './lib/db-url.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const VENUE_CODE = 'boa-2026'

/**
 * The design's own warehouse catalogue, held in supabase/bootstrap/ so this script
 * and the test that checks it against the design cannot drift apart.
 *
 * These quantities are a verification artefact, not an arbitrary starting point:
 * after this runs, the live warehouse screen must show BEER 380, SPIRITS 142,
 * MIXERS 116 and 638 containers total, matching references/ui/warehouse.png. If it
 * shows anything else the live repository is wrong, and the difference is visible
 * rather than plausible.
 */
const OPENING = JSON.parse(readFileSync('supabase/bootstrap/opening-warehouse.json', 'utf8'))
const OPENING_WAREHOUSE = OPENING.lines

function fail(...lines) {
  console.error('\n  BOOTSTRAP FAILED\n')
  for (const line of lines) console.error(`  ${line}`)
  console.error('')
  process.exit(1)
}

const { url, error } = resolveDbUrl({ root: ROOT, command: 'pnpm bootstrap' })
if (error) fail(...error)

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
} catch (error) {
  fail('Could not connect to the database.', String(error.message ?? error))
}

try {
  // ---- 1. reference data ---------------------------------------------------
  const venue = await client.query('select id, name, timezone from public.boa_bar_venue where code = $1', [VENUE_CODE])
  if (venue.rowCount === 0) {
    fail(
      `No venue with code ${VENUE_CODE}.`,
      'The bootstrap migration has not been applied. Run:  node_modules/.bin/supabase db push',
    )
  }
  const venueId = venue.rows[0].id
  const counts = await client.query(
    `select
       (select count(*) from public.boa_bar_location where venue_id = $1 and active) as locations,
       (select count(*) from public.boa_bar_sku      where venue_id = $1 and active) as skus`,
    [venueId],
  )
  console.log(`\n  venue      ${venue.rows[0].name} (${venue.rows[0].timezone})`)
  console.log(`  locations  ${counts.rows[0].locations}`)
  console.log(`  skus       ${counts.rows[0].skus}`)

  // ---- 2. claim ------------------------------------------------------------
  const existing = await client.query(
    `select m.user_id, m.role, p.display_name
       from public.boa_bar_membership m
       left join public.boa_bar_person p on p.venue_id = m.venue_id and p.user_id = m.user_id
      where m.venue_id = $1 and m.active
      order by m.created_at`,
    [venueId],
  )

  let adminId
  if (existing.rowCount > 0) {
    adminId = existing.rows[0].user_id
    console.log(`\n  already claimed — ${existing.rowCount} active membership(s):`)
    for (const row of existing.rows) {
      console.log(`    ${(row.display_name ?? 'UNNAMED').padEnd(20)} ${row.role}`)
    }
  } else {
    const users = await client.query('select id, email, created_at from auth.users order by created_at limit 5')
    if (users.rowCount === 0) {
      // The magic-link route needs the app configured, an email to arrive, and a
      // link to be opened on this machine. The dashboard needs none of that, so it
      // is named first — an earlier version of this message mentioned only the
      // magic link and sent the operator down the slow path.
      fail(
        'No auth.users row exists, so there is nobody to make admin.',
        '',
        'Fastest route, no email needed:',
        '  Supabase dashboard -> Authentication -> Users -> Add user',
        '  Use your own email address and TICK "Auto Confirm User".',
        '',
        'Then run this again:',
        '  node scripts/bootstrap.mjs',
        '',
        'Nothing has been changed.',
      )
    }
    const user = users.rows[0]
    const name = process.env.BOOTSTRAP_ADMIN_NAME || (user.email ?? '').split('@')[0]
    if (!name) fail('Could not derive a display name. Set BOOTSTRAP_ADMIN_NAME.')

    // Mirrors boa_bar_claim_venue, which requires auth.uid() and so cannot be
    // called from a direct session. Same effect, same single-use condition — the
    // `where not exists` makes a concurrent second run a no-op rather than a
    // second admin.
    await client.query('begin')
    await client.query(
      `insert into public.boa_bar_membership (venue_id, user_id, role, active)
       select $1, $2, 'admin', true
       where not exists (select 1 from public.boa_bar_membership where venue_id = $1 and active)`,
      [venueId, user.id],
    )
    await client.query(
      `insert into public.boa_bar_person (venue_id, user_id, display_name) values ($1, $2, $3)
       on conflict (venue_id, user_id) do update set display_name = excluded.display_name, updated_at = now()`,
      [venueId, user.id, name],
    )
    await client.query(
      `insert into public.boa_bar_person_name_history (venue_id, user_id, previous_name, new_name, changed_by)
       values ($1, $2, null, $3, $2)`,
      [venueId, user.id, name],
    )
    await client.query('commit')
    adminId = user.id
    console.log(`\n  claimed    ${name} — admin  (${user.email})`)
    if (users.rowCount > 1) {
      console.log(`  note       ${users.rowCount} auth users exist; the earliest was chosen.`)
      console.log('             Grant the rest their roles as a manager, not with this script.')
    }
  }

  // ---- 3. opening stock ----------------------------------------------------
  const warehouse = await client.query(
    `select id, name from public.boa_bar_location where venue_id = $1 and code = 'warehouse'`,
    [venueId],
  )
  if (warehouse.rowCount === 0) fail('No warehouse location. The bootstrap migration did not apply cleanly.')

  const opened = await client.query('select public.boa_bar_open_stock($1::jsonb) as result', [
    JSON.stringify({
      venue_id: venueId,
      location_id: warehouse.rows[0].id,
      actor_id: adminId,
      reason: 'Opening stock — bootstrap',
      source: 'bootstrap',
      lines: OPENING_WAREHOUSE,
    }),
  ])
  const result = opened.rows[0].result
  console.log(`\n  opening    movement ${String(result.movement_id).slice(0, 8)} · ${result.lines} lines · ${result.business_date}`)
  console.log('             re-running is a replay, not a second receipt')

  // ---- 4. verify -----------------------------------------------------------
  // The projection is compared against a ledger sum, because the projection is
  // not the source of truth and a bootstrap that silently disagreed with the
  // ledger would be worse than one that failed.
  const check = await client.query(
    `with ledger as (
       select ml.sku_id, sum(ml.container_delta)::bigint as containers
         from public.boa_bar_movement_line ml
         join public.boa_bar_movement m on m.id = ml.movement_id
        where m.venue_id = $1 and ml.location_id = $2
        group by ml.sku_id
     )
     select s.code, s.name, l.containers as ledger, coalesce(b.containers, 0) as projection
       from ledger l
       join public.boa_bar_sku s on s.id = l.sku_id
       left join private.boa_bar_balance b on b.venue_id = $1 and b.location_id = $2 and b.sku_id = l.sku_id
      order by s.code`,
    [venueId, warehouse.rows[0].id],
  )

  console.log(`\n  ${warehouse.rows[0].name} position — ledger sum vs projection\n`)
  let total = 0
  let drift = 0
  for (const row of check.rows) {
    const same = String(row.ledger) === String(row.projection)
    if (!same) drift += 1
    total += Number(row.ledger)
    console.log(
      `    ${row.code.padEnd(9)} ${row.name.padEnd(20)} ${String(row.ledger).padStart(5)} ${same ? '  ok' : `  DRIFT (projection ${row.projection})`}`,
    )
  }
  console.log(`    ${''.padEnd(9)} ${'TOTAL'.padEnd(20)} ${String(total).padStart(5)}`)

  const stillOpen = await client.query(
    `select not exists (select 1 from public.boa_bar_membership where venue_id = $1 and active) as unclaimed`,
    [venueId],
  )
  console.log(`\n  claim window ${stillOpen.rows[0].unclaimed ? 'STILL OPEN — investigate' : 'closed'}`)

  if (drift > 0) {
    fail(`${drift} SKU(s) where the balance projection disagrees with the ledger sum.`)
  }
  console.log(`  ledger and projection agree on all ${check.rowCount} lines\n`)
} catch (error) {
  try {
    await client.query('rollback')
  } catch {
    // nothing to roll back
  }
  fail(String(error.message ?? error))
} finally {
  await client.end()
}

#!/usr/bin/env node
/**
 * Report what is actually in the linked database.
 *
 * Written because `supabase db push` reported "Remote database is up to date"
 * while two migrations that had never been applied were sitting in
 * supabase/migrations/. Rather than guess at why, this prints the migration
 * history the CLI compares against, which object from each migration does and
 * does not exist, and the row counts. Read-only: it issues no DDL and no writes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { resolveDbUrl } from './lib/db-url.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const { url, error } = resolveDbUrl({ root: ROOT, command: 'node scripts/db-state.mjs' })
if (error) {
  console.error('')
  for (const line of error) console.error(line ? `  ${line}` : '')
  console.error('')
  process.exit(2)
}

/**
 * One object per migration that exists only if that migration ran. Existence of
 * the object is the ground truth; the migration history table is only what the
 * CLI believes.
 */
const WITNESS = [
  ['202608220001_boa_bar_core', 'function', 'public.boa_bar_submit_movement'],
  ['202608220002_live_access', 'function', 'public.boa_bar_inventory_snapshot'],
  ['202608270001_lock_down_privileges', 'schema-usage', 'private'],
  ['202608270002_docket_commands', 'function', 'public.boa_bar_create_docket'],
  ['202608280001_person_names', 'table', 'public.boa_bar_person'],
  ['202608280002_bootstrap', 'function', 'public.boa_bar_open_stock'],
  ['202608280003_revoke_function_execute', 'privilege', 'anon-cannot-submit'],
  ['202608290001_location_scope', 'function', 'private.boa_bar_can_access_location'],
  ['202608290002_count_location_scope', 'function', 'private.boa_bar_open_count_unscoped'],
]

/**
 * The two EXECUTE holes 202608280003 closes, checked directly rather than
 * inferred from reading the migrations. The second is the serious one: the
 * internal poster takes the actor as a parameter, so any role that can execute it
 * can forge attribution and skip every role check.
 */
const HOLES = [
  ['anon', 'public.boa_bar_submit_movement(jsonb)', 'anon can post movements'],
  ['authenticated', 'private.boa_bar_post_movement(jsonb, uuid)', 'ANY SIGNED-IN USER can post a forged movement'],
  ['anon', 'private.boa_bar_post_movement(jsonb, uuid)', 'anon can post a forged movement'],
]

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  const version = (await client.query('select version()')).rows[0].version
  console.log(`\n  ${version.split(',')[0]}`)

  // ---- what the CLI thinks -------------------------------------------------
  console.log('\n  MIGRATION HISTORY (supabase_migrations.schema_migrations)')
  try {
    const history = await client.query(
      'select version, name from supabase_migrations.schema_migrations order by version',
    )
    if (history.rowCount === 0) {
      console.log('    empty — the CLI has no record of any migration')
    }
    for (const row of history.rows) {
      console.log(`    ${String(row.version).padEnd(20)} ${row.name ?? ''}`)
    }
  } catch (e) {
    console.log(`    table not readable: ${e.message}`)
  }

  const local = fs
    .readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  console.log('\n  LOCAL MIGRATION FILES')
  for (const file of local) console.log(`    ${file}`)

  // ---- what is actually there ---------------------------------------------
  console.log('\n  DID IT ACTUALLY RUN? (object existence, not history)')
  for (const [migration, kind, target] of WITNESS) {
    let present = false
    let note = ''
    if (kind === 'function') {
      const [schema, name] = target.split('.')
      const r = await client.query(
        `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $1 and p.proname = $2 limit 1`,
        [schema, name],
      )
      present = r.rowCount > 0
    } else if (kind === 'table') {
      const [schema, name] = target.split('.')
      const r = await client.query(
        `select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = $1 and c.relname = $2 and c.relkind = 'r' limit 1`,
        [schema, name],
      )
      present = r.rowCount > 0
    } else if (kind === 'schema-usage') {
      const r = await client.query(
        `select has_schema_privilege('authenticated', $1, 'USAGE') as ok`, [target],
      )
      present = r.rows[0].ok
      note = present ? 'authenticated has USAGE on private' : 'authenticated LACKS USAGE on private'
    } else if (kind === 'privilege') {
      // The hole 202608280003 closes: anon must NOT hold EXECUTE.
      const r = await client.query(
        `select has_function_privilege('anon', 'public.boa_bar_submit_movement(jsonb)', 'EXECUTE') as anon_can`,
      )
      present = r.rows[0].anon_can === false
      note = r.rows[0].anon_can ? 'anon STILL holds EXECUTE on boa_bar_submit_movement' : 'anon holds no EXECUTE'
    }
    console.log(`    ${present ? 'yes' : ' NO'}  ${migration.padEnd(38)} ${note}`)
  }

  // ---- the holes -----------------------------------------------------------
  console.log('\n  EXECUTE HOLES (202608280003)')
  for (const [role, signature, description] of HOLES) {
    let held
    try {
      const r = await client.query('select has_function_privilege($1, $2, $3) as held', [role, signature, 'EXECUTE'])
      held = r.rows[0].held
    } catch (e) {
      console.log(`    ?    ${signature} — ${e.message}`)
      continue
    }
    // A role needs USAGE on the schema as well as EXECUTE to actually call it.
    const schema = signature.split('.')[0]
    const usage = (await client.query('select has_schema_privilege($1, $2, $3) as ok', [role, schema, 'USAGE'])).rows[0].ok
    const reachable = held && usage
    console.log(
      `    ${reachable ? 'OPEN' : 'shut'}  ${role.padEnd(14)} ${signature.padEnd(44)} ${reachable ? description : ''}`,
    )
  }

  // ---- data ----------------------------------------------------------------
  console.log('\n  DATA')
  for (const [label, sql] of [
    ['venues', 'select count(*) from public.boa_bar_venue'],
    ['locations', 'select count(*) from public.boa_bar_location'],
    ['skus', 'select count(*) from public.boa_bar_sku'],
    ['memberships', 'select count(*) from public.boa_bar_membership'],
    ['movements', 'select count(*) from public.boa_bar_movement'],
    ['count sessions', 'select count(*) from public.boa_bar_count_session'],
    ['count lines', 'select count(*) from public.boa_bar_count_line'],
    ['auth users', 'select count(*) from auth.users'],
  ]) {
    try {
      const r = await client.query(sql)
      console.log(`    ${label.padEnd(14)} ${r.rows[0].count}`)
    } catch (e) {
      console.log(`    ${label.padEnd(14)} unreadable: ${e.message}`)
    }
  }

  // A count has no ledger movement: it is an observation plus a private seal.
  // Print the latest submitted session without exposing the sealed expected
  // position, so an operator can confirm a screen submission actually landed.
  console.log('\n  LATEST SUBMITTED COUNT')
  try {
    const latest = await client.query(
      `select cs.id, l.name as location_name, cs.count_kind, cs.status,
              cs.submitted_at, count(cl.id)::integer as line_count
         from public.boa_bar_count_session cs
         join public.boa_bar_location l on l.id = cs.location_id
         left join public.boa_bar_count_line cl on cl.count_session_id = cs.id
        where cs.submitted_at is not null
        group by cs.id, l.name, cs.count_kind, cs.status, cs.submitted_at
        order by cs.submitted_at desc
        limit 1`,
    )
    if (latest.rowCount === 0) {
      console.log('    none')
    } else {
      const row = latest.rows[0]
      console.log(`    ${row.location_name} · ${row.count_kind} · ${row.status} · ${row.line_count} lines · ${row.submitted_at.toISOString()}`)
      console.log(`    session ${row.id}`)
    }
  } catch (e) {
    console.log(`    unreadable: ${e.message}`)
  }

  /*
     BAR-161 + BAR-166 — the counts that are still open, and why anybody cares.

     Opening a count BLINDS that location: the device that opened it can no
     longer read the position it is counting, which is the whole point. There is
     no way to close one without submitting it (BAR-166 is unbuilt), so a count
     opened on the wrong bar leaves that bar looking empty to that user until
     somebody submits it.

     That is invisible from inside the app — the screen simply shows nothing — so
     it is reported here, where an operator can see it before concluding the data
     is missing. No expected figure is printed: an open session's whole purpose is
     that its expected position stays sealed (non-negotiable 3).
  */
  console.log('\n  OPEN COUNTS — each one blinds its location until submitted')
  try {
    const open = await client.query(
      `select cs.id, l.name as location_name, cs.count_kind, cs.status, cs.opened_at,
              count(cl.id)::integer as line_count
         from public.boa_bar_count_session cs
         join public.boa_bar_location l on l.id = cs.location_id
         left join public.boa_bar_count_line cl on cl.count_session_id = cs.id
        where cs.submitted_at is null
        group by cs.id, l.name, cs.count_kind, cs.status, cs.opened_at
        order by cs.opened_at desc`,
    )
    if (open.rowCount === 0) {
      console.log('    none — every count session has been submitted')
    } else {
      for (const row of open.rows) {
        const opened = row.opened_at ? row.opened_at.toISOString() : 'unknown'
        console.log(`    ${row.location_name} · ${row.count_kind} · ${row.status} · ${row.line_count} lines · opened ${opened}`)
        console.log(`      session ${row.id}`)
      }
    }
  } catch (e) {
    console.log(`    unreadable: ${e.message}`)
  }
  console.log('')
} finally {
  await client.end()
}

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

  // ---- data ----------------------------------------------------------------
  console.log('\n  DATA')
  for (const [label, sql] of [
    ['venues', 'select count(*) from public.boa_bar_venue'],
    ['locations', 'select count(*) from public.boa_bar_location'],
    ['skus', 'select count(*) from public.boa_bar_sku'],
    ['memberships', 'select count(*) from public.boa_bar_membership'],
    ['movements', 'select count(*) from public.boa_bar_movement'],
    ['auth users', 'select count(*) from auth.users'],
  ]) {
    try {
      const r = await client.query(sql)
      console.log(`    ${label.padEnd(14)} ${r.rows[0].count}`)
    } catch (e) {
      console.log(`    ${label.padEnd(14)} unreadable: ${e.message}`)
    }
  }
  console.log('')
} finally {
  await client.end()
}

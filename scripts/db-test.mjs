/**
 * BAR-031 — run the pgTAP suite without Docker.
 *
 * `supabase test db` shells out to Docker even with --linked, and Docker is not
 * installed on this machine. This runner connects directly with `pg`, so the
 * database gates can run locally and in CI on any machine.
 *
 * The connection string is read from the environment and never stored in the
 * repository:
 *
 *   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:6543/postgres'
 *   node scripts/db-test.mjs
 *
 * Get it from the Supabase dashboard: Settings -> Database -> Connection string
 * (use the pooler/Session mode string). In CI, set it as a repository secret.
 *
 * Exit code is non-zero if any assertion fails, so it works as a gate.
 */
import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDbUrl } from './lib/db-url.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TESTS = path.join(ROOT, 'supabase', 'tests')


/**
 * Credentials come from scripts/lib/db-url.mjs, shared with scripts/bootstrap.mjs.
 * This logic used to live here alone; the second consumer reimplemented it and got
 * the pooler URL's shape wrong — `supabase link` writes no password segment — so it
 * is now in one place.
 */
const { url, error: urlError } = resolveDbUrl({ root: ROOT, command: 'corepack pnpm test:db' })
if (urlError) {
  console.error('')
  for (const line of urlError) console.error(line ? `  ${line}` : '')
  console.error('')
  process.exit(2)
}

/** Parse TAP output into pass/fail counts and the failing lines. */
function parseTap(rows) {
  const lines = rows.map((r) => Object.values(r)[0]).filter((v) => typeof v === 'string')
  let pass = 0
  const failures = []
  for (const line of lines) {
    if (/^ok\b/.test(line)) pass += 1
    else if (/^not ok\b/.test(line)) failures.push(line)
  }
  return { lines, pass, failures }
}

async function main() {
  const files = fs.existsSync(TESTS)
    ? fs.readdirSync(TESTS).filter((f) => f.endsWith('.sql')).sort()
    : []

  if (!files.length) {
    console.error(`No .sql files in ${TESTS}`)
    process.exit(2)
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
  } catch (err) {
    const msg = String(err.message ?? err)
    console.error(`\nCould not connect: ${msg}\n`)
    if (/ENOTFOUND|EAI_AGAIN/.test(msg)) {
      console.error('The hostname did not resolve. If SUPABASE_DB_URL is set in this shell,')
      console.error('it may still hold a placeholder — run `unset SUPABASE_DB_URL` and use')
      console.error('SUPABASE_DB_PASSWORD instead.')
    } else if (/password authentication failed|SASL|SCRAM/i.test(msg)) {
      console.error('The password was rejected. This is the DATABASE password, not your')
      console.error('Supabase account password. Reset it at Settings -> Database ->')
      console.error('Database password, then export the new value.')
    } else if (/ETIMEDOUT|ECONNREFUSED/.test(msg)) {
      console.error('The host is unreachable — check network access to port 5432.')
    } else if (/Tenant or user not found/i.test(msg)) {
      console.error('The pooler rejected the username. supabase/.temp/pooler-url may be')
      console.error('stale — re-run `supabase link --project-ref reehdtkcpgoilrpzmfai`.')
    }
    console.error('')
    process.exit(1)
  }

  const version = (await client.query('select version()')).rows[0].version
  console.log(`\nConnected: ${version.split(',')[0]}\n`)

  let totalPass = 0
  const allFailures = []

  for (const file of files) {
    const sql = fs.readFileSync(path.join(TESTS, file), 'utf8')
    process.stdout.write(`${file}\n`)
    try {
      const result = await client.query(sql)
      // The suite is begin/…/rollback, so pg returns an array of results; the
      // TAP rows come from the statements that select from pgTAP functions.
      const sets = Array.isArray(result) ? result : [result]
      const rows = sets.flatMap((r) => r?.rows ?? [])
      const { lines, pass, failures } = parseTap(rows)
      if (!lines.length) {
        console.log('  no TAP output — check that the suite selects from pgTAP functions\n')
      }
      for (const line of lines) {
        if (/^not ok\b/.test(line)) console.log(`  FAIL  ${line}`)
      }
      totalPass += pass
      allFailures.push(...failures.map((f) => `${file}: ${f}`))
      console.log(`  ${pass} passed, ${failures.length} failed\n`)
    } catch (err) {
      console.log(`  ERROR  ${String(err.message).split('\n')[0]}\n`)
      allFailures.push(`${file}: ${err.message}`)
      // Every suite is begin/…/rollback on ONE shared connection, so a statement
      // that errors leaves the transaction aborted and every later file returns
      // "current transaction is aborted" — one broken file reported the other
      // three as broken too, and turned 72 passing assertions into "0 passed,
      // 4 failed". Clear it so each file's result is its own.
      try {
        await client.query('rollback')
      } catch {
        // Nothing to roll back; the file may have failed before its BEGIN.
      }
    }
  }

  await client.end()

  console.log(`${totalPass} assertion(s) passed, ${allFailures.length} failed`)
  if (allFailures.length) {
    console.log('\nFailures:')
    for (const f of allFailures) console.log(`  ${f}`)
    process.exitCode = 1
  }

  // Kept accurate per file rather than as one blanket disclaimer. The original
  // said every assertion was existence-only, which stopped being true once
  // business_date.test.sql landed — and a stale caveat is the same defect as a
  // stale claim of coverage, just pointing the other way.
  // Derived from the files, never hand-maintained. This paragraph was prose three
  // times in one day and went stale all three times — each time claiming the suite
  // proved less than it did, which is the same defect as claiming it proves more,
  // just pointing the other way. Each test file now declares its own level with a
  // `-- @proves: LEVEL | text` header, so the summary cannot drift from the suite.
  const declared = files.map((file) => {
    const text = fs.readFileSync(path.join(TESTS, file), 'utf8')
    const lines = [...text.matchAll(/^--\s*@proves:\s*([A-Z]+)\s*\|\s*(.*)$/gm)]
    return {
      file,
      level: lines[0]?.[1] ?? 'UNDECLARED',
      text: lines.map((m) => m[2].trim()),
    }
  })

  console.log('\nWhat these assertions do and do not prove:')
  for (const entry of declared) {
    const name = entry.file.replace(/\.test\.sql$/, '')
    console.log(`  ${name.padEnd(14)} ${entry.level}`)
    for (const line of entry.text) console.log(`  ${''.padEnd(14)} ${line}`)
  }

  // Only EXISTENCE counts as the gap BAR-030 names. PRIVILEGES is its own valid
  // category — inspecting granted privileges is a real check, and it caught two
  // live holes — it simply is not the thing BAR-030 asks to be replaced.
  const existenceOnly = declared.filter((e) => e.level === 'EXISTENCE').map((e) => e.file)
  if (existenceOnly.length) {
    console.log(
      `\nNot yet behavioural (BAR-030): ${existenceOnly.join(', ')}. A file is behavioural\n` +
        'when it exercises the rule and asserts the outcome, not when it asserts the\n' +
        'rule\'s object exists.\n',
    )
  } else {
    console.log('\nEvery suite is behavioural (BAR-030 complete).\n')
  }
}

main().catch((err) => {
  console.error(String(err.message ?? err))
  process.exit(1)
})

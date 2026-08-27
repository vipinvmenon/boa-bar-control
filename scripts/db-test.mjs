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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TESTS = path.join(ROOT, 'supabase', 'tests')

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('\nSUPABASE_DB_URL is not set.\n')
  console.error("  export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:6543/postgres'")
  console.error('  node scripts/db-test.mjs\n')
  console.error('Dashboard -> Settings -> Database -> Connection string (pooler / Session mode).')
  console.error('Never commit this value.\n')
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
  await client.connect()

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
    }
  }

  await client.end()

  console.log(`${totalPass} assertion(s) passed, ${allFailures.length} failed`)
  if (allFailures.length) {
    console.log('\nFailures:')
    for (const f of allFailures) console.log(`  ${f}`)
    process.exitCode = 1
  }

  console.log(
    '\nNote: these assertions check only that objects EXIST. None attempts an\n' +
      'UPDATE to prove the immutability trigger fires, and none connects as a role\n' +
      'to prove a policy works. Replacing them with behavioural tests is BAR-030.\n',
  )
}

main().catch((err) => {
  console.error(String(err.message ?? err))
  process.exit(1)
})

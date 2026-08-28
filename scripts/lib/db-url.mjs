/**
 * Build a PostgreSQL connection string for the linked Supabase project.
 *
 * Extracted from scripts/db-test.mjs so that scripts/bootstrap.mjs uses the same
 * logic rather than its own. It was not shared originally, and the second copy
 * immediately got it wrong: `supabase link` writes
 * `postgresql://user@host:port/db` with NO password segment, and the duplicate
 * assumed a `[YOUR-PASSWORD]` placeholder was present. It connected with no
 * password at all.
 *
 * Preferred usage: set only SUPABASE_DB_PASSWORD. The host and user already come
 * from `supabase link`, so the password is the only thing missing, and asking for
 * one value rather than a whole URL removes the copy-paste class of error.
 *
 * SUPABASE_DB_URL still works and takes precedence, for CI or a non-pooler host.
 */
import fs from 'node:fs'
import path from 'node:path'

const PLACEHOLDERS = ['YOUR_PASSWORD', 'YOUR-PASSWORD', '<password>', '@HOST', '<host>', '[YOUR-PASSWORD]']

export function resolveDbUrl({ root, command }) {
  const explicit = process.env.SUPABASE_DB_URL
  if (explicit) {
    // A leftover placeholder URL from an earlier attempt silently wins over a
    // correctly-set password, because this branch takes precedence. Catch it
    // rather than emitting a confusing DNS error.
    const hit = PLACEHOLDERS.find((p) => explicit.includes(p))
    if (hit) {
      return {
        url: null,
        error: [
          `SUPABASE_DB_URL still contains the placeholder "${hit}".`,
          'It is set in this shell from an earlier attempt, and it takes precedence',
          'over SUPABASE_DB_PASSWORD, so your password is being ignored.',
          '',
          '  unset SUPABASE_DB_URL',
          "  export SUPABASE_DB_PASSWORD='your-database-password'",
          `  ${command}`,
        ],
      }
    }
    return { url: explicit, error: null }
  }

  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) {
    return {
      url: null,
      error: [
        'No database credentials found.',
        '',
        'Set just the password — the host comes from `supabase link`:',
        '',
        '  read -s "SUPABASE_DB_PASSWORD?Database password: " && export SUPABASE_DB_PASSWORD',
        `  ${command}`,
        '',
        'Using `read -s` keeps it out of your shell history.',
        'Get it from the dashboard: Settings -> Database -> Database password.',
        '(Reset it there if you no longer have it.)',
        '',
        'Type the password yourself rather than pasting an example — a literal',
        "placeholder produces 'getaddrinfo ENOTFOUND HOST'.",
      ],
    }
  }

  const hit = PLACEHOLDERS.find((p) => password.includes(p))
  if (hit) {
    return {
      url: null,
      error: [`SUPABASE_DB_PASSWORD is the literal placeholder "${hit}", not a password.`],
    }
  }

  const poolerPath = path.join(root, 'supabase', '.temp', 'pooler-url')
  if (!fs.existsSync(poolerPath)) {
    return {
      url: null,
      error: [
        'SUPABASE_DB_PASSWORD is set, but supabase/.temp/pooler-url is missing.',
        'Run `node_modules/.bin/supabase link --project-ref <ref>` first,',
        'or set SUPABASE_DB_URL instead.',
      ],
    }
  }

  // postgresql://user@host:port/db  ->  postgresql://user:password@host:port/db
  // The file holds no password, which is why it is safe for `supabase link` to
  // write it into the working tree.
  const pooler = fs.readFileSync(poolerPath, 'utf8').trim()
  return { url: pooler.replace('@', `:${encodeURIComponent(password)}@`), error: null }
}

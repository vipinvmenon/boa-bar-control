#!/usr/bin/env node

/** Apply BAR-064 without requiring the Supabase CLI. Credentials stay in env. */
import { Client } from 'pg'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { resolveDbUrl } from './lib/db-url.mjs'

const root = process.cwd()
const { url, error } = resolveDbUrl({ root, command: 'node scripts/apply-top-up-migration.mjs' })
if (error) {
  error.forEach((line) => console.error(line ? `  ${line}` : ''))
  process.exit(2)
}

const migration = path.join(root, 'supabase/migrations/202609010001_top_up_requests.sql')
const sql = await fs.readFile(migration, 'utf8')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  await client.query(sql)
  console.log('BAR-064 migration applied: 202609010001_top_up_requests.sql')
} finally {
  await client.end().catch(() => {})
}

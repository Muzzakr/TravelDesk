import fs from 'node:fs'
import path from 'node:path'

// Guardrail: this suite creates real records (travel requests, expenses)
// and has previously been pointed at real production Supabase data (see
// e2e/README.md). Playwright's own process doesn't get Next.js's automatic
// .env.local loading, so we parse the file directly here to check what the
// app (spawned via webServer) is actually about to connect to, and refuse
// to run at all unless it's a local database.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const envPath = path.resolve(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) return ''

  const match = fs.readFileSync(envPath, 'utf-8').match(/^DATABASE_URL=(.*)$/m)
  return match?.[1]?.trim() ?? ''
}

export default async function globalSetup() {
  const url = resolveDatabaseUrl()
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    // unparsable — falls through to the failure below
  }

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal) {
    throw new Error(
      `\n\nRefusing to run e2e tests: DATABASE_URL host is "${host || '(unset/unparsable)'}", not localhost.\n` +
        `This suite creates real travel requests/expenses and is unsafe to run against Supabase\n` +
        `or any non-local database. Point DATABASE_URL in .env.local at your local Postgres\n` +
        `(see README.md for the docker run command) before running e2e tests.\n`,
    )
  }
}

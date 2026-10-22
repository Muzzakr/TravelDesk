# Security Policy

This is an internal, multi-tenant application, not a published library — the "Supported Versions" template GitHub scaffolds by default doesn't apply here, so this file describes what's actually sensitive in this codebase and how it's protected instead.

## What's sensitive here

- **Traveler PII** — passport numbers, passport/license expiry dates, date of birth, home address, driver's license number (`TravelerProfile`).
- **Financial data** — expense receipts, corporate card transactions, payout reports.
- **Auth secrets** — password hashes, SSO client secrets, MFA backup codes, magic-link/invite tokens.
- **Cross-company isolation** — every table above carries a `companyId`. The single most serious class of bug this app can have is a missing `companyId` filter that leaks one company's data into another's view. See `ARCHITECTURE.md`. This is not theoretical: a full audit on 2026-10-22 found and fixed a real instance on the travel-request create/edit routes, where an `employeeId`/`managerId`/`agentId` supplied in the request body was used in a write or an email/notification lookup with no check that it belonged to the caller's company — see `CHANGELOG.md`, 2026-10-22.

## How secrets are protected

- **Passwords**: bcrypt-hashed, never stored or logged in plaintext.
- **SSO client secrets**: AES-256-GCM encrypted at rest (`src/lib/crypto/secret-box.ts`), because unlike a password these have to be decrypted again later to make outbound calls. The encryption key (`APP_ENCRYPTION_KEY`) lives only in environment variables, never in code or migrations.
- **MFA backup codes / verification tokens**: hashed one-way, same as passwords.
- **File access** (receipts, profile/passport photos): served via short-lived Supabase signed URLs, not permanent public links. Company logos are the one deliberate exception — public by design, since a logo needs to display without auth.
- **Database access**: Row Level Security is enabled on every table in the production Supabase database (zero policies — blocks Supabase's own auto-exposed PostgREST API entirely; the app itself is unaffected since Prisma connects as the Postgres table-owner role, which bypasses RLS by default). This closed a real, confirmed exposure — before the 2026-10-22 fix, every table (including `User.passwordHash`) was readable over the public internet with just the project's anon key, no other credentials. See `CHANGELOG.md`, 2026-10-22, for exactly how this was found and verified fixed. If you ever provision a new Supabase project for this app, enabling RLS on every table is a required step, not optional hardening.
- **Environment separation**: local, CI, and production each hold entirely separate secret values — a leak in one environment does not expose another. See the "Environment Variables" walkthrough in project chat history / `CLAUDE.md` for the full reasoning. Local secrets live only in `.env.local`, which is gitignored and must never be committed.

## Reporting a vulnerability

This is a private/internal project rather than a public open-source one soliciting external reports. If you find a security issue, report it directly to the repository owner rather than opening a public issue — a public issue on a real vulnerability is itself a disclosure. Include what you found, how to reproduce it, and its potential impact (especially whether it crosses company boundaries).

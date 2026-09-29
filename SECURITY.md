# Security Policy

This is an internal, multi-tenant application, not a published library — the "Supported Versions" template GitHub scaffolds by default doesn't apply here, so this file describes what's actually sensitive in this codebase and how it's protected instead.

## What's sensitive here

- **Traveler PII** — passport numbers, passport/license expiry dates, date of birth, home address, driver's license number (`TravelerProfile`).
- **Financial data** — expense receipts, corporate card transactions, payout reports.
- **Auth secrets** — password hashes, SSO client secrets, MFA backup codes, magic-link/invite tokens.
- **Cross-company isolation** — every table above carries a `companyId`. The single most serious class of bug this app can have is a missing `companyId` filter that leaks one company's data into another's view. See `ARCHITECTURE.md`.

## How secrets are protected

- **Passwords**: bcrypt-hashed, never stored or logged in plaintext.
- **SSO client secrets**: AES-256-GCM encrypted at rest (`src/lib/crypto/secret-box.ts`), because unlike a password these have to be decrypted again later to make outbound calls. The encryption key (`APP_ENCRYPTION_KEY`) lives only in environment variables, never in code or migrations.
- **MFA backup codes / verification tokens**: hashed one-way, same as passwords.
- **File access** (receipts, profile/passport photos): served via short-lived Supabase signed URLs, not permanent public links. Company logos are the one deliberate exception — public by design, since a logo needs to display without auth.
- **Environment separation**: local, CI, and production each hold entirely separate secret values — a leak in one environment does not expose another. See the "Environment Variables" walkthrough in project chat history / `CLAUDE.md` for the full reasoning. Local secrets live only in `.env.local`, which is gitignored and must never be committed.

## Reporting a vulnerability

This is a private/internal project rather than a public open-source one soliciting external reports. If you find a security issue, report it directly to the repository owner rather than opening a public issue — a public issue on a real vulnerability is itself a disclosure. Include what you found, how to reproduce it, and its potential impact (especially whether it crosses company boundaries).

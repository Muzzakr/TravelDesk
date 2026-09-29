# Architecture

How TravelDesk actually works, beyond the tech-stack summary in `README.md`.

## Multi-tenancy

Every company that signs up gets one `Company` row. Every other table that matters (`User`, `Event`, `TravelRequest`, `Expense`, `PayoutReport`, etc.) carries a `companyId`, and every query must be scoped by it. There is no shared data between companies anywhere in the product — this is the single most important invariant in the codebase.

## Roles

| Role | Access |
|---|---|
| `EMPLOYEE` | Submit travel requests and expenses |
| `MANAGER` | Approve/reject requests and expenses |
| `TRAVEL_MANAGER` | Same approval powers as `MANAGER`, plus can complete a booking inline immediately after approving (see `manager/approvals/travel/[id]/page.tsx`) — this is a real, separate role, not a synonym for `MANAGER` |
| `TRAVEL_AGENT` | Books trips, provides booking options |
| `FINANCE_ADMIN` | Payout reports, spend analytics, policy |
| `SYSTEM_ADMIN` | Full access — users, events, audit log, gets the same inline-booking power as `TRAVEL_MANAGER` |

## The travel request lifecycle

`TravelRequestStatus`: `DRAFT → SUBMITTED → PENDING_AGENT / PENDING_MANAGER → PENDING_ADMIN → OPTIONS_PROVIDED → APPROVED → BOOKING_CONFIRMED`, with `REJECTED`/`CANCELLED` as exits at most stages.

Which of `PENDING_AGENT` or `PENDING_MANAGER` comes first (or both, or neither) is controlled per-request by `RoutingPath`:
- `AGENT_FIRST` — agent proposes options before manager sees it
- `MANAGER_FIRST` — manager approves before the agent gets involved
- `PARALLEL` — both simultaneously
- `MANAGER_ONLY` — no agent step; a `TRAVEL_MANAGER`/`SYSTEM_ADMIN` approver completes the booking themselves inline (this is why that role distinction above matters)

## The expense lifecycle

`ExpenseStatus`: `DRAFT → SUBMITTED → UNDER_REVIEW → PENDING_ADMIN → APPROVED/REJECTED → PAID`. `PENDING_ADMIN` is reached via "Ask Admin" — an escalation signal, not an access restriction; the same manager who escalated can also resolve it later once admin input isn't actually needed. `ExpenseType` distinguishes `OUT_OF_POCKET` (needs a payout) from `CORPORATE_CARD` (reconciled against `CardTransaction`, not paid out separately).

## Auth — four ways in, one session model

All backed by NextAuth v5 (`src/lib/auth.ts`):
1. **Password** — standard credentials, bcrypt-hashed.
2. **Google OAuth** — requires the user's email to already exist and be verified.
3. **Magic link** — a `VerificationToken` (`TokenType.MAGIC_LINK`) emailed to the user.
4. **Enterprise SSO (OIDC)** — one `CompanySsoConfig` per company (`src/lib/sso/oidc-client.ts`). The client secret is encrypted at rest with AES-256-GCM (`src/lib/crypto/secret-box.ts`, key from `APP_ENCRYPTION_KEY`) since, unlike a password hash, it has to be decrypted again later to make outbound token-exchange calls. If a company sets `enforced: true`, password/Google sign-in are blocked for that company's users as a backstop, even for tokens issued before enforcement was turned on.

## Storage — three Supabase buckets, deliberately different visibility

All file storage goes through `src/lib/storage.ts`, which hardcodes three bucket names (not an env var):
- **`receipts`** (private) — expense receipts, accessed via short-lived signed URLs
- **`profiles`** (private) — profile/passport/driver's-license photos, also signed URLs
- **`logos`** (**public**) — company logos, using a permanent public URL by design, since a logo is meant to display without auth

## Notifications — two layers

`EmailNotificationSetting` is company-wide (an admin turns a notification type on/off for everyone). `UserNotificationSetting` sits on top of it — an individual can additionally mute a type for themselves. Absence of a row means "enabled" in both tables, so most users have zero rows in either.

## Outbound webhooks

One `WebhookSubscription` per company (URL + secret + which event types it wants). Every send attempt is logged in `WebhookDelivery` with a status (`PENDING`/`SENT`/`FAILED`) and retry count; `api/cron/webhook-retry` retries failed deliveries on a schedule (see `vercel.json`).

## A feature that used to exist and doesn't anymore

**Travel Inbox** (Slack Events API — employees posting travel requests as Slack messages, parsed automatically) was removed from the original repo and, following that decision, removed here too. If you see references to `InboxChannel`/`InboxStatus`/`TravelInboxMessage` in old migration files, that's expected history, not a bug — see `CHANGELOG.md` for exactly when and why.

## Database

PostgreSQL via Prisma. Local dev uses a Docker Postgres container; production uses Supabase's Postgres (pooled connection for `DATABASE_URL`, direct connection for `DIRECT_URL` — required for migrations to work correctly through Supabase's connection pooler). See `CLAUDE.md` for the schema-drift guardrail before touching `schema.prisma`.

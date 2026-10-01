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

A few role-specific behaviors worth knowing, verified directly in code rather than assumed:
- **Travel Agent**: `agent/requests/[id]` and the Travel Manager/Admin inline-booking form (above) share the *same* "Complete booking" component — not a separate implementation per role. `agent/book` reuses the employee's own travel-request wizard, letting an agent create/book a trip directly on an employee's behalf.
- **Finance Admin**: marking an expense `PAID` lives on the expense's own detail page specifically, not as a bulk action from the list — a deliberate choice noted in the code itself.
- **System Admin**: the *only* role with `/admin` access at all — even `TRAVEL_MANAGER` is excluded from it, unlike every other section of the app (`src/middleware.ts` `ROLE_PATHS`).
- Every query everywhere is scoped by `companyId` — a Manager only ever sees their own company's data, regardless of how similar the UI looks across tenants.

## The travel request lifecycle

**The submission wizard** (`employee/travel-requests/new`) is 4 steps plus an optional 5th: **1. Select Event**, **2. Select Services** (Flights / Hotels / Car Rentals / Taxis, or "Agent Chooses"), **3. Service Forms** (one per service picked), **4. Review & Submit** — the request is actually created here. **5. AI Options** (optional, post-submission) — the employee can still express preferred vendors after submitting; explicitly non-blocking. A real gate sits in front of step 1: if the employee's `TravelerProfile` is incomplete (name/phone/passport number/expiry), the wizard never loads at all — they're redirected to their profile first (`src/lib/profile-check.ts`).

`TravelRequestStatus`: `DRAFT → SUBMITTED → PENDING_AGENT / PENDING_MANAGER → PENDING_ADMIN → OPTIONS_PROVIDED → APPROVED → BOOKING_CONFIRMED`, with `REJECTED`/`CANCELLED` as exits at most stages. The employee can only edit their own request *before* manager approval — enforced in the API, not just convention.

Which of `PENDING_AGENT` or `PENDING_MANAGER` comes first (or both, or neither) is decided automatically by `src/lib/routing-engine.ts` (`determineRoutingPath`), in this exact priority order:
1. Requester is themselves a `TRAVEL_MANAGER` → `MANAGER_ONLY` (books their own trip end-to-end)
2. None of the requested services need booking (e.g. taxi-only) → `MANAGER_ONLY`
3. Departure is ≤72 hours away → `PARALLEL` (urgency overrides everything else below)
4. Estimated cost is ≥$1,500 → `MANAGER_FIRST`
5. Otherwise → `AGENT_FIRST` (the default case)

- `AGENT_FIRST` — agent proposes options before manager sees it
- `MANAGER_FIRST` — manager approves before the agent gets involved
- `PARALLEL` — both simultaneously
- `MANAGER_ONLY` — no agent step; a `TRAVEL_MANAGER`/`SYSTEM_ADMIN` approver completes the booking themselves inline (this is why that role distinction above matters — a plain `MANAGER` approving the same request does not get this inline form)

Rejection always requires a note (`rejectionNote`) — the API refuses a rejection without one. "Ask Admin" (`PENDING_ADMIN`) works the same way here as it does for expenses below: an escalation signal, not an access restriction.

## The expense lifecycle

`ExpenseStatus`: `DRAFT → SUBMITTED → UNDER_REVIEW → PENDING_ADMIN → APPROVED/REJECTED → PAID`. `PENDING_ADMIN` is reached via "Ask Admin" (notifies **every** active System Admin in the company) — an escalation signal, not an access restriction; the same manager who escalated can also resolve it later once admin input isn't actually needed.

**Policy checks run automatically on submission** (`src/lib/policy-engine.ts`, configurable per company but these are the defaults): missing a receipt on an expense ≥$25 is a **BLOCK**; an amount over $500 is a **WARNING** requiring Finance Admin approval; specific expense categories can be company-configured as blocked or flagged. A separate, independent check compares the expense's event against that event's budget cap (warn at 80%, block at 100%, both configurable).

Once `APPROVED`, a Finance Admin (or Manager/Travel Manager/System Admin) marks it `PAID` — deliberately from the expense's own detail page, not a bulk list action. Once `PAID`, an expense can **never** be modified again, by anyone, for any reason — enforced even against the escalation path (there's a dedicated test proving this).

`ExpenseType` distinguishes `OUT_OF_POCKET` (needs a payout) from `CORPORATE_CARD` — **correction to an earlier version of this doc**: `CORPORATE_CARD` expenses are *not* reconciled against `CardTransaction`. They're a completely separate mechanism: `src/app/api/travel-requests/[id]/confirm/route.ts` auto-creates a `DRAFT` `CORPORATE_CARD` expense the moment a travel booking is confirmed, representing what the Travel Agent already paid for during booking (a flight, hotel, etc.), created directly via Prisma, never through the employee expense wizard — the wizard (`src/components/expenses/NewExpenseForm.tsx`) has never exposed `expenseType` as a selectable field at all. See "Card transaction reconciliation" below for the actual, unrelated system that talks to `CardTransaction`.

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

## Card transaction reconciliation

A deliberately **separate system from Expense** — see the correction above. Company/fleet card charges are already paid for; there's no reimbursement and no `PAID` status anywhere in this flow. What's needed instead is just: which event was this for, and a receipt, so Finance can reconcile the weekly card statement.

**Data model**: `CardTransaction` (`cardId`+`cardLastFour` identify the physical card; `receiptKey`/`category`/`vehicle` from the statement; `voidedAt` is a *soft*-void, never a hard delete — deleting would cascade-destroy the review audit trail below, and this app already treats finalized financial records like `PAID` expenses as permanent). `CardMapping` — one physical card mapped once to an employee, reused by every future import, retroactive to already-imported unassigned transactions. `CardTransactionReview` — see below.

**Weekly import** (`src/lib/card-import.ts`, Finance-facing, `finance/cards` "Import statement"): the source file has no native transaction ID, no employee email, and often a blank "Employee ID" column — only `Card ID` + `Card Last Four` is a reliable identity, which is why `CardMapping` exists at all. Finance always uploads the trailing ~30 days (deliberately overlapping the previous upload), so the import logic is pure and fully unit-tested (`tests/card-import.test.ts`), matching `routing-engine.ts`'s style:
- Only `Status = Completed` and `Type = Purchase` rows count — declined attempts and card-balance payoffs aren't purchases to reconcile.
- A synthetic, deterministic transaction ID (hash of date+time+card+merchant+amount) makes re-uploading the same statement idempotent — exact matches are silently skipped, never duplicated.
- Two edge cases never auto-resolve, they queue a `CardTransactionReview` for a human decision instead: the same transaction reappearing with a **different amount** (`AMOUNT_MISMATCH`), or a previously-imported transaction **missing** from a statement window that should cover it (`MISSING_IN_STATEMENT`). Re-uploading an unresolved discrepancy never spawns a second review for it.
- Parsing uses `xlsx` (already a dependency elsewhere), not a naive `split(',')` — real rows have quoted commas. One real gotcha: `xlsx`'s default CSV mode silently converts date-looking text into Excel serial numbers; `cellText: true` + `raw: false` is required to get the literal source string back.

**Employee self-service** (`employee/card-charges`): an employee sees only their own charges still missing an event and/or receipt, fills in either independently or together. `PENDING_TAG` (nothing set) → `TAGGED` (event set) → `SUBMITTED` (event + receipt both present) → `MATCHED` (Finance reviews and manually confirms — not automatic). Finance keeps manual tag/receipt-entry as a fallback for anything not self-served. Every assignment pathway (import auto-assign via `CardMapping`, a mapping applied retroactively, Finance's manual tag) fires the same `notifyCardChargesAssigned()` helper — in-app + email, batched one notification per employee rather than one per transaction.

**A real bug worth remembering**: Prisma's `Decimal` serializes over JSON as a **string** (`"72.95"`, not `72.95`) — every `amountUsd` must be wrapped in `Number(...)` before calling `.toFixed()` on it client-side, or it throws at render time. Caught this the hard way in the review-queue UI; the original transactions table already guarded against it everywhere.

## A feature that used to exist and doesn't anymore

**Travel Inbox** (Slack Events API — employees posting travel requests as Slack messages, parsed automatically) was removed from the original repo and, following that decision, removed here too. If you see references to `InboxChannel`/`InboxStatus`/`TravelInboxMessage` in old migration files, that's expected history, not a bug — see `CHANGELOG.md` for exactly when and why.

## Database

PostgreSQL via Prisma. Local dev uses a Docker Postgres container; production uses Supabase's Postgres (pooled connection for `DATABASE_URL`, direct connection for `DIRECT_URL` — required for migrations to work correctly through Supabase's connection pooler). See `CLAUDE.md` for the schema-drift guardrail before touching `schema.prisma`.

# End-to-end tests (Playwright)

These tests drive the real app in a real Chromium browser — logging in,
clicking through wizards, submitting forms — the way a user actually
would. They're a different layer from the 86 Jest tests in the repo:
Jest covers business logic and role permissions in isolation; these
cover whether the UI itself is actually wired up correctly (a broken
button, a dropdown that never opens, a race between a click and a
navigation — none of that would be caught by a unit test).

## Running

```
npm run test:e2e        # headless, list reporter
npm run test:e2e:ui     # interactive UI mode — best for debugging
```

Playwright starts `npm run dev` automatically if it isn't already
running (see `webServer` in `playwright.config.ts`), and reuses an
already-running dev server if you have one up on port 3003.

## What this runs against

**Local only — enforced.** `e2e/global-setup.ts` reads `DATABASE_URL`
before any test runs and throws immediately if its host isn't
`localhost`/`127.0.0.1`/`::1`. This suite creates real travel requests
and expenses, and it used to run against a real Supabase production
company (`m4uevents`, with a real person's login and a hardcoded real
event code) with nothing stopping it from being pointed at production
by accident. That's no longer possible — the run simply refuses to
start against anything but a local database.

**Known follow-up:** the spec files and `e2e/helpers.ts` still
reference that original real-world data (`COMPANY_SLUG = 'm4uevents'`,
`mustimboss11@gmail.com`, `EVENT_CODE = '460455'`), none of which
exists in the local seeded database (`prisma/seed.ts` creates company
slug `m4ueventsm` with different accounts and events). The safety
guard above stops these tests from ever touching production, but as a
result **the specs will currently fail to log in / find the event
locally** until `helpers.ts` is updated to point at the local seed
data instead. That rewrite is a separate task from the safety fix.

Tests create new travel requests and expenses on every run (each
tagged with a unique `E2E-<timestamp>` in its description/notes)
rather than mutating or deleting anything existing. Nothing here
deletes data.

## Not wired into CI

Deliberately local-only for now — no GitHub Actions job runs this
suite. Wiring it into CI would mean putting a real Supabase/auth
connection string and this suite's credentials into GitHub Secrets,
which is a bigger step than "add a test file" and wasn't part of this
round. `.github/workflows/ci.yml` only runs typecheck/jest/build.

## Why some waits look unusual

The event-picker combobox (`EventCombobox` in both the travel-request
and expense wizards) only evaluates its data at the moment the input
is focused, and doesn't reopen on its own once data finishes loading
after that. `selectEvent()` in `helpers.ts` works around this by
blurring and re-focusing the input in a retry loop until the target
option actually renders — see the comments there for the exact
timing pitfall (a stale `onBlur`-scheduled close can fire right after
a fresh click reopens the dropdown).

Several assertions also use more generous timeouts than you'd
normally expect. This dev environment (project directory synced by
OneDrive) has unusually slow and sometimes unstable request timing —
individual API calls have been observed taking anywhere from under a
second to 20+ seconds. The timeouts in `playwright.config.ts` and in
individual specs are set generously to absorb that rather than fail
on environment noise unrelated to the app.

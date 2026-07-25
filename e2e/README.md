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

**Local only, real data.** These tests run against your local dev
server and the real Supabase database from your `.env` — specifically
the `m4uevents` company, which has been the standing manual-testing
company throughout this project. There's no separate seeded test
company; that was a deliberate choice (see the project decision this
came out of) to test against realistic, messy production-shaped data
rather than a pristine fixture.

Two identities are used:

- **Employee** — `mustimboss11@gmail.com`, Mustafa's long-standing
  real test account in `m4uevents`.
- **Travel Manager** — `e2e.approver@m4uevents.test`, a dedicated
  `TRAVEL_MANAGER` account created specifically for this suite, so
  the tests never need a real person's password. Credentials are in
  `e2e/helpers.ts`.

`EVENT_CODE = '460455'` (`e2e/helpers.ts`) is a real, active event in
`m4uevents` used as a stable target for the event-picker in both the
travel-request and expense wizards, so the tests don't depend on
whatever happens to be first/last in the event list.

Because this hits real data, tests create new travel requests and
expenses on every run (each tagged with a unique `E2E-<timestamp>` in
its description/notes) rather than mutating or deleting anything
existing. Nothing here deletes data.

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

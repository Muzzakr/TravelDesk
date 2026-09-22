import { type Page, expect } from '@playwright/test'

// Real accounts in the m4uevents company. Mustafa is the long-standing
// test employee; "E2E Test Manager" is a dedicated TRAVEL_MANAGER account
// created for this suite so no real person's credentials are used.
export const COMPANY_SLUG = 'm4uevents'

export const EMPLOYEE = {
  email: 'mustimboss11@gmail.com',
  password: 'Password123!',
}

export const APPROVER = {
  email: 'e2e.approver@m4uevents.test',
  password: 'E2eTest123!',
}

// A stable event known to exist in the company (see e2e/README.md for how
// this was found). Used to avoid depending on event list ordering.
export const EVENT_CODE = '460455'

// Unique per test run so repeated runs don't collide when asserting "find
// the row I just created" among other rows created by earlier runs.
export function runId(): string {
  return `E2E-${Date.now()}`
}

export async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto('/login')
  // name-attribute selectors, not getByLabel: the Input component appends
  // a "*" to required labels' accessible text, and the show/hide-password
  // toggle button's aria-label ("Show password") also matches "Password"
  // under Playwright's default substring/case-insensitive getByLabel.
  await page.locator('input[name="companySlug"]').fill(COMPANY_SLUG)
  await page.locator('input[name="email"]').fill(creds.email)
  await page.locator('input[name="password"]').fill(creds.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  // Each role redirects to a different home via an intermediate
  // /auth/redirect hop — wait for that second, role-based redirect to
  // actually land rather than just leaving /login, since /auth/redirect
  // itself can be slow to compile/resolve on this dev server.
  await page.waitForURL((url) => !url.pathname.startsWith('/login') && url.pathname !== '/auth/redirect', {
    timeout: 30_000,
  })
}

// The event-search comboboxes (travel request + expense wizards) are built
// on the accessible Combobox (src/components/ui/Combobox.tsx, downshift-
// based) — results are `role="option"` rows, not plain buttons, and the
// list re-filters from whatever `items` prop is current on every render,
// so (unlike the old hand-rolled version) there's no focus-time race to
// work around. Still generous on timeout: this dev server's cold compiles
// and the initial events fetch can both take several seconds.
export async function selectEvent(page: Page, searchPlaceholder: string, matchText: string | RegExp) {
  const input = page.getByPlaceholder(searchPlaceholder)
  const option = page.getByRole('option', { name: matchText })
  await input.click()
  await expect(option).toBeVisible({ timeout: 20_000 })
  await option.click()
}

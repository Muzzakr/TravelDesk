import { test, expect } from '@playwright/test'
import { login, selectEvent, EMPLOYEE, APPROVER, EVENT_CODE, runId } from './helpers'

test('employee creates a travel request, travel manager approves and books it', async ({ page, browser }) => {
  const id = runId()
  const dropoff = `${id} Dropoff`

  // ── Employee: create the request ──────────────────────────────────────
  await login(page, EMPLOYEE)
  await page.goto('/employee/travel-requests/new')

  // Step 1 — Event
  await selectEvent(page, 'Search events…', new RegExp(EVENT_CODE))
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 2 — Services (Taxi needs no airport/hotel autocomplete data,
  // keeping this flow independent of what test data exists)
  await page.getByRole('button', { name: 'Taxi / Transfer' }).click()
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 3 — Details
  const locationInputs = page.getByPlaceholder('Search location…')
  await locationInputs.nth(0).fill('Stockholm Arlanda Airport')
  await locationInputs.nth(1).fill(dropoff)
  await page.getByTitle('Date').fill('12/15/2026')
  await page.locator('input[type="time"]').fill('14:30')
  await page.getByPlaceholder(/purpose of trip|client visit/i).fill(`E2E test run ${id}`)
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 4 — Review & submit
  await page.getByRole('button', { name: 'Submit request' }).click()

  // Step 5 confirms the request was actually created server-side
  await expect(page.getByText('Select your preferred options')).toBeVisible({ timeout: 15_000 })

  // Find the request we just made to get its id for the approver. The
  // desktop viewport renders both the sm:hidden mobile cards (hidden, but
  // still in the DOM) and the desktop table — filter to the visible one.
  await page.goto('/employee/travel-requests')
  await page.getByText(dropoff, { exact: false }).filter({ visible: true }).first().click()
  // The row click triggers client-side navigation (router.push) which is
  // async — reading page.url() right after click() races it, especially
  // on this slow dev server. Wait for the URL to actually land first.
  await page.waitForURL(/\/employee\/travel-requests\/[^/]+$/, { timeout: 30_000 })
  const requestId = page.url().split('/').pop()
  expect(requestId).toBeTruthy()

  // ── Travel Manager: approve, then send booking info ─────────────────
  const approverContext = await browser.newContext()
  const approverPage = await approverContext.newPage()
  await login(approverPage, APPROVER)
  await approverPage.goto(`/manager/approvals/travel/${requestId}`)

  // The dropoff text appears twice on the review page (route summary + notes)
  await expect(approverPage.getByText(dropoff, { exact: false }).first()).toBeVisible()
  await approverPage.getByRole('button', { name: 'Approve', exact: true }).click()
  await approverPage.getByRole('button', { name: 'Confirm Approval' }).click()

  // TRAVEL_MANAGER approval keeps them on the page with the booking form open
  await expect(approverPage.getByText('Complete booking')).toBeVisible({ timeout: 15_000 })
  await approverPage.getByPlaceholder('e.g. UA-2026-8472').fill(`E2E-CONF-${id}`)
  await approverPage.getByRole('button', { name: /Confirm & notify employee/ }).click()

  await expect(approverPage.getByText(/booking info sent/i)).toBeVisible({ timeout: 30_000 })
  await approverPage.reload()
  await expect(approverPage.getByText('BOOKING CONFIRMED')).toBeVisible({ timeout: 30_000 })

  await approverContext.close()
})

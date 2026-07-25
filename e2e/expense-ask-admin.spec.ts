import path from 'path'
import { test, expect } from '@playwright/test'
import { login, selectEvent, EMPLOYEE, APPROVER, EVENT_CODE, runId } from './helpers'

const RECEIPT = path.join(__dirname, 'fixtures', 'receipt.jpg')

test('travel manager escalates a trivial expense to admin, then resolves it', async ({ page, browser }) => {
  const id = runId()
  const description = `E2E Airport → hotel ${id}`

  // ── Employee: create and submit an expense ───────────────────────────
  await login(page, EMPLOYEE)
  await page.goto('/employee/expenses')
  await page.getByRole('button', { name: '+ Add expense' }).click()

  // Step 1 — Event
  await selectEvent(page, 'Search events…', new RegExp(EVENT_CODE))
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 2 — Type (Transport → Taxi; taxi auto-advances to step 3).
  // Each button's accessible name is "<emoji><label>" with no separating
  // space, so exact match would never hit — substring match instead.
  await page.getByRole('button', { name: 'Transport' }).click()
  await page.getByRole('button', { name: 'Taxi' }).click()

  // Step 3 — Details
  await page.getByPlaceholder('45.00').fill('42.50')
  await page.getByPlaceholder('E.g. Airport → hotel').fill(description)
  await page.getByPlaceholder('E.g. Client meeting, business travel').fill('E2E test expense')
  await page.locator('input[type="file"]').setInputFiles(RECEIPT)
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 4 — Review & save
  await page.getByRole('button', { name: 'Save expense' }).click()

  // Saving is a two-request chain (create expense, then upload the
  // receipt) and only clears the autosaved localStorage draft and closes
  // the wizard once both finish. Navigating away before that completes
  // aborts the in-flight receipt upload and leaves the draft uncleared,
  // which then reopens the wizard on the next load. Wait for the wizard
  // to actually close (the "+ Add expense" button reappearing) first.
  await page.getByRole('button', { name: '+ Add expense' }).waitFor({ state: 'visible', timeout: 30_000 })

  // Same visible-vs-hidden duplicate as the travel-request list: desktop
  // viewport keeps the sm:hidden mobile card in the DOM, just not visible.
  const listedExpense = page.getByText(description).filter({ visible: true }).first()
  await expect(listedExpense).toBeVisible({ timeout: 30_000 })
  await listedExpense.click()
  // The row click triggers client-side navigation (router.push) which is
  // async — reading page.url() right after click() races it, especially
  // on this slow dev server. Wait for the URL to actually land first.
  await page.waitForURL(/\/employee\/expenses\/[^/]+$/, { timeout: 30_000 })
  const expenseId = page.url().split('/').pop()
  expect(expenseId).toBeTruthy()

  // ── Travel Manager: ask admin instead of deciding ────────────────────
  const approverContext = await browser.newContext()
  const approverPage = await approverContext.newPage()
  await login(approverPage, APPROVER)
  await approverPage.goto(`/manager/approvals/expense/${expenseId}`)

  const row = approverPage.getByTestId(`expense-row-${expenseId}`)
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Ask Admin' }).click()
  await approverPage
    .getByPlaceholder("What's unclear or trivial about these expenses?")
    .fill(`E2E: is this really needed? ${id}`)
  await approverPage.getByRole('button', { name: 'Submit decisions' }).click()

  // Submitting redirects to /finance/expenses — go back to confirm the status
  await approverPage.waitForURL(/\/finance\/expenses/, { timeout: 45_000 })
  await approverPage.goto(`/manager/approvals/expense/${expenseId}`)
  // Scoped to this row — other pending expenses (from earlier runs) may
  // also carry an "Asked Admin" badge.
  await expect(approverPage.getByTestId(`expense-row-${expenseId}`).getByText('Asked Admin')).toBeVisible()

  // ── Same reviewer resolves the escalation (mirrors travel requests:
  //    Ask Admin is a status signal, not an access restriction) ────────
  const resolvedRow = approverPage.getByTestId(`expense-row-${expenseId}`)
  await resolvedRow.getByRole('button', { name: 'Approve', exact: true }).click()
  await approverPage.getByRole('button', { name: 'Submit decisions' }).click()
  await approverPage.waitForURL(/\/finance\/expenses/, { timeout: 45_000 })

  await approverPage.goto(`/manager/approvals/expense/${expenseId}`)
  await expect(approverPage.getByText('Already decided', { exact: true })).toBeVisible()
  // Scoped to this expense — other already-decided expenses (from earlier
  // runs) may also show an APPROVED badge.
  const decidedRow = approverPage.getByTestId(`expense-decided-${expenseId}`)
  await expect(decidedRow).toBeVisible()
  await expect(decidedRow.getByText('APPROVED')).toBeVisible()

  await approverContext.close()
})

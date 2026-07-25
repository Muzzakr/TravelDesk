import { test, expect } from '@playwright/test'
import { login, EMPLOYEE, APPROVER } from './helpers'

test('employee logs in and lands on their dashboard', async ({ page }) => {
  await login(page, EMPLOYEE)
  await expect(page).toHaveURL(/\/employee/)
})

test('travel manager logs in and lands on the manager dashboard', async ({ page }) => {
  await login(page, APPROVER)
  await expect(page).toHaveURL(/\/manager/)
})

test('wrong password shows an error and does not navigate away from login', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[name="companySlug"]').fill('m4uevents')
  await page.locator('input[name="email"]').fill(EMPLOYEE.email)
  await page.locator('input[name="password"]').fill('definitely-wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

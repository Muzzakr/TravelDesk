import { defineConfig, devices } from '@playwright/test'

// Local-only for now: no CI wiring, runs against your local dev server
// and the real Supabase database from your .env (see e2e/README.md).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared DB state — flows run one at a time
  retries: 0,
  workers: 1,
  reporter: 'list',
  // The project lives in a OneDrive-synced folder, which makes Next.js dev
  // cold-compiles (first hit of each route) unpredictably slow — sometimes
  // seconds, sometimes 10s+. These budgets are generous to absorb that
  // rather than fail on environment slowness unrelated to the app itself.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

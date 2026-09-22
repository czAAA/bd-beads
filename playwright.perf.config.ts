import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

/**
 * The performance check (ticket 103), run by hand with `npm run perf` and never in CI: timings on a shared runner are
 * too noisy to gate on. It drives the production build at a chosen CPU slowdown and prints a table.
 */
export default defineConfig({
  testDir: './e2e/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1900, height: 1200 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  webServer,
})

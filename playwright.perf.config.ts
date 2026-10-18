import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

/** The performance check (ticket 103), by hand with `npm run perf`, never in CI (shared-runner timings are too noisy
 * to gate on). */
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
    // The offline shell's worker (ticket 69) would serve the measured build from its cache.
    serviceWorkers: 'block',
  },
  webServer,
})

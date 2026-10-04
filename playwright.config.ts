import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

/**
 * The visual check (ticket 103): fixture Projects rendered in a real browser and compared with committed reference
 * screenshots. `npm run visual` runs it; `npm run visual:update` rewrites the references, which is only right when the
 * look is meant to change. The performance check has its own config (playwright.perf.config.ts).
 */
export default defineConfig({
  testDir: './e2e/visual',
  // One folder of references, the same on every machine: they are made and checked on Linux, the platform CI runs.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Workers per runner: CI sets VISUAL_WORKERS from the workflow's measured choice (ticket 257); locally Playwright picks.
  workers: process.env.VISUAL_WORKERS ? Number(process.env.VISUAL_WORKERS) : undefined,
  // On CI each shard writes a blob report; the workflow's last job merges them into one HTML report.
  reporter: process.env.CI ? [['list'], ['blob']] : 'list',
  use: {
    baseURL,
    viewport: { width: 1900, height: 1500 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-US',
  },
  expect: {
    toHaveScreenshot: {
      // How far apart two pixels' colors may be before they count as different at all: absorbs anti-aliasing. How many
      // pixels may differ is set per screenshot, in proportion to the size of a bead (see e2e/visual/tolerance.ts).
      threshold: 0.1,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  // The hover text check's reachability guard (ticket 264) needs every language-and-width test's result, so it runs after them all.
  globalTeardown: './e2e/support/hoverTeardown.ts',
  webServer,
})

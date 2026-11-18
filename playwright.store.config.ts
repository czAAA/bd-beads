import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

/** The installed app's PNG icons and store screenshots (ticket 1057), remade by hand with `npm run store:images`,
 * never in CI. It writes into public/; commit what changed. */
export default defineConfig({
  testDir: './e2e/store',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/store',
  use: {
    baseURL,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    locale: 'en-US',
    launchOptions: { args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] },
  },
  webServer,
})

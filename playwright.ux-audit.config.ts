import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

/** The UX audit's screenshot walk (ticket 0815; plan: docs/research/ux-audit/00-plan.md), run by hand with
 * `npm run ux:walk -- <area>`, never in CI. The projects are the plan's devices; `scripts/ux-walk.sh` picks the two
 * reference ones for an area and all of them for `cross-cutting`. */

const IPAD_13_LANDSCAPE = { width: 1366, height: 1024 }
const MACBOOK_AIR = { width: 1470, height: 956 }
const FULL_HD = { width: 1920, height: 1080 }
const PHONE_PORTRAIT = { width: 390, height: 844 }

export default defineConfig({
  testDir: './e2e/ux-audit',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 15 * 60_000,
  reporter: 'list',
  outputDir: './ux-audit-output/.playwright',
  use: {
    baseURL,
    // A control that isn't there is a finding, not a reason to wait: fail the step fast and walk on.
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    deviceScaleFactor: 1,
    // The real thing, not the pixel-stable look the visual check pins: motion on, the device's own fonts.
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    locale: 'en-US',
    acceptDownloads: true,
  },
  projects: [
    // Reference device 1: iPad Air 13″ landscape, dark.
    { name: 'ipad13-dark', use: { viewport: IPAD_13_LANDSCAPE, colorScheme: 'dark', hasTouch: true } },
    // Reference device 2: MacBook Air 13″, light.
    { name: 'air-light', use: { viewport: MACBOOK_AIR, colorScheme: 'light' } },
    // Cross-cutting only.
    { name: 'ipad13-light', use: { viewport: IPAD_13_LANDSCAPE, colorScheme: 'light', hasTouch: true } },
    { name: 'air-dark', use: { viewport: MACBOOK_AIR, colorScheme: 'dark' } },
    { name: 'air-contrast', use: { viewport: MACBOOK_AIR, colorScheme: 'light', contrast: 'more' } },
    { name: 'fhd-light', use: { viewport: FULL_HD, colorScheme: 'light' } },
    { name: 'phone-light', use: { viewport: PHONE_PORTRAIT, colorScheme: 'light', hasTouch: true, isMobile: true } },
    { name: 'phone-dark', use: { viewport: PHONE_PORTRAIT, colorScheme: 'dark', hasTouch: true, isMobile: true } },
  ],
  webServer,
})

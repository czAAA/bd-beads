import { defineConfig } from '@playwright/test'
import { baseURL, webServer } from './e2e/support/server'

// The visual check (ticket 103): fixture Projects rendered in a real browser and compared with committed references.
// `npm run visual` runs it; `npm run visual:update` rewrites them (only when the look is meant to change). Perf has its
// own config.
/** The offline shell's checks, the longest spec by far: CI runs them as a part of their own (`VISUAL_PART=offline`) and
 * every other spec in the shards (`=rest`), so no shard carries them on top of its share (ticket 1143). Unset, as
 * locally, everything runs. A new spec needs no listing: it is one of the rest. */
const OFFLINE_SPEC = /offline\.spec\.ts$/
const part = process.env.VISUAL_PART

export default defineConfig({
  testDir: './e2e/visual',
  ...(part === 'offline' ? { testMatch: OFFLINE_SPEC } : {}),
  ...(part === 'rest' ? { testIgnore: OFFLINE_SPEC } : {}),
  // One folder of references, the same on every machine: they are made and checked on Linux, the platform CI runs.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Workers per runner: CI sets VISUAL_WORKERS from the workflow's measured choice (tickets 257, 1143); locally
  // Playwright picks.
  workers: process.env.VISUAL_WORKERS ? Number(process.env.VISUAL_WORKERS) : undefined,
  // On CI each shard writes a blob report; the workflow's last job merges them into one HTML report.
  reporter: process.env.CI ? [['list'], ['blob']] : 'list',
  use: {
    baseURL,
    viewport: { width: 1900, height: 1500 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // The offline shell's worker (ticket 69) would answer from its cache in a browser these checks reuse across a
    // reload; only offline.spec.ts, which is about it, lets it run.
    serviceWorkers: 'block',
    locale: 'en-US',
    launchOptions: {
      // Draw like every other machine: no hinting of glyph outlines, no subpixel (LCD) text, and the sRGB profile
      // rather than the display's, which differs from one Mac to the next.
      args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'],
    },
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
  webServer,
})

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'
import { configDefaults, defineConfig } from 'vitest/config'
import { resolveBase } from './vite.base.ts'
import { offlineShell } from './vite.pwa.ts'
import { spikeResults } from './spike/0763/resultsPlugin.ts'

/** What needs a page (ticket 420); every other `src/**\/*.test.ts` runs in Node. */
const PAGE_TESTS = ['src/components/**/*.test.ts', 'src/homepage/**/*.test.ts', 'src/App*.test.ts', '**/*.dom.test.ts']

/** Component tests that need a real browser for layout (ticket 552): `*.browser.test.ts`. They run where Chromium is
 * installed and skip themselves where it is not (the Pi); `BD_BROWSER_TESTS=1` makes a missing Chromium an error, `=0`
 * skips them. */
const BROWSER_TESTS = '**/*.browser.test.ts'
const browserTestsOn = (): boolean => {
  const mode = process.env.BD_BROWSER_TESTS
  if (mode === '0') return false
  if (mode === '1') return true
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
}

const APP_VERSION = (JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string }).version

/** How many codes each Color catalog holds, by its id (ticket 0742): the Homepage's free list counts them without
 * fetching a catalog, each a lazy chunk of its own. */
const CATALOGS = resolve(import.meta.dirname, 'src/data/colorCatalogs')
const COLOR_CATALOG_CODES = Object.fromEntries(
  readdirSync(CATALOGS)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.slice(0, -'.json'.length), (JSON.parse(readFileSync(resolve(CATALOGS, file), 'utf8')) as { codes: unknown[] }).codes.length]),
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Production builds (build and preview alike) resolve assets relative to the path the app is served from.
  // `DEPLOY_BASE` sets it per host; the Workers serve the app at the root, so their deploy sets it to `/` (ADR 0014,
  // docs/deploy.md). The dev server always serves from /.
  base: resolveBase(mode, process.env.DEPLOY_BASE),
  // The offline shell (ticket 69, ADR 0045): the service worker, written into the build with the list of every file in it.
  plugins: [vue(), offlineShell(), spikeResults()],
  // Lets `tailscale serve` reach the dev server from other devices on the tailnet.
  server: { allowedHosts: ['.ts.net'] },
  // The version the Menu's About section shows (ticket 443); the catalogs' code counts the Homepage names (ticket 0742).
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION), __COLOR_CATALOG_CODES__: JSON.stringify(COLOR_CATALOG_CODES) },
  build: {
    // Two pages: the editor and the Homepage (ticket 77), which is a folder with its own index.html so a static host
    // serves /homepage/ with no rewrite rules (ADR 0014).
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), homepage: resolve(import.meta.dirname, 'homepage/index.html') } },
  },
  test: {
    // Generous on purpose: a shared CI runner can be several times slower than a dev machine, and a healthy test
    // finishes in milliseconds either way, so this only ever matters on a bad day.
    testTimeout: 15000,
    // Two workers: more exhausted a dev machine's memory (8GB, no swap) and got the run killed.
    maxWorkers: 2,
    projects: [
      {
        // Tests that need no page (ticket 420): domain, rendering, services, pure composables. Plain Node, no jsdom and no
        // per-file isolation, so a file costs its tests and not a fresh page. A page test is named `*.dom.test.ts`, or sits
        // under `src/components/`, `src/homepage/` or is an `src/App*.test.ts` (docs/testing.md, Where a test goes).
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          globals: false,
          isolate: false,
          include: ['**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...PAGE_TESTS, BROWSER_TESTS, 'e2e/**', 'worker/**'],
        },
      },
      {
        // Tests that mount a component or touch the page or its storage: one jsdom per worker, shared by every file the
        // worker runs. `src/testSetup.ts` re-arms what each file needs and clears what the last one left.
        extends: true,
        test: {
          name: 'page',
          environment: 'jsdom',
          globals: false,
          isolate: false,
          include: PAGE_TESTS,
          // `npm run test:related` sets SKIP_APP_TESTS: the App imports everything, so `vitest related` would pull in
          // every App.*.test.ts (ticket 418, docs/testing.md).
          exclude: [...configDefaults.exclude, BROWSER_TESTS, ...(process.env.SKIP_APP_TESTS ? ['src/App.test.ts', 'src/App.*.test.ts'] : [])],
          setupFiles: ['./src/testSetup.ts'],
        },
      },
      ...(browserTestsOn()
        ? [
            {
              // Layout facts (text that fits, a Tooltip kept on screen) in a real Chromium, one component at a time at a
              // chosen width and language (ticket 552, docs/testing.md).
              extends: true as const,
              test: {
                name: 'browser',
                include: [BROWSER_TESTS],
                setupFiles: ['./src/browserSetup.ts'],
                browser: { enabled: true, headless: true, screenshotFailures: false, // Reduced motion, as the e2e has it: animated drawings are measured where they end up.
                  provider: playwright({ contextOptions: { reducedMotion: 'reduce' } }), instances: [{ browser: 'chromium' as const }] },
              },
            },
          ]
        : []),
      {
        // The backend Worker (ticket 71): its tests start workerd through Miniflare, so they run in Node, no DOM.
        extends: true,
        test: { name: 'worker', environment: 'node', globals: false, include: ['worker/**/*.test.ts'], testTimeout: 30000 },
      },
    ],
  },
}))

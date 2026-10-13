import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'
import { resolveBase } from './vite.base.ts'
import { offlineShell } from './vite.pwa.ts'

/** What needs a page (ticket 420); every other `src/**\/*.test.ts` runs in Node. */
const PAGE_TESTS = ['src/components/**/*.test.ts', 'src/overview/**/*.test.ts', 'src/App*.test.ts', '**/*.dom.test.ts']

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Production builds (build and preview alike) resolve assets relative to the path the app is served from.
  // `DEPLOY_BASE` sets it per host; the Workers serve the app at the root, so their deploy sets it to `/` (ADR 0014,
  // docs/deploy.md). The dev server always serves from /.
  base: resolveBase(mode, process.env.DEPLOY_BASE),
  // The offline shell (ticket 69, ADR 0045): the service worker, written into the build with the list of every file in it.
  plugins: [vue(), offlineShell()],
  build: {
    // Two pages: the editor and the Overview (ticket 77), which is a folder with its own index.html so a static host
    // serves /overview/ with no rewrite rules (ADR 0014).
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), overview: resolve(import.meta.dirname, 'overview/index.html') } },
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
        // under `src/components/`, `src/overview/` or is an `src/App*.test.ts` (docs/testing.md, Where a test goes).
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          globals: false,
          isolate: false,
          include: ['**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...PAGE_TESTS, 'e2e/**', 'worker/**'],
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
          exclude: [...configDefaults.exclude, ...(process.env.SKIP_APP_TESTS ? ['src/App.test.ts', 'src/App.*.test.ts'] : [])],
          setupFiles: ['./src/testSetup.ts'],
        },
      },
      {
        // The backend Worker (ticket 71): its tests start workerd through Miniflare, so they run in Node, no DOM.
        extends: true,
        test: { name: 'worker', environment: 'node', globals: false, include: ['worker/**/*.test.ts'], testTimeout: 30000 },
      },
    ],
  },
}))

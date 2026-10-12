import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'
import { resolveBase } from './vite.base.ts'
import { offlineShell } from './vite.pwa.ts'

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
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          globals: false,
          // The browser checks (ticket 103) are Playwright's, not Vitest's; the Worker's tests (ticket 71) are below.
          exclude: [...configDefaults.exclude, 'e2e/**', 'worker/**'],
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

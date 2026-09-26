import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'
import { resolveBase } from './vite.base.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // The app is served from a subpath (/bd-beads/ on the Flint 2 router), not /, so production builds (build and
  // preview alike) resolve assets relative to it. `DEPLOY_BASE` overrides the path per host (ADR 0022); only the dev
  // server stays at /.
  base: resolveBase(mode, process.env.DEPLOY_BASE),
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: false,
    // The browser checks (ticket 103) are Playwright's, not Vitest's.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/testSetup.ts'],
    // Generous on purpose: a shared CI runner can be several times slower than a dev machine, and a healthy test
    // finishes in milliseconds either way, so this only ever matters on a bad day.
    testTimeout: 15000,
  },
}))

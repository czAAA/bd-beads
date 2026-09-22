import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repo at /bd-beads/, not /, so assets built
  // for production (build and preview alike) need to resolve relative to
  // that subpath; only the dev server stays at /.
  base: mode === 'production' ? '/bd-beads/' : '/',
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

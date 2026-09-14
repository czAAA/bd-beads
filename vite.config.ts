import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repo at /bd-beads/, not /, so assets built
  // for production (build and preview alike) need to resolve relative to
  // that subpath; only the dev server stays at /.
  base: mode === 'production' ? '/bd-beads/' : '/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: false,
  },
}))

/**
 * The app the browser checks drive: the production build served by `vite preview`, because that is what people run and
 * what ADR 0018's measurements were taken on. `base` is /bd-beads/ in a production build (vite.config.ts), so every
 * page URL is relative to it. CI builds once in its own step (and uploads dist/ for later jobs), then sets SKIP_BUILD so
 * the test runner only serves that build.
 */
const PORT = 4173

export const baseURL = `http://localhost:${PORT}/bd-beads/`

export const webServer = {
  command: `${process.env.SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}

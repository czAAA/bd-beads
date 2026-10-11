/**
 * The app the browser checks drive: the production build served by `vite preview`, because that is what people run and
 * what ADR 0018's measurements were taken on. `base` is /bd-beads/ in a production build (vite.config.ts), so every
 * page URL is relative to it. CI builds once in its own step (and uploads dist/ for later jobs), then sets SKIP_BUILD so
 * the test runner only serves that build.
 */
// E2E_PORT lets a second worktree run its own server: with the default, a preview left running by another worktree is
// reused locally and the checks would measure that build instead of this one.
const PORT = Number(process.env.E2E_PORT ?? 4173)

export const baseURL = `http://localhost:${PORT}/bd-beads/`

export const webServer = {
  command: `${process.env.SKIP_BUILD ? '' : 'VITE_DOCK_LAYOUT=off npm run build && '}npx vite preview --port ${PORT} --strictPort`,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}

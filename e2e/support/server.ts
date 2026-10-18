// The app the browser checks drive: the production build under `vite preview` (ADR 0018), URLs relative to `base`; CI
// sets SKIP_BUILD. E2E_PORT lets a second worktree run its own server: with the default, a preview left running by
// another worktree is reused locally and the checks would measure that build instead of this one.
const PORT = Number(process.env.E2E_PORT ?? 4173)

export const baseURL = `http://localhost:${PORT}/bd-beads/`

export const webServer = {
  command: `${process.env.SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}

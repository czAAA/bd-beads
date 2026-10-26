// The app the browser checks drive: the production build under `vite preview` (ADR 0018), URLs relative to `base`; CI
// sets SKIP_BUILD. E2E_PORT lets a second worktree run its own server: with the default, a preview left running by
// another worktree is reused locally and the checks would measure that build instead of this one.
const PORT = Number(process.env.E2E_PORT ?? 4173)

export const baseURL = `http://localhost:${PORT}/bd-beads/`

export const webServer = {
  // IPv4 only: in the Playwright image `localhost` is ::1 first, which Node's fetch (hostProxy.ts) does not reach.
  command: `${process.env.SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}

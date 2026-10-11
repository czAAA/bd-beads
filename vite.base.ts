const DEFAULT_BASE = '/bd-beads/'

// The URL path the production build is served from. `DEPLOY_BASE` sets it so a new host (a subpath or the domain
// root) is a config change, not a code change; it gets a leading and a trailing slash, as Vite needs, and `/` means the domain root. The dev server
// always serves from /.
export function resolveBase(mode: string, deployBase: string | undefined): string {
  if (mode !== 'production') return '/'
  const trimmed = deployBase?.trim()
  if (!trimmed) return DEFAULT_BASE
  const path = trimmed.replace(/^\/+|\/+$/g, '')
  return path ? `/${path}/` : '/'
}

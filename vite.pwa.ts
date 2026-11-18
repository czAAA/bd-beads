import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { HEADERS_FILE } from './vite.headers.ts'

/** The worker as the build writes it, next to index.html (the scope is its folder, so it covers the whole app). */
export const SERVICE_WORKER_FILE = 'sw.js'

/** The redirects file (ticket 1052): `/homepage/` to the main address. Cloudflare reads it from the build's root. */
export const REDIRECTS_FILE = '_redirects'

/** What the host reads and never serves: fetching one would fail the worker's install (tickets 1024, 1052). */
export const HOST_FILES: readonly string[] = [HEADERS_FILE, REDIRECTS_FILE]

/** Every file under `dir`, as `/`-separated paths from it, sorted. */
export function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

/** The worker's source with this build's file list (ticket 69, ADR 0045). The cache is named after the files'
 * content, so a changed build is a new cache and the old one is dropped when the new worker takes over. */
export function renderServiceWorker(template: string, dir: string): { source: string; precache: string[] } {
  // Not the host's own files either: it reads them and serves none, so fetching one would fail the install.
  const precache = filesBelow(dir).filter((path) => path !== SERVICE_WORKER_FILE && !HOST_FILES.includes(path))
  // The worker's own text counts too, so a fixed worker is a new cache and a device drops what an older one kept.
  const hash = createHash('sha256').update(template).update('\0')
  for (const path of precache) hash.update(path).update('\0').update(readFileSync(join(dir, path)))
  const source = template
    .replace("'__CACHE_NAME__'", JSON.stringify(`bd-beads-${hash.digest('hex').slice(0, 12)}`))
    .replace("'__PRECACHE__'", JSON.stringify(precache))
  return { source, precache }
}

/** Writes `sw.js` once every other file is there (public/ is copied by then), so its list is the whole build. No
 * library: ADR 0045. */
export function offlineShell(): Plugin {
  let outDir = ''
  return {
    name: 'bd-beads:offline-shell',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: {
      order: 'post',
      handler() {
        const template = readFileSync(resolve(import.meta.dirname, 'pwa/serviceWorker.js'), 'utf8')
        writeFileSync(join(outDir, SERVICE_WORKER_FILE), renderServiceWorker(template, outDir).source)
      },
    },
  }
}

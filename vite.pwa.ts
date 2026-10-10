import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

/** The worker as the build writes it, next to index.html (the scope is its folder, so it covers the whole app). */
export const SERVICE_WORKER_FILE = 'sw.js'

/** Every file under `dir`, as `/`-separated paths from it, sorted. */
export function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

/**
 * The worker's source with this build's file list in it (ticket 69, ADR 0045): everything in the build but the worker
 * itself. The cache is named after the files' content, so a changed build is a new cache and the old one is dropped
 * when the new worker takes over.
 */
export function renderServiceWorker(template: string, dir: string): { source: string; precache: string[] } {
  const precache = filesBelow(dir).filter((path) => path !== SERVICE_WORKER_FILE)
  const hash = createHash('sha256')
  for (const path of precache) hash.update(path).update('\0').update(readFileSync(join(dir, path)))
  const source = template
    .replace("'__CACHE_NAME__'", JSON.stringify(`bd-beads-${hash.digest('hex').slice(0, 12)}`))
    .replace("'__PRECACHE__'", JSON.stringify(precache))
  return { source, precache }
}

/**
 * Writes `sw.js` into the build once every other file is there (public/ is copied in by then), so the list it carries
 * is the whole of the build. No library: see ADR 0045.
 */
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

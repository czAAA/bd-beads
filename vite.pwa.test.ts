import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { filesBelow, renderServiceWorker, SERVICE_WORKER_FILE } from './vite.pwa.ts'

const repo = import.meta.dirname
const template = readFileSync(resolve(repo, 'pwa/serviceWorker.js'), 'utf8')

/** The list a built worker carries, read from its source the way the browser would run it. */
function precacheOf(source: string): string[] {
  const match = /const PRECACHE = (\[.*\])$/m.exec(source)
  if (!match) throw new Error('no precache list in the worker')
  return JSON.parse(match[1]) as string[]
}

const cacheNameOf = (source: string) => /const CACHE = "([^"]+)"/.exec(source)?.[1]

describe('renderServiceWorker', () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  function folder(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'bd-beads-pwa-'))
    dirs.push(dir)
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), content)
    }
    return dir
  }

  it('lists every file but the worker itself, in folders too', () => {
    const dir = folder({ 'index.html': 'a', 'assets/app.js': 'b', 'overview/index.html': 'c', [SERVICE_WORKER_FILE]: 'old' })
    expect(filesBelow(dir)).toEqual(['assets/app.js', 'index.html', 'overview/index.html', SERVICE_WORKER_FILE])
    expect(precacheOf(renderServiceWorker(template, dir).source)).toEqual(['assets/app.js', 'index.html', 'overview/index.html'])
  })

  it('names the cache after the content, so a changed file is a new cache', () => {
    const before = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'one' })).source)
    const same = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'one' })).source)
    const changed = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'two' })).source)
    expect(before).toMatch(/^bd-beads-[0-9a-f]{12}$/)
    expect(same).toBe(before)
    expect(changed).not.toBe(before)
  })
})

describe('the production build (ticket 69)', () => {
  let outDir = ''
  let files: string[] = []

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'bd-beads-build-'))
    await build({ root: repo, configFile: resolve(repo, 'vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } })
    files = filesBelow(outDir)
  }, 300_000)
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  it('has every built file in the worker\'s offline list, and nothing else', () => {
    const precache = precacheOf(readFileSync(join(outDir, SERVICE_WORKER_FILE), 'utf8'))
    expect(precache).toEqual(files.filter((path) => path !== SERVICE_WORKER_FILE))
    // The pieces the offline use needs, by name, so an empty list can't pass.
    expect(precache).toEqual(
      expect.arrayContaining(['index.html', 'overview/index.html', 'manifest.webmanifest', 'icons/bd-beads-app-icon.svg']),
    )
    expect(precache.some((path) => path.startsWith('assets/') && path.endsWith('.js'))).toBe(true)
    expect(precache.some((path) => path.startsWith('fonts/') && path.endsWith('.woff2'))).toBe(true)
  })

  it('keeps index.html, splash included, under 14 KB so the first round trip carries it', () => {
    expect(statSync(join(outDir, 'index.html')).size).toBeLessThan(14 * 1024)
  })

  it('links the manifest, whose icons and start page are in the build', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(html).toMatch(/<link rel="manifest" href="\/bd-beads\/manifest\.webmanifest"/)
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8')) as {
      display: string
      start_url: string
      icons: { src: string }[]
    }
    expect(manifest.display).toBe('standalone')
    expect(files).toContain('index.html')
    for (const icon of manifest.icons) expect(files).toContain(icon.src)
  })
})

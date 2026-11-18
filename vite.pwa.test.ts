import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HEADERS_FILE } from './vite.headers.ts'
import { filesBelow, HOST_FILES, REDIRECTS_FILE, renderServiceWorker, SERVICE_WORKER_FILE } from './vite.pwa.ts'
import { LOCALES } from './src/domain/locale.ts'
import { readNotesFile } from './src/domain/notesFile.ts'

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
    const dir = folder({ 'index.html': 'a', 'assets/app.js': 'b', 'app/index.html': 'c', [SERVICE_WORKER_FILE]: 'old' })
    expect(filesBelow(dir)).toEqual(['app/index.html', 'assets/app.js', 'index.html', SERVICE_WORKER_FILE])
    expect(precacheOf(renderServiceWorker(template, dir).source)).toEqual(['app/index.html', 'assets/app.js', 'index.html'])
  })

  it('leaves out the headers file, which the host reads and never serves, so the install would fail on it (ticket 1024)', () => {
    const dir = folder({ 'index.html': 'a', [HEADERS_FILE]: '/*\n  X-Frame-Options: DENY\n' })
    expect(precacheOf(renderServiceWorker(template, dir).source)).toEqual(['index.html'])
  })

  it('leaves out the redirects file, which the host reads and never serves either (ticket 1052)', () => {
    const dir = folder({ 'index.html': 'a', [REDIRECTS_FILE]: '/homepage / 301\n' })
    expect(precacheOf(renderServiceWorker(template, dir).source)).toEqual(['index.html'])
  })

  it('names the cache after the content, so a changed file is a new cache', () => {
    const before = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'one' })).source)
    const same = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'one' })).source)
    const changed = cacheNameOf(renderServiceWorker(template, folder({ 'index.html': 'two' })).source)
    expect(before).toMatch(/^bd-beads-[0-9a-f]{12}$/)
    expect(same).toBe(before)
    expect(changed).not.toBe(before)
  })

  it('names the cache after the worker too, so a fixed worker never reuses what an older one kept (ticket 1017)', () => {
    const dir = folder({ 'index.html': 'one' })
    const before = cacheNameOf(renderServiceWorker(template, dir).source)
    const fixed = cacheNameOf(renderServiceWorker(`${template}\n// fixed`, dir).source)
    expect(fixed).not.toBe(before)
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
    expect(precache).toEqual(files.filter((path) => path !== SERVICE_WORKER_FILE && !HOST_FILES.includes(path)))
    // The pieces the offline use needs, by name, so an empty list can't pass.
    expect(precache).toEqual(
      expect.arrayContaining(['index.html', 'app/index.html', 'manifest.webmanifest', 'icons/bd-beads-app-icon.svg']),
    )
    expect(precache.some((path) => path.startsWith('assets/') && path.endsWith('.js'))).toBe(true)
    expect(precache.some((path) => path.startsWith('fonts/') && path.endsWith('.woff2'))).toBe(true)
  })

  it('puts each language in a file of its own, which no page fetches at start and the offline list keeps (ticket 0616)', () => {
    const precache = precacheOf(readFileSync(join(outDir, SERVICE_WORKER_FILE), 'utf8'))
    const pages = ['index.html', 'app/index.html'].map((page) => readFileSync(join(outDir, page), 'utf8'))
    for (const locale of LOCALES) {
      const file = files.find((path) => new RegExp(`^assets/${locale}-[\\w-]+\\.js$`).test(path))
      expect(file, locale).toBeDefined()
      expect(precache).toContain(file)
      // A file the page itself loads or preloads is named in it; the language's is fetched only when it is chosen.
      for (const page of pages) expect(page).not.toContain(file!.slice('assets/'.length))
    }
  })

  it('writes one notes file per language, which the offline list keeps, and no script holds a note (ticket 1047)', () => {
    const precache = precacheOf(readFileSync(join(outDir, SERVICE_WORKER_FILE), 'utf8'))
    for (const locale of LOCALES) {
      expect(precache).toContain(`notes/${locale}.json`)
      expect(readNotesFile(JSON.parse(readFileSync(join(outDir, 'notes', `${locale}.json`), 'utf8'))), locale).not.toBeNull()
    }
    const lines = ['src/data/releaseNotes/2026-11-17-1047.json', 'src/data/releaseNotes/before-1.0.0/2026-11-17-1042.json'].map(
      (path) => (JSON.parse(readFileSync(resolve(repo, path), 'utf8')) as { line: { ru: string } }).line.ru,
    )
    const scripts = files.filter((path) => path.endsWith('.js')).map((path) => readFileSync(join(outDir, path), 'utf8'))
    for (const line of lines) for (const script of scripts) expect(script).not.toContain(line)
    // A note from before 1.0.0 is in no built file at all.
    for (const path of files) expect(readFileSync(join(outDir, path), 'utf8'), path).not.toContain(lines[1])
  })

  it('sends both pages with a policy that names every inline script they hold, and no script it lets run unnamed (ticket 1024)', () => {
    const rule = readFileSync(join(outDir, HEADERS_FILE), 'utf8').split('\n')
    expect(rule[0]).toBe('/*')
    // Cloudflare reads at most 2,000 characters of a line.
    for (const line of rule) expect(line.length).toBeLessThan(2000)
    const policy = rule.find((line) => line.startsWith('  Content-Security-Policy: ')) ?? ''
    const scripts = policy.split('; ').find((part) => part.includes('script-src ')) ?? ''
    expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/)
    let inline = 0
    for (const page of ['index.html', 'app/index.html']) {
      for (const [, attributes, text] of readFileSync(join(outDir, page), 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
        if (/\bsrc=/.test(attributes!)) continue
        inline += 1
        expect(scripts, `${page}: ${text!.trim().slice(0, 60)}`).toContain(`'sha256-${createHash('sha256').update(text!).digest('base64')}'`)
      }
    }
    // The theme, the two handoff scripts and the Homepage's own, so a pattern that finds none can't pass.
    expect(inline).toBeGreaterThanOrEqual(4)
  })

  it('sends the old Homepage address to the main one, with and without its slash (ticket 1052)', () => {
    const rules = readFileSync(join(outDir, REDIRECTS_FILE), 'utf8').split('\n').filter((line) => line && !line.startsWith('#'))
    expect(rules).toEqual(['/homepage / 301', '/homepage/* / 301'])
    expect(files).not.toContain('homepage/index.html')
  })

  it("keeps the editor's page, splash included, under 14 KB so the first round trip carries it", () => {
    expect(statSync(join(outDir, 'app/index.html')).size).toBeLessThan(14 * 1024)
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
    expect(manifest.start_url).toBe('app/')
    expect(files).toContain(`${manifest.start_url}index.html`)
    for (const icon of manifest.icons) expect(files).toContain(icon.src)
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build, resolveConfig } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { copyHtml, escapeHtml, homepageCopyIn, type HomepageCopy, robotsText, ROBOTS_FILE, SITE_URL, SITEMAP_FILE, sitemapText, withCopy } from './vite.crawler.ts'
import { HEADERS_FILE, inlineScriptHashes } from './vite.headers.ts'

const repo = import.meta.dirname
const configFile = resolve(repo, 'vite.config.ts')
/** The English copy as the build reads it: the app's code run with the config's defines. */
let copy: HomepageCopy
beforeAll(async () => {
  copy = await homepageCopyIn('en', repo, (await resolveConfig({ root: repo, configFile }, 'build')).define ?? {})
}, 60_000)

/** Every string the copy holds, as the page would write it. */
const copyStrings = (): string[] =>
  copy.sections.flatMap((section) => [
    section.heading,
    ...(section.line ? [section.line] : []),
    ...(section.named ?? []).flatMap(({ name, text }) => [name, text]),
    ...(section.groups ?? []).flatMap((group) => [group.heading, ...(group.named ?? []).flatMap(({ name, text }) => [name, text]), ...(group.rows ?? [])]),
  ])

describe('what the build writes for crawlers (ticket 1055)', () => {
  it('writes the title in place of the source’s and the copy into the app’s box', () => {
    const html = withCopy('<head><title>Homepage · openbeads</title></head><body><div id="app"></div></body>', copy)
    expect(html).toContain(`<title>${escapeHtml(copy.title)}</title>`)
    expect(html).toContain(`<div id="app">${copyHtml(copy)}</div>`)
  })

  it('refuses a page with no box to write into, rather than ship it without its copy', () => {
    expect(() => withCopy('<title>x</title><div id="root"></div>', copy)).toThrow()
  })

  it('escapes what HTML would read as markup', () => {
    expect(escapeHtml(`<b>"Tom" & Jerry's</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; Jerry\'s&lt;/b&gt;')
  })

  it('lets everything be crawled but the API, and names the sitemap', () => {
    expect(robotsText(SITE_URL)).toBe('User-agent: *\nDisallow: /api/\n\nSitemap: https://openbeads.com/sitemap.xml\n')
    expect(sitemapText([SITE_URL])).toContain('<loc>https://openbeads.com/</loc>')
  })
})

describe('the built Homepage (ticket 1055)', () => {
  let outDir = ''
  let page = ''
  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'bd-beads-crawler-'))
    await build({ root: repo, configFile, logLevel: 'silent', build: { outDir, emptyOutDir: true } })
    page = readFileSync(join(outDir, 'index.html'), 'utf8')
  }, 300_000)
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  it('has the title, the description and the one address in its head', () => {
    const head = page.slice(0, page.indexOf('</head>'))
    expect(head).toContain(`<title>${escapeHtml(copy.title)}</title>`)
    expect(copy.title).toMatch(/^Free bead pattern maker.* · openbeads$/)
    expect(head).toContain(`<meta name="description" content="${escapeHtml(copy.description)}">`)
    expect(head).toContain(`<link rel="canonical" href="${SITE_URL}">`)
  })

  it('holds the dictionary’s copy as plain text before the app starts, out of sight until it draws', () => {
    const app = page.slice(page.indexOf('<div id="app">'), page.indexOf('</body>'))
    for (const text of copyStrings()) expect(app, text).toContain(escapeHtml(text))
    expect(app).toContain(`<h1>${escapeHtml(copy.sections[0]!.heading)}</h1>`)
    // The style that hides it is in the head, read before the body is drawn.
    expect(page.slice(0, page.indexOf('</head>'))).toMatch(/<style>\.homepage-copy\{[^}]*clip-path:inset\(50%\)/)
  })

  it('says it is a free web application, with no rating', () => {
    const data = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page)?.[1]
    const parsed = JSON.parse(data ?? '{}') as Record<string, unknown>
    expect(parsed).toMatchObject({
      '@type': 'WebApplication',
      name: 'openbeads',
      url: SITE_URL,
      applicationCategory: 'DesignApplication',
      offers: { '@type': 'Offer', price: '0' },
    })
    expect(parsed).not.toHaveProperty('aggregateRating')
    expect(parsed).not.toHaveProperty('review')
  })

  it('names every inline script of the page, the data included, in the policy it is sent with', () => {
    const headers = readFileSync(join(outDir, HEADERS_FILE), 'utf8')
    const hashes = inlineScriptHashes(page)
    expect(hashes.length).toBeGreaterThanOrEqual(2)
    for (const hash of hashes) expect(headers).toContain(hash)
  })

  it('has robots.txt and the sitemap beside it, and the editor asks not to be indexed', () => {
    expect(readFileSync(join(outDir, ROBOTS_FILE), 'utf8')).toBe(robotsText(SITE_URL))
    expect(readFileSync(join(outDir, SITEMAP_FILE), 'utf8')).toBe(sitemapText([SITE_URL]))
    expect(readFileSync(join(outDir, 'app/index.html'), 'utf8')).toContain('<meta name="robots" content="noindex" />')
  })
})

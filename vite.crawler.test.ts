import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build, resolveConfig } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOCALES, type Locale } from './src/domain/locale.ts'
import {
  alternateAddresses,
  copyHtml,
  editorFile,
  escapeHtml,
  homepageAddress,
  homepageCopyIn,
  type HomepageCopy,
  homepageFile,
  HOMEPAGES,
  OPEN_GRAPH_LOCALES,
  PREVIEW_SIZE,
  previewFile,
  previewTags,
  robotsText,
  ROBOTS_FILE,
  SITE_URL,
  SITEMAP_FILE,
  sitemapAddresses,
  sitemapText,
  withCopy,
  withoutLanguageFolder,
} from './vite.crawler.ts'
import { HEADERS_FILE, inlineScriptHashes } from './vite.headers.ts'

const repo = import.meta.dirname
const configFile = resolve(repo, 'vite.config.ts')
/** Each language's copy as the build reads it: the app's code run with the config's defines. */
const copies = new Map<Locale, HomepageCopy>()
let copy: HomepageCopy
beforeAll(async () => {
  const define = (await resolveConfig({ root: repo, configFile }, 'build')).define ?? {}
  for (const locale of LOCALES) copies.set(locale, await homepageCopyIn(locale, repo, define))
  copy = copies.get('en')!
}, 120_000)

/** Every string a copy holds, as the page would write it. */
const copyStrings = (copy: HomepageCopy): string[] =>
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

  it('gives each language’s Homepage one address, the English one the main address, and names them all (ticket 1053)', () => {
    expect(homepageAddress(SITE_URL, 'en')).toBe(SITE_URL)
    expect(homepageAddress(SITE_URL, 'ru')).toBe('https://openbeads.com/ru/')
    expect(sitemapAddresses(SITE_URL)).toEqual(['https://openbeads.com/', ...LOCALES.filter((l) => l !== 'en').map((l) => `https://openbeads.com/${l}/`)])
    expect(alternateAddresses(SITE_URL).at(-1)).toEqual({ lang: 'x-default', href: SITE_URL })
  })

  it('gives a link preview the page’s own title and description, its language’s address and Welcome picture (ticket 1056)', () => {
    const ru = copies.get('ru')!
    const content = (key: string) => previewTags(ru, SITE_URL).find(({ attrs = {} }) => attrs.property === key || attrs.name === key)?.attrs?.content
    expect(content('og:title')).toBe(ru.title)
    expect(content('twitter:title')).toBe(ru.title)
    expect(content('og:description')).toBe(ru.description)
    expect(content('twitter:description')).toBe(ru.description)
    expect(content('og:url')).toBe('https://openbeads.com/ru/')
    expect(content('og:locale')).toBe('ru_RU')
    const alternates = previewTags(ru, SITE_URL).filter(({ attrs = {} }) => attrs.property === 'og:locale:alternate').map(({ attrs = {} }) => attrs.content)
    expect(alternates).toEqual(LOCALES.filter((locale) => locale !== 'ru').map((locale) => OPEN_GRAPH_LOCALES[locale]))
    expect(content('og:image')).toBe('https://openbeads.com/previews/welcome-ru.png')
    expect(content('twitter:image')).toBe(content('og:image'))
    expect(content('twitter:card')).toBe('summary_large_image')
    expect(content('og:image:alt')).toBe(ru.sections[0]!.heading)
  })

  it('serves a language folder’s page from the dev server’s one page with none (ticket 1053)', () => {
    expect(withoutLanguageFolder('/ru/app/?open=saved-projects')).toBe('/app/?open=saved-projects')
    expect(withoutLanguageFolder('/zh/')).toBe('/')
    expect(withoutLanguageFolder('/de/')).toBe('/de/')
    expect(withoutLanguageFolder('/src/main.ts')).toBe('/src/main.ts')
    expect(withoutLanguageFolder('/ru')).toBe('/ru')
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
    for (const text of copyStrings(copy)) expect(app, text).toContain(escapeHtml(text))
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

  it('names every inline script of every page, the data included, in the policy it is sent with', () => {
    const headers = readFileSync(join(outDir, HEADERS_FILE), 'utf8')
    expect(inlineScriptHashes(page).length).toBeGreaterThanOrEqual(2)
    for (const { folder } of HOMEPAGES) for (const hash of inlineScriptHashes(built(homepageFile(folder)))) expect(headers).toContain(hash)
  })

  it('has robots.txt and the sitemap of every language’s Homepage beside it, and every editor asks not to be indexed', () => {
    expect(readFileSync(join(outDir, ROBOTS_FILE), 'utf8')).toBe(robotsText(SITE_URL))
    expect(readFileSync(join(outDir, SITEMAP_FILE), 'utf8')).toBe(sitemapText(sitemapAddresses(SITE_URL)))
    for (const { folder } of HOMEPAGES) expect(built(editorFile(folder)), editorFile(folder)).toContain('<meta name="robots" content="noindex" />')
  })

  /** A built page, by its path in the build. */
  const built = (file: string) => readFileSync(join(outDir, file), 'utf8')

  it.each(LOCALES)('writes the Homepage in %s in its folder, in its language, naming the others (ticket 1053)', (locale) => {
    const html = built(homepageFile(locale))
    const head = html.slice(0, html.indexOf('</head>'))
    const own = copies.get(locale)!
    expect(html).toMatch(new RegExp(`<html lang="${locale}" data-locale="${locale}">`))
    expect(head).toContain(`<title>${escapeHtml(own.title)}</title>`)
    expect(head).toContain(`<meta name="description" content="${escapeHtml(own.description)}">`)
    // `/en/` and the main address are one page.
    expect(head).toContain(`<link rel="canonical" href="${homepageAddress(SITE_URL, locale)}">`)
    for (const { lang, href } of alternateAddresses(SITE_URL)) expect(head).toContain(`<link rel="alternate" hreflang="${lang}" href="${href}">`)
    const app = html.slice(html.indexOf('<div id="app">'), html.indexOf('</body>'))
    for (const text of copyStrings(own)) expect(app, text).toContain(escapeHtml(text))
    expect(JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}')).toMatchObject({ inLanguage: locale, url: homepageAddress(SITE_URL, locale) })
    // The editor beside it, in the same language.
    expect(built(editorFile(locale))).toMatch(new RegExp(`<html lang="${locale}" data-locale="${locale}">`))
  })

  it('gives each language its own words, and the main address none of a language folder’s mark', () => {
    expect(new Set(LOCALES.map((locale) => copies.get(locale)!.title)).size).toBe(LOCALES.length)
    expect(new Set(LOCALES.map((locale) => copies.get(locale)!.description)).size).toBe(LOCALES.length)
    expect(page).toMatch(/<html lang="en">/)
    expect(built(editorFile())).toMatch(/<html lang="en">/)
  })

  /** A PNG's width and height, from its header. */
  const pngSize = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) })
  /** The `content` of each meta tag in `html` named by `key` (`og:image`), by `property` or by `name`. */
  const metaContents = (html: string, key: string) =>
    [...html.matchAll(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`, 'g'))].map((match) => match[1])

  it.each(HOMEPAGES.map((homepage) => ({ ...homepage, file: homepageFile(homepage.folder) })))('gives the Homepage at $file and its editor the link preview’s tags, with a picture the build holds (ticket 1056)', ({ locale, folder }) => {
    const own = copies.get(locale)!
    for (const file of [homepageFile(folder), editorFile(folder)]) {
      const head = built(file).slice(0, built(file).indexOf('</head>'))
      // The page's own title and description, the language's Homepage address, whichever page was shared.
      expect(metaContents(head, 'og:title'), file).toEqual([escapeHtml(own.title)])
      expect(metaContents(head, 'og:description'), file).toEqual([escapeHtml(own.description)])
      expect(metaContents(head, 'twitter:title'), file).toEqual([escapeHtml(own.title)])
      expect(metaContents(head, 'twitter:description'), file).toEqual([escapeHtml(own.description)])
      expect(metaContents(head, 'og:url'), file).toEqual([homepageAddress(SITE_URL, locale)])
      expect(metaContents(head, 'og:locale'), file).toEqual([OPEN_GRAPH_LOCALES[locale]])
      expect(metaContents(head, 'twitter:card'), file).toEqual(['summary_large_image'])
      const image = new URL(previewFile(locale), SITE_URL).href
      expect(metaContents(head, 'og:image'), file).toEqual([image])
      expect(metaContents(head, 'twitter:image'), file).toEqual([image])
    }
    expect(pngSize(readFileSync(join(outDir, previewFile(locale))))).toEqual(PREVIEW_SIZE)
  })

  it('has the page the host shows at an address with none, which asks not to be indexed', () => {
    expect(built('404.html')).toContain('<meta name="robots" content="noindex" />')
  })
})

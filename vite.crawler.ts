import { resolve } from 'node:path'
import type { HtmlTagDescriptor, Plugin } from 'vite'
import { runnerImport } from 'vite'
import type { Locale } from './src/domain/locale.ts'

// What the build writes for crawlers, most of which never run the app (ticket 1055): the Homepage's title, description,
// one address and copy in its page, from src/homepage/pageCopy.ts run with the app's defines, and `robots.txt` and
// `sitemap.xml` beside it. The page says nothing the drawn Homepage doesn't; the app replaces the copy as it starts.

/** A run of copy under its heading, as `CopySection` in src/homepage/pageCopy.ts has it: the build can't read the
 * app's types, which import without extensions, so it says the shape it writes. */
interface CopyGroup {
  heading: string
  named?: { name: string; text: string }[]
  rows?: string[]
}

/** One section of the copy: its heading, its line, its named lines and its groups. */
interface CopySection extends CopyGroup {
  line?: string
  groups?: CopyGroup[]
}

/** The Homepage's words in one language, as `homepageCopy` gives them. */
export interface HomepageCopy {
  locale: Locale
  name: string
  title: string
  description: string
  sections: CopySection[]
}

/** The app's one public address: the Homepage's canonical link and the sitemap name it. `SITE_URL` sets a fork's. */
export const SITE_URL = 'https://openbeads.com/'

export const ROBOTS_FILE = 'robots.txt'
export const SITEMAP_FILE = 'sitemap.xml'

/** The module the build reads the Homepage's words from, run by Vite as the app's code is. */
const COPY_MODULE = '/src/homepage/pageCopy.ts'

/** The Homepage's words in a language, from the app's code and that language's strings, each run by Vite with the
 * app's `define`s. Each is imported apart: a runner closes once its module has loaded, so the copy may fetch nothing. */
export async function homepageCopyIn(locale: Locale, root: string, define: Record<string, unknown>): Promise<HomepageCopy> {
  const options = { root, configFile: false as const, logLevel: 'silent' as const, define }
  const [{ module: copy }, { module: strings }] = await Promise.all([
    runnerImport<{ homepageCopy: (t: unknown, locale: Locale) => HomepageCopy }>(COPY_MODULE, options),
    runnerImport<Record<Locale, unknown>>(`/src/i18n/${locale}.ts`, options),
  ])
  return copy.homepageCopy(strings[locale], locale)
}

/** The class of the copy written into the page: out of sight until the app draws the same words in its place, so a
 * visitor never sees it unstyled. A crawler reads the page's text whatever its style. */
const COPY_CLASS = 'homepage-copy'
const COPY_STYLE = `.${COPY_CLASS}{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`

/** A Homepage the build writes: its language and its address from the site's. */
interface HomepageAddress {
  locale: Locale
  path: string
}

/** The Homepages the build writes, the first the main address (ticket 1053 adds each language's). */
const HOMEPAGES: readonly HomepageAddress[] = [{ locale: 'en', path: '' }]

/** `text` safe inside an HTML element or a quoted attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sectionHtml(section: CopySection, level: number): string {
  const named = (lines: CopySection['named']) =>
    lines?.length ? `<ul>${lines.map(({ name, text }) => `<li><b>${escapeHtml(name)}</b> ${escapeHtml(text)}</li>`).join('')}</ul>` : ''
  const rows = (lines: string[] | undefined) => (lines?.length ? `<ul>${lines.map((row) => `<li>${escapeHtml(row)}</li>`).join('')}</ul>` : '')
  return [
    `<section><h${level}>${escapeHtml(section.heading)}</h${level}>`,
    section.line ? `<p>${escapeHtml(section.line)}</p>` : '',
    named(section.named),
    ...(section.groups ?? []).map((group) => `<h${level + 1}>${escapeHtml(group.heading)}</h${level + 1}>${named(group.named)}${rows(group.rows)}`),
    '</section>',
  ].join('')
}

/** The page's copy as HTML: Welcome's heading the page's one `h1`, the other sections' `h2`, their groups' `h3`. */
export function copyHtml(copy: HomepageCopy): string {
  return `<div class="${COPY_CLASS}">${copy.sections.map((section, index) => sectionHtml(section, index === 0 ? 1 : 2)).join('')}</div>`
}

/** What a search engine reads the page as (schema.org): a free web application. No rating: there are no reviews. */
function applicationData(copy: HomepageCopy, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: copy.name,
    url,
    description: copy.description,
    inLanguage: copy.locale,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

/** The tags the page's head gains: its description, its one address, its data, and the style that keeps the copy out
 * of sight. The data's script is never run, and the policy names it by its hash all the same (vite.headers.ts). */
function headTags(copy: HomepageCopy, url: string): HtmlTagDescriptor[] {
  // `<` written as an escape, so no text in the data can end its script.
  const data = JSON.stringify(applicationData(copy, url)).replace(/</g, '\\u003c')
  return [
    { tag: 'meta', attrs: { name: 'description', content: copy.description }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
    { tag: 'script', attrs: { type: 'application/ld+json' }, children: data, injectTo: 'head' },
    { tag: 'style', children: COPY_STYLE, injectTo: 'head' },
  ]
}

const TITLE = /<title>[\s\S]*?<\/title>/
const APP = '<div id="app"></div>'

/** The page with its title and copy written in: the title in place of the source's, the copy inside the app's box. */
export function withCopy(html: string, copy: HomepageCopy): string {
  if (!TITLE.test(html) || !html.includes(APP)) throw new Error(`The Homepage's page has no <title> or no ${APP} to write its copy into`)
  return html.replace(TITLE, `<title>${escapeHtml(copy.title)}</title>`).replace(APP, `<div id="app">${copyHtml(copy)}</div>`)
}

/** `robots.txt`: everything may be crawled but the API, and the sitemap is named. The editor asks for no index in its
 * own page (app/index.html), which a crawler can only read if it may fetch it. */
export function robotsText(site: string): string {
  return ['User-agent: *', 'Disallow: /api/', '', `Sitemap: ${new URL(SITEMAP_FILE, site).href}`, ''].join('\n')
}

/** `sitemap.xml`: the Homepages' addresses. */
export function sitemapText(urls: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')
}

/** Writes the Homepage's words into its page at build time, and `robots.txt` and `sitemap.xml` beside it. */
export function crawlerPages(site = process.env.SITE_URL || SITE_URL): Plugin {
  let root = ''
  let define: Record<string, unknown> = {}
  const urls = HOMEPAGES.map(({ path }) => new URL(path, site).href)
  return {
    name: 'bd-beads:crawler-pages',
    apply: 'build',
    configResolved(config) {
      root = config.root
      define = config.define ?? {}
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        if (resolve(context.filename) !== resolve(root, 'index.html')) return html
        const copy = await homepageCopyIn(HOMEPAGES[0]!.locale, root, define)
        return { html: withCopy(html, copy), tags: headTags(copy, urls[0]!) }
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: ROBOTS_FILE, source: robotsText(site) })
      this.emitFile({ type: 'asset', fileName: SITEMAP_FILE, source: sitemapText(urls) })
    },
  }
}

import type { Plugin, Rollup } from 'vite'
import { runnerImport } from 'vite'
import { LOCALES, type Locale } from './src/domain/locale.ts'

// What crawlers read (ticket 1055): each language's Homepage (`ru/`, ticket 1053) with its title, description, address
// and copy from src/homepage/pageCopy.ts, the editor in its folder (`ru/app/`), `robots.txt` and `sitemap.xml`. Plain
// built pages, no rewrite rules; the page says nothing the drawn Homepage doesn't, and the app replaces the copy.

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

/** A Homepage the build writes: its language, and the language's folder it sits in, none for the main address. */
interface HomepageAddress {
  locale: Locale
  folder?: Locale
}

/** The Homepages the build writes: the main address in English, then each language's folder (ticket 1053). */
export const HOMEPAGES: readonly HomepageAddress[] = [{ locale: 'en' }, ...LOCALES.map((locale) => ({ locale, folder: locale }))]

/** The built page of a Homepage, or of the editor in its folder: `ru/index.html`, `ru/app/index.html`. */
export const homepageFile = (folder?: Locale): string => (folder ? `${folder}/index.html` : 'index.html')
export const editorFile = (folder?: Locale): string => (folder ? `${folder}/app/index.html` : 'app/index.html')

/** The one address of a language's Homepage: `/en/` names the main address, so a search engine counts the two as one
 * page. */
export function homepageAddress(site: string, locale: Locale): string {
  return new URL(locale === 'en' ? '' : `${locale}/`, site).href
}

/** The Homepage in each language a search engine may show instead, and the one it shows a searcher in none of them
 * (`x-default`): the main address. */
export function alternateAddresses(site: string): { lang: string; href: string }[] {
  return [...LOCALES.map((locale) => ({ lang: locale, href: homepageAddress(site, locale) })), { lang: 'x-default', href: homepageAddress(site, 'en') }]
}

/** The addresses the sitemap lists: each language's Homepage at its one address. */
export function sitemapAddresses(site: string): string[] {
  return LOCALES.map((locale) => homepageAddress(site, locale))
}

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

/** A head tag as HTML: its attributes escaped, its children (a script's or style's text) as they are. */
interface HeadTag {
  tag: 'meta' | 'link' | 'script' | 'style'
  attrs?: Record<string, string>
  children?: string
}

function tagHtml({ tag, attrs = {}, children }: HeadTag): string {
  const attributes = Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('')
  return tag === 'meta' || tag === 'link' ? `<${tag}${attributes}>` : `<${tag}${attributes}>${children ?? ''}</${tag}>`
}

/** The tags the page's head gains: its description, its one address, the other languages' Homepages, its data, and the
 * style that keeps the copy out of sight. The data's script is never run, and the policy names it by its hash all the
 * same (vite.headers.ts). Ticket 1056 adds the link preview's here. */
function headTags(copy: HomepageCopy, site: string): HeadTag[] {
  const url = homepageAddress(site, copy.locale)
  // `<` written as an escape, so no text in the data can end its script.
  const data = JSON.stringify(applicationData(copy, url)).replace(/</g, '\\u003c')
  return [
    { tag: 'meta', attrs: { name: 'description', content: copy.description } },
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    ...alternateAddresses(site).map(({ lang, href }): HeadTag => ({ tag: 'link', attrs: { rel: 'alternate', hreflang: lang, href } })),
    { tag: 'script', attrs: { type: 'application/ld+json' }, children: data },
    { tag: 'style', children: COPY_STYLE },
  ]
}

const TITLE = /<title>[\s\S]*?<\/title>/
const APP = '<div id="app"></div>'
const HTML_TAG = /<html\b[^>]*>/
const HEAD_END = '</head>'

/** The page in `locale`: its `lang`, and in a language's folder the mark that its language wins over the one the device
 * saved, which the page's first script reads before it paints. */
function inLanguage(html: string, locale: Locale, folder?: Locale): string {
  if (!HTML_TAG.test(html)) throw new Error('The page has no <html> tag to name its language on')
  return html.replace(HTML_TAG, `<html lang="${locale}"${folder ? ` data-locale="${folder}"` : ''}>`)
}

/** A Homepage's page: the built one in its language, with its copy and its head's tags written in. */
function homepageHtml(template: string, copy: HomepageCopy, site: string, folder?: Locale): string {
  const html = inLanguage(withCopy(template, copy), copy.locale, folder)
  if (!html.includes(HEAD_END)) throw new Error('The Homepage\'s page has no </head> to write its tags into')
  return html.replace(HEAD_END, `${headTags(copy, site).map(tagHtml).join('')}${HEAD_END}`)
}

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

/** `sitemap.xml`: the Homepages' addresses, as `sitemapAddresses` gives them. */
export function sitemapText(urls: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')
}

/** The built page at `fileName`, which the build must have. */
function builtPage(bundle: Rollup.OutputBundle, fileName: string): Rollup.OutputAsset {
  const page = bundle[fileName]
  if (page?.type !== 'asset') throw new Error(`The build has no ${fileName} to write the language pages from`)
  return page
}

/** A path under a language's folder, `/ru/app/`, as the path the page has with none, `/app/`: what the dev server
 * serves it from, as it has no language folders (the build writes them). */
export function withoutLanguageFolder(url: string): string {
  const [, code, rest] = /^\/([^/?#]+)(\/.*)?$/.exec(url) ?? []
  return code && (LOCALES as readonly string[]).includes(code) && rest !== undefined ? rest : url
}

/** Writes each language's Homepage at build time, its words in its page, beside the editor in its language, and
 * `robots.txt` and `sitemap.xml`. */
export function crawlerPages(site = process.env.SITE_URL || SITE_URL): Plugin {
  let root = ''
  let define: Record<string, unknown> = {}
  return {
    name: 'bd-beads:crawler-pages',
    configResolved(config) {
      root = config.root
      define = config.define ?? {}
    },
    // `npm run dev` serves `/ru/app/` as `/app/`; the page reads its language from the address all the same.
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url) request.url = withoutLanguageFolder(request.url)
        next()
      })
    },
    // Once the pages are built, so every language's copy holds the same scripts and styles as the one Vite wrote.
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const homepage = builtPage(bundle, homepageFile())
        const editor = builtPage(bundle, editorFile())
        const [homepageTemplate, editorTemplate] = [String(homepage.source), String(editor.source)]
        const copies = new Map(await Promise.all(LOCALES.map(async (locale) => [locale, await homepageCopyIn(locale, root, define)] as const)))
        for (const { locale, folder } of HOMEPAGES) {
          const page = homepageHtml(homepageTemplate, copies.get(locale)!, site, folder)
          if (!folder) {
            homepage.source = page
            continue
          }
          this.emitFile({ type: 'asset', fileName: homepageFile(folder), source: page })
          this.emitFile({ type: 'asset', fileName: editorFile(folder), source: inLanguage(editorTemplate, locale, folder) })
        }
        this.emitFile({ type: 'asset', fileName: ROBOTS_FILE, source: robotsText(site) })
        this.emitFile({ type: 'asset', fileName: SITEMAP_FILE, source: sitemapText(sitemapAddresses(site)) })
      },
    },
  }
}

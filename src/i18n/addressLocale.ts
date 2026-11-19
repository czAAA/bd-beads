import { type Ref, shallowRef, watch } from 'vue'
import { LOCALES, type Locale } from '../domain/locale'

// A language's code in the address (ticket 1053): `/ru/` is the Homepage in Russian and `/ru/app/` the editor, built
// pages of their own (vite.crawler.ts). Opening one makes its language the device's; the strip's Language then
// changes the code in place, and the links between the pages keep it. An address with no code is left as it is.

/** The language a path names: its first folder under the base path, when that is one of the app's languages. */
function localeOfPath(pathname: string, base: string): Locale | undefined {
  if (!pathname.startsWith(base)) return undefined
  const first = pathname.slice(base.length).split('/')[0]
  return LOCALES.find((locale) => locale === first)
}

/** The base path of a language's pages: its folder under the base path, or the base path itself when none is named. */
function localeBase(base: string, locale: Locale | undefined): string {
  return locale ? `${base}${locale}/` : base
}

/** `pathname`, which names a language, with `locale`'s code in its place: the same page in another language. */
function pathInLocale(pathname: string, base: string, locale: Locale): string {
  const named = localeOfPath(pathname, base)
  if (!named) return pathname
  return `${localeBase(base, locale)}${pathname.slice(localeBase(base, named).length)}`
}

const BASE = import.meta.env.BASE_URL

/** The language the page's address names, once `followAddressLocale` has read it. */
const named = shallowRef<Locale | undefined>()

/** The base path the links between the app's pages are built on (the Homepage, the editor and their own addresses): the
 * address's language folder when it names one, so going from one page to the other keeps the code. Reactive. */
export function pagesBase(): string {
  return localeBase(BASE, named.value)
}

/** What of the page the address's language reads and changes. */
interface AddressPage {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  history: Pick<History, 'state' | 'replaceState'>
}

/** Called once as a page starts, before its language is loaded: an address that names a language makes it the
 * device's (`chosen`, the saved preference), and from then on the code follows the language shown, with no reload. An
 * address with no code is left as it is. Returns what undoes it, for tests. */
export function followAddressLocale(chosen: Ref<Locale>, page: AddressPage = window): () => void {
  named.value = localeOfPath(page.location.pathname, BASE)
  if (!named.value) return () => undefined
  chosen.value = named.value
  const stop = watch(chosen, (next) => {
    named.value = next
    const { pathname, search, hash } = page.location
    page.history.replaceState(page.history.state, '', `${pathInLocale(pathname, BASE, next)}${search}${hash}`)
  })
  return () => {
    stop()
    named.value = undefined
  }
}

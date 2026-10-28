import { type ComputedRef, type InjectionKey, type Ref, computed, inject, provide, shallowReactive, watchEffect } from 'vue'
import { useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import type { Locale, Translations } from './translations'

export interface I18n {
  /** The language shown. It changes through setLocale, once the language's strings are here. */
  locale: Readonly<Ref<Locale>>
  setLocale: (locale: Locale) => void
  t: ComputedRef<Translations>
}

// Each language is a file of its own (ticket 0616): the one in use is fetched before the app starts, the others when
// chosen. The offline copy holds every file of the build (vite.pwa.ts), so a language chosen offline loads too.
const loaders: Record<Locale, () => Promise<Translations>> = {
  en: async () => (await import('./en')).en,
  ru: async () => (await import('./ru')).ru,
  uk: async () => (await import('./uk')).uk,
  be: async () => (await import('./be')).be,
  zh: async () => (await import('./zh')).zh,
  es: async () => (await import('./es')).es,
  pl: async () => (await import('./pl')).pl,
}

/** The languages fetched so far. */
const loaded = shallowReactive<Partial<Record<Locale, Translations>>>({})
const arriving = new Map<Locale, Promise<Translations>>()

/** Fetches a language's strings, once. The app awaits the one in use before it mounts (main.ts, homepage.ts), as every
 * component reads its strings when it first renders. */
export function loadLocale(locale: Locale): Promise<Translations> {
  const ready = loaded[locale]
  if (ready) return Promise.resolve(ready)
  let pending = arriving.get(locale)
  if (!pending) {
    pending = loaders[locale]()
      .then((strings) => (loaded[locale] = strings))
      .finally(() => arriving.delete(locale))
    arriving.set(locale, pending)
  }
  return pending
}

/** @internal Forgets every language fetched, as a page just opened has none: where the tests of choosing a language
 * not fetched yet start. */
export function forgetLoadedLocales(): void {
  for (const locale of Object.keys(loaded) as Locale[]) delete loaded[locale]
}

const I18N_KEY: InjectionKey<I18n> = Symbol('i18n')

function stringsOf(locale: Locale): Translations {
  const strings = loaded[locale]
  if (!strings) throw new Error(`The ${locale} strings are not loaded: loadLocale() them before the app mounts`)
  return strings
}

function createI18n(preferences: DevicePreferences): I18n {
  const chosen = preferences.get('locale')
  /** The language asked for last, so one asked for earlier that arrives later does not take its place. */
  let wanted = chosen.value

  function setLocale(next: Locale) {
    wanted = next
    if (loaded[next]) {
      chosen.value = next
      return
    }
    // Until it arrives the language shown stays, and it stays if the file cannot be fetched.
    loadLocale(next).then(
      () => {
        if (wanted === next) chosen.value = next
      },
      () => undefined,
    )
  }

  return { locale: computed(() => chosen.value), setLocale, t: computed(() => stringsOf(chosen.value)) }
}

/** Call once, at the root of the component tree, so descendants share one language via useI18n(). */
export function provideI18n(preferences: DevicePreferences = useDevicePreferences()): I18n {
  const i18n = createI18n(preferences)
  // `lang` on <html> follows the app language, so screen readers and hyphenation use the right one.
  watchEffect(() => {
    document.documentElement.lang = i18n.locale.value
  })
  provide(I18N_KEY, i18n)
  return i18n
}

/** Falls back to a standalone instance when mounted without an ancestor provideI18n() (e.g. in isolated component tests). */
export function useI18n(): I18n {
  return inject(I18N_KEY, null) ?? createI18n(useDevicePreferences())
}

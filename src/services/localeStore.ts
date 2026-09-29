import type { Locale } from '../i18n/translations'

const STORAGE_KEY = 'bd-beads:locale'
const DEFAULT_LOCALE: Locale = 'en'

/** Where the app's language is kept on this device (ADR 0020). */
export interface LocaleStore {
  load: () => Locale
  save: (locale: Locale) => void
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

export function loadLocale(): Locale {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'en' || raw === 'ru' ? raw : DEFAULT_LOCALE
}

/** The language in this browser's localStorage. */
export const browserLocaleStore: LocaleStore = { load: loadLocale, save: saveLocale }

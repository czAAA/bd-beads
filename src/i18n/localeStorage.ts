import type { Locale } from './translations'

const STORAGE_KEY = 'bd-beads:locale'
const DEFAULT_LOCALE: Locale = 'ru'

export function saveLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

export function loadLocale(): Locale {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'en' || raw === 'ru' ? raw : DEFAULT_LOCALE
}

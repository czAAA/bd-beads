/** The languages the app is translated into, in the order the language switcher lists them (ADR 0039). All are left to right. */
export const LOCALES = ['en', 'ru', 'zh', 'es', 'pl'] as const

/** One of the app's languages (i18n/ holds the strings; domain/ only needs the type for number formatting). */
export type Locale = (typeof LOCALES)[number]

/** The language's code written as the switcher shows it: "EN", "ZH". */
export function localeCode(locale: Locale): string {
  return locale.toUpperCase()
}

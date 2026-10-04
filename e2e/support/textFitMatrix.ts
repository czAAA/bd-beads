import type { Locale } from '../../src/i18n/translations'

/** Where the text fit check and the hover text check look (tickets 229 and 264): every language the app is translated into, at every screen width it supports. */
// Typed so that a language added to the app fails the type check until it is listed here.
export const LOCALES = Object.keys({ en: 0, ru: 0 } satisfies Record<Locale, 0>) as Locale[]
export const WIDTHS = [1900, 1280, 1024, 768, 390, 360, 320]
/** A typical screen height at each width, so that what is tall or short is as a person would meet it. */
export const HEIGHTS: Record<number, number> = { 1900: 1000, 1280: 800, 1024: 768, 768: 1024, 390: 844, 360: 740, 320: 640 }

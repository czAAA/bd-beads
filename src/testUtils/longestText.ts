import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import type { Locale, Translations } from '../i18n/translations'

/** A test-only language for the text fit tests (ticket 0606): every string is the widest of its seven translations, so
 * one mount shows, at each place, the most text any language puts there. It is shown in place of Russian, whose plural
 * rules have the most forms, so numbers and counts follow Russian. Only for `*.browser.test.ts`. */

/** A language a fit test is tried in: a real one, or "longest". */
export type FitLocale = Locale | 'longest'

/** Russian as it ships, kept before `showLongestText` writes over it. */
const RUSSIAN: Translations = { ...ru }
/** Each language as its carousel tab shows it: a feature with no shorter wording for the tab shows its full one. */
const asShown = (translations: Translations): Translations => {
  const features = Object.entries(translations.overview.features)
    .map(([key, copy]) => [key, { ...copy, tabName: copy.tabName ?? copy.name, tabLine: copy.tabLine ?? copy.text }])
  return { ...translations, overview: { ...translations.overview, features: Object.fromEntries(features) } }
}
const BY_LOCALE: Record<Locale, Translations> = { en, ru: RUSSIAN, uk, be, zh, es, pl }
const DICTIONARIES: Translations[] = Object.values(BY_LOCALE).map(asShown)
const PLURAL_RULES: readonly Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other']
/** The UI's own font, in which the translations are compared. */
const FONT = '500 13px Inter'

type Measure = (text: string) => number

const isPluralForms = (value: object): value is Record<string, string> =>
  'other' in value && Object.keys(value).every((key) => (PLURAL_RULES as readonly string[]).includes(key))

/** The widest of `values`, the same place in each language: a string, a counted word's forms (each form the widest any
 * language uses for that count) or a function's result; objects and lists are merged place by place. */
function widest(values: unknown[], measure: Measure): unknown {
  const pick = (texts: string[]) => texts.reduce((best, text) => (measure(text) > measure(best) ? text : best))
  const present = values.filter((value) => value !== undefined)
  const first = present[0]
  if (typeof first === 'string') return pick(present as string[])
  if (typeof first === 'function') return (...args: unknown[]) => pick(present.map((call) => (call as (...a: unknown[]) => string)(...args)))
  if (Array.isArray(first)) {
    const length = Math.max(...present.map((list) => (list as unknown[]).length))
    return Array.from({ length }, (_, index) => widest(present.map((list) => (list as unknown[])[index]), measure))
  }
  if (first && typeof first === 'object') {
    const objects = present as Record<string, unknown>[]
    if (objects.every(isPluralForms)) {
      return Object.fromEntries(PLURAL_RULES.map((rule) => [rule, pick(objects.map((forms) => (forms[rule] ?? forms.other) as string))]))
    }
    const keys = [...new Set(objects.flatMap((object) => Object.keys(object)))]
    return Object.fromEntries(keys.map((key) => [key, widest(objects.map((object) => object[key]), measure)]))
  }
  return first
}

/** A measure of text in the UI's own font, once the font's faces for every character of `texts` are loaded. */
export async function measureInUiFont(texts: readonly string[]): Promise<Measure> {
  await document.fonts.load(FONT, [...new Set(texts.join(''))].join(''))
  const context = document.createElement('canvas').getContext('2d')!
  context.font = FONT
  const widths = new Map<string, number>()
  return (text) => widths.get(text) ?? widths.set(text, context.measureText(text).width).get(text)!
}

let longest: Promise<Translations> | undefined

/** The "longest" language, built once per test file, after the font's faces for every script are loaded. */
function longestTranslations(): Promise<Translations> {
  longest ??= (async () => widest(DICTIONARIES, await measureInUiFont([JSON.stringify(DICTIONARIES)])) as Translations)()
  return longest
}

/** The text a test mounted in `locale` shows. */
export async function textIn(locale: FitLocale): Promise<Translations> {
  return locale === 'longest' ? longestTranslations() : BY_LOCALE[locale]
}

/** Russian's text becomes the "longest" language's, until `showRussian`; set the language to Russian to see it. */
export async function showLongestText(): Promise<void> {
  Object.assign(ru, await longestTranslations())
}

/** Russian's own text again. */
export function showRussian(): void {
  Object.assign(ru, RUSSIAN)
}

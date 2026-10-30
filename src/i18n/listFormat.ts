import type { Locale } from './translations'

const formats = new Map<string, Intl.ListFormat>()

/** `items` as one phrase in `locale`'s own words, "11/0, 10/0 and 8/0" or "matte or luster" (ticket 0713): the
 * conjunction or disjunction a sentence's blank takes, never a hand-joined ", ". */
export function formatList(locale: Locale, items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  const key = `${locale}/${type}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.ListFormat(locale, { type, style: 'long' })
    formats.set(key, format)
  }
  return format.format(items)
}

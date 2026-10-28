import { describe, expect, it } from 'vitest'
import { LOCALES } from '../domain/locale'
import { be } from './be'
import { en } from './en'
import { es } from './es'
import { pl } from './pl'
import { ru } from './ru'
import { uk } from './uk'
import { zh } from './zh'
import type { Locale, Translations } from './translations'

// `fillBlanks` fails when a caller's values and the string's blanks differ, but a test runs in one language. So every
// language holds the same blanks as English for each string (ticket 0614), and the caller tested in English fits all.
const ALL: Record<Locale, Translations> = { en, ru, uk, be, zh, es, pl }
const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

function blanksOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort()
}

/** Each string by its path, with a counted word's forms as one entry: a form may spell its count out ("Added an empty
 * row"), so the forms are held to the blanks English's `other` has besides `{count}`. */
function blanksByPath(node: unknown, path = '', out = new Map<string, string[]>()): Map<string, string[]> {
  if (typeof node === 'string') out.set(path, blanksOf(node))
  else if (node && typeof node === 'object') {
    const entries = Object.entries(node)
    if ('other' in node && entries.every(([form]) => PLURAL_FORMS.has(form))) {
      for (const [form, text] of entries) out.set(`${path} (${form})`, blanksOf(String(text)).filter((blank) => blank !== 'count'))
    } else for (const [key, value] of entries) blanksByPath(value, path ? `${path}.${key}` : key, out)
  }
  return out
}

describe('the blanks of a translated string', () => {
  const english = blanksByPath(en)

  it.each(LOCALES.filter((locale) => locale !== 'en'))('are the same in %s as in English', (locale) => {
    const differ: string[] = []
    for (const [path, blanks] of blanksByPath(ALL[locale])) {
      const countedForm = path.match(/^(.*) \(\w+\)$/)
      const expected = english.get(path) ?? (countedForm ? english.get(`${countedForm[1]} (other)`) : undefined)
      if (expected && blanks.join() !== expected.join()) differ.push(`${path}: [${blanks}] not [${expected}]`)
    }
    expect(differ).toEqual([])
  })
})

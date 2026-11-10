import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { StarterCategoryId } from '../domain/starters'
import { TECHNIQUES } from '../domain/weave'
import { formatList } from '../i18n/listFormat'
import { pluralForm } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import { STARTER_CATEGORY_IDS, catalogCounts, starterCount } from './appCounts'

// The No account tile's free list (ticket 0742; Homepage card, the free list): the app's real features in the order of
// the design system's list. Its counts and names are read from the app, so a new Technique, catalog or Starter shows up.

/** The rows in order, by their key in `homepage.plans.free.rows`. */
const ROWS = [
  'browser',
  'canvas',
  'techniques',
  'projects',
  'picture',
  'frame',
  'schemas',
  'rowProgress',
  'editor',
  'pdf',
  'png',
  'beadsNeeded',
  'colors',
  'file',
  'wordChart',
  'mirror',
  'starters',
] as const

/** The free list's rows in a language, "More on the way" left to the tile, which draws it apart. */
export function freeListRows(t: Translations, locale: Locale): string[] {
  const { rows } = t.homepage.plans.free
  const lower = (words: string[]) => words.map((word) => word.toLocaleLowerCase(locale))
  const colors = catalogCounts(locale)
  const starters = starterCount()
  const values = {
    techniques: { count: TECHNIQUES.length, names: formatList(locale, lower(TECHNIQUES.map((technique) => techniqueName(t, technique)))) },
    colors: { brands: colors.brands, codes: groupThousands(colors.codes, locale) },
    starters: {
      count: starters,
      categories: formatList(locale, lower(STARTER_CATEGORY_IDS.map((id) => t.starters.categories[id as StarterCategoryId].name))),
    },
  }
  return ROWS.map((key) => {
    const row = rows[key]
    if (typeof row === 'string') return key === 'colors' ? fillBlanks(row, values.colors) : row
    const blanks = key === 'techniques' ? values.techniques : values.starters
    return fillBlanks(pluralForm(locale, blanks.count, row), { ...blanks, count: groupThousands(blanks.count, locale) })
  })
}

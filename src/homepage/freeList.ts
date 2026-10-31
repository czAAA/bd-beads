import { offeredBeads, uniqueBy } from '../domain/beads'
import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { StarterCategoryId } from '../domain/starters'
import { TECHNIQUES } from '../domain/weave'
import { formatList } from '../i18n/listFormat'
import { pluralForm } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
// The registry's own list of categories, not `STARTER_CATEGORIES`, which would bring every Starter's design to the Homepage.
import categories from '../data/starters/categories.json'

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
  const withCatalog = offeredBeads().filter((bead) => bead.formFactor.colorCatalog)
  const catalogs = [...new Set(withCatalog.map((bead) => bead.formFactor.colorCatalog!))]
  const codes = catalogs.reduce((sum, id) => sum + (__COLOR_CATALOG_CODES__[id] ?? 0), 0)
  const starters = categories.reduce((sum, category) => sum + category.starters.length, 0)
  const values = {
    techniques: { count: TECHNIQUES.length, names: formatList(locale, lower(TECHNIQUES.map((technique) => techniqueName(t, technique)))) },
    colors: { brands: formatList(locale, uniqueBy(withCatalog, (bead) => bead.brand.id).map((bead) => bead.brand.name)), codes: groupThousands(codes, locale) },
    starters: {
      count: starters,
      categories: formatList(locale, lower(categories.map(({ id }) => t.starters.categories[id as StarterCategoryId].name))),
    },
  }
  return ROWS.map((key) => {
    const row = rows[key]
    if (typeof row === 'string') return key === 'colors' ? fillBlanks(row, values.colors) : row
    const blanks = key === 'techniques' ? values.techniques : values.starters
    return fillBlanks(pluralForm(locale, blanks.count, row), { ...blanks, count: groupThousands(blanks.count, locale) })
  })
}

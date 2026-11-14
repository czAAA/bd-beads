import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { StarterCategoryId } from '../domain/starters'
import { TECHNIQUES } from '../domain/weave'
import { formatList } from '../i18n/listFormat'
import { pluralForm } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { InsideChapterId, Locale, Translations } from '../i18n/translations'
import type { IconName } from '../components/ui/icons'
import { STARTER_CATEGORY_IDS, catalogCounts, starterCount } from './appCounts'
import { insideChapters } from './inside/insideCopy'

// The free list (tickets 0742, 0947; Homepage card, the free list): the app's real features in the order of the design
// system's list, or in What's inside's chapters. Its counts and names are read from the app, so a new Technique, catalog or Starter shows up.

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
type FreeRowId = (typeof ROWS)[number]

/** The rows by the chapter of What's inside they belong to, for a new visitor's list (ticket 0947). */
const GROUPS: Record<InsideChapterId, readonly FreeRowId[]> = {
  draw: ['canvas', 'techniques', 'editor', 'mirror', 'frame', 'schemas'],
  startFrom: ['picture', 'starters'],
  beadColors: ['colors', 'beadsNeeded'],
  weaveKeep: ['rowProgress', 'pdf', 'png', 'wordChart', 'projects', 'file', 'browser'],
}

/** One chapter of the free list: its icon and name, What's inside's, and its rows. */
export interface FreeListGroup {
  id: InsideChapterId
  icon: IconName
  name: string
  rows: string[]
}

/** The free list's rows in a language, "More on the way" left to the tile, which draws it apart. */
export function freeListRows(t: Translations, locale: Locale): string[] {
  const rows = freeRowsById(t, locale)
  return ROWS.map((id) => rows[id])
}

/** The free list in What's inside's four chapters, in their order (ticket 0947), every row in one of them. */
export function freeListGroups(t: Translations, locale: Locale): FreeListGroup[] {
  const rows = freeRowsById(t, locale)
  return insideChapters(t, locale).map(({ id, icon, name }) => ({ id, icon, name, rows: GROUPS[id].map((row) => rows[row]) }))
}

/** Every row in a language, by its key. */
function freeRowsById(t: Translations, locale: Locale): Record<FreeRowId, string> {
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
  const fill = (key: FreeRowId) => {
    const row = rows[key]
    if (typeof row === 'string') return key === 'colors' ? fillBlanks(row, values.colors) : row
    const blanks = key === 'techniques' ? values.techniques : values.starters
    return fillBlanks(pluralForm(locale, blanks.count, row), { ...blanks, count: groupThousands(blanks.count, locale) })
  }
  return Object.fromEntries(ROWS.map((key) => [key, fill(key)])) as Record<FreeRowId, string>
}

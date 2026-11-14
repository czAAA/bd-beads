import { offeredBeads, uniqueBy } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { MAX_IMAGE_COLORS } from '../../domain/imageConversion'
import { formatList } from '../../i18n/listFormat'
import type { InsideChapterId, InsideRowId, Locale, Translations } from '../../i18n/translations'
import type { IconName } from '../../components/ui/icons'

// What's inside (Homepage card, tickets 0797, 0830): its 13 rows, each with the icon the editor uses for it, and the
// four chapters they are shown in. The names the copy points at come from the app, never typed into it: the catalog
// brands and Convert image's most colors.

/** One row as shown: its icon, name and line. */
interface InsideItem<Id extends string = string> {
  id: Id
  icon: IconName
  name: string
  text: string
}

/** The rows in the order the tour plays them: picture into pattern first in its chapter (ticket 0949). */
export const INSIDE_ROWS = [
  { id: 'canvas', icon: 'select' },
  { id: 'techniques', icon: 'grid' },
  { id: 'editing', icon: 'paint' },
  { id: 'mirror', icon: 'mirror' },
  { id: 'convert', icon: 'image' },
  { id: 'starters', icon: 'frame' },
  { id: 'reference', icon: 'reference-image' },
  { id: 'colors', icon: 'palette' },
  { id: 'letters', icon: 'pattern' },
  { id: 'rowProgress', icon: 'turn-row-direction' },
  { id: 'beadsNeeded', icon: 'bead' },
  { id: 'exports', icon: 'export' },
  { id: 'savedProjects', icon: 'library' },
] as const satisfies readonly { id: InsideRowId; icon: IconName }[]

/** The four chapters in order, each a run of the tour's rows from `first` to the next chapter's (ticket 0830). */
const INSIDE_CHAPTERS = [
  { id: 'draw', icon: 'paint', first: 'canvas' },
  { id: 'startFrom', icon: 'image', first: 'convert' },
  { id: 'beadColors', icon: 'palette', first: 'colors' },
  { id: 'weaveKeep', icon: 'turn-row-direction', first: 'rowProgress' },
] as const satisfies readonly { id: InsideChapterId; icon: IconName; first: InsideRowId }[]

/** One chapter as shown: its icon and name, its rows, and their names as one phrase, which describes it. */
export interface InsideChapter {
  id: InsideChapterId
  icon: IconName
  name: string
  rows: InsideItem<InsideRowId>[]
  describes: string
}

/** The brands with a Color catalog, joined as the language joins a list. */
function catalogBrands(locale: Locale): string {
  const withCatalog = offeredBeads().filter((bead) => bead.formFactor.colorCatalog)
  return formatList(locale, uniqueBy(withCatalog, (bead) => bead.brand.id).map((bead) => bead.brand.name))
}

/** The 13 rows in a language. */
function insideRows(t: Translations, locale: Locale): InsideItem<InsideRowId>[] {
  const blanks: Partial<Record<InsideRowId, Record<string, string | number>>> = {
    convert: { max: MAX_IMAGE_COLORS },
    colors: { brands: catalogBrands(locale) },
  }
  return INSIDE_ROWS.map(({ id, icon }) => {
    const copy = t.homepage.inside.rows[id]
    const filled = blanks[id]
    return { id, icon, name: copy.name, text: filled ? fillBlanks(copy.text, filled) : copy.text }
  })
}

/** The four chapters in a language, each holding its rows in the order the tour plays them (ticket 0830). */
export function insideChapters(t: Translations, locale: Locale): InsideChapter[] {
  const rows = insideRows(t, locale)
  const starts = INSIDE_CHAPTERS.map(({ first }) => rows.findIndex((row) => row.id === first))
  return INSIDE_CHAPTERS.map(({ id, icon }, index) => {
    const own = rows.slice(starts[index], starts[index + 1])
    return { id, icon, name: t.homepage.inside.chapters[id], rows: own, describes: formatList(locale, own.map((row) => row.name)) }
  })
}

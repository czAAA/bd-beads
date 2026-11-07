import { offeredBeads, uniqueBy } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { MAX_IMAGE_COLORS } from '../../domain/imageConversion'
import { formatList } from '../../i18n/listFormat'
import type { InsideRowId, Locale, Translations } from '../../i18n/translations'
import type { IconName } from '../../components/ui/icons'

// What's inside (Homepage card, ticket 0797): its 13 rows, each with the icon the editor uses for it. The names the
// copy points at come from the app, never typed into it: the catalog brands and Convert image's most colors.

/** One row as shown: its icon, name and line. */
export interface InsideItem<Id extends string = string> {
  id: Id
  icon: IconName
  name: string
  text: string
}

/** The rows in the order the tour plays them. */
export const INSIDE_ROWS = [
  { id: 'canvas', icon: 'select' },
  { id: 'techniques', icon: 'grid' },
  { id: 'editing', icon: 'paint' },
  { id: 'mirror', icon: 'mirror' },
  { id: 'reference', icon: 'reference-image' },
  { id: 'convert', icon: 'image' },
  { id: 'colors', icon: 'palette' },
  { id: 'letters', icon: 'pattern' },
  { id: 'starters', icon: 'frame' },
  { id: 'rowProgress', icon: 'turn-row-direction' },
  { id: 'beadsNeeded', icon: 'bead' },
  { id: 'exports', icon: 'export' },
  { id: 'savedProjects', icon: 'library' },
] as const satisfies readonly { id: InsideRowId; icon: IconName }[]

/** The brands with a Color catalog, joined as the language joins a list. */
function catalogBrands(locale: Locale): string {
  const withCatalog = offeredBeads().filter((bead) => bead.formFactor.colorCatalog)
  return formatList(locale, uniqueBy(withCatalog, (bead) => bead.brand.id).map((bead) => bead.brand.name))
}

/** The 13 rows in a language. */
export function insideRows(t: Translations, locale: Locale): InsideItem<InsideRowId>[] {
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

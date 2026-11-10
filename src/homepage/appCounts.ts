import { offeredBeads, uniqueBy } from '../domain/beads'
import { formatList } from '../i18n/listFormat'
import type { Locale } from '../i18n/translations'
// The registry's own list of categories, not `STARTER_CATEGORIES`, which would bring every Starter's design to the Homepage.
import categories from '../data/starters/categories.json'

// What the Homepage counts from the app, never typed (tickets 0742, 0830): the free list and the Welcome section both
// say how many bead colors and Starters there are, so a new catalog or Starter shows up in both.

/** The Color catalogs' brands as a list in a language, and how many codes they hold together. */
export function catalogCounts(locale: Locale): { brands: string; codes: number } {
  const withCatalog = offeredBeads().filter((bead) => bead.formFactor.colorCatalog)
  const catalogs = [...new Set(withCatalog.map((bead) => bead.formFactor.colorCatalog!))]
  return {
    brands: formatList(locale, uniqueBy(withCatalog, (bead) => bead.brand.id).map((bead) => bead.brand.name)),
    codes: catalogs.reduce((sum, id) => sum + (__COLOR_CATALOG_CODES__[id] ?? 0), 0),
  }
}

/** The Starters' categories, in the gallery's order. */
export const STARTER_CATEGORY_IDS = categories.map(({ id }) => id)

/** How many Starters the gallery holds. */
export function starterCount(): number {
  return categories.reduce((sum, category) => sum + category.starters.length, 0)
}

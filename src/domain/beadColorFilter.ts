import { makerCodeOf } from './beadCodeSearch'
import type { Bead } from './beads'
import type { CatalogSwatch } from './beadSwatch'
import { catalogEntry, type ColorCatalog, type Finish } from './colorCatalog'

/** The values on in the Bead colors list's two filter rows (ticket 0713): families of the Bead's Brand and shared
 * Finishes. An empty row is off and keeps every code. */
export interface BeadColorFilter {
  families: readonly string[]
  finishes: readonly Finish[]
}

/** The codes of `swatches` that `typed` finds, in groups, each in catalog order (ticket 0713): the code `typed` names
 * normalized as a shop writes it (`makerCodeOf`, ticket 0696), the codes that code is a prefix of, the codes the raw
 * text is a part of, then those whose family name contains it. Nothing typed lists all; no Bead reads no shop code. */
export function searchBeadColors(
  swatches: readonly CatalogSwatch[],
  typed: string,
  bead: Pick<Bead, 'formFactor' | 'size'> | undefined,
  familyName: (family: string) => string,
): CatalogSwatch[] {
  const needle = typed.trim().toLowerCase()
  if (!needle) return [...swatches]
  const code = bead && makerCodeOf(typed, bead)
  const groups: CatalogSwatch[][] = [[], [], [], []]
  for (const entry of swatches) {
    const group =
      code && entry.code === code ? 0
      : code && entry.code.startsWith(code) ? 1
      : entry.code.toLowerCase().includes(needle) ? 2
      : familyName(entry.family).toLowerCase().includes(needle) ? 3
      : undefined
    if (group !== undefined) groups[group]!.push(entry)
  }
  return groups.flat()
}

const passes = (entry: CatalogSwatch, filter: BeadColorFilter) =>
  (filter.families.length === 0 || filter.families.includes(entry.family)) && (filter.finishes.length === 0 || filter.finishes.includes(entry.finish))

/** The swatches of any on family in any on Finish; a row with nothing on keeps every code. */
export function filterBeadColors(swatches: readonly CatalogSwatch[], filter: BeadColorFilter): CatalogSwatch[] {
  return swatches.filter((entry) => passes(entry, filter))
}

/** Each value's live count: the rows it would show given everything else that is on, so its own row's other values do
 * not narrow it (Blue counts every blue code the Finish row and the search leave). A value absent from the maps has none. */
export function beadColorFilterCounts(swatches: readonly CatalogSwatch[], filter: BeadColorFilter): { families: Map<string, number>; finishes: Map<Finish, number> } {
  const families = new Map<string, number>()
  const finishes = new Map<Finish, number>()
  for (const entry of swatches) {
    if (passes(entry, { families: [], finishes: filter.finishes })) families.set(entry.family, (families.get(entry.family) ?? 0) + 1)
    if (passes(entry, { families: filter.families, finishes: [] })) finishes.set(entry.finish, (finishes.get(entry.finish) ?? 0) + 1)
  }
  return { families, finishes }
}

/** The code `typed` names when `catalog` has it but not in `bead`'s size, with its sizes, for the empty state's size
 * sentence (ticket 0713): the normalized code, else the text less a `#`, dashes, spaces and leading zeros (`DB-0433` on
 * a Delica 15/0, whose own prefix is `DBS`). Undefined when the code is in the Bead's size or in no size. */
export function codeInOtherSizes(catalog: ColorCatalog, typed: string, bead: Pick<Bead, 'formFactor' | 'size'>): { code: string; sizes: string[] } | undefined {
  const code = makerCodeOf(typed, bead) ?? typed.trim().toUpperCase().replace(/^#|[-\s]/g, '').replace(/^([A-Z]*)0+(?=\d)/, '$1')
  const sizes = catalogEntry(catalog, code)?.sizes
  return sizes && !sizes.includes(bead.size) ? { code, sizes } : undefined
}

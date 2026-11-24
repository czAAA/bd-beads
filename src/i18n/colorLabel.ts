import { catalogEntry, type ColorCatalog, type Finish } from '../domain/colorCatalog'
import { fillBlanks } from '../domain/fillBlanks'
import { catalogName, familyColorId, familyOf, isAddedColorId, type PaletteColor } from '../domain/palette'
import { colorName } from './colorName'
import type { Translations } from './translations'

/** A color as every place that names one knows it: a Palette swatch, a found color's target, a Beads needed row. */
export interface LabelledColor {
  id?: string
  hex: string
  /** The maker's catalog code, when the color was picked from a Color catalog. */
  code?: string
  /** The Color catalog the code is from (ADR 0103), when a Palette swatch knows it: another one names it by its code alone. */
  catalog?: string
  /** Where the catalog puts the code, when the place already knows it; else the `catalog` passed to `colorLabel`. */
  family?: string
  finish?: Finish
}

/** What a color reads as, and the hex that goes in a Tooltip when the text is not the hex itself. */
export interface ColorLabel {
  text: string
  hex?: string
}

/** The one way to name a color (ticket 0760): a catalog color is "code name", a Palette color its name, a Custom color
 * its hex; a named color's hex is for a Tooltip. The catalogs hold no maker names, so a name is the Finish and the
 * color family, and until the catalog has loaded it is the code alone. */
export function colorLabel(t: Translations, color: LabelledColor, catalog?: ColorCatalog): ColorLabel {
  const hex = color.hex.toUpperCase()
  if (color.code) {
    const own = catalog && (color.catalog === undefined || color.catalog === catalog.id) ? catalog : undefined
    const entry = own && catalogEntry(own, color.code)
    const family = color.family ?? entry?.family[0]
    const finish = color.finish ?? entry?.finish
    if (!family || !finish) return { text: color.code, hex }
    return { text: `${color.code} ${catalogColorName(t, family, finish)}`, hex }
  }
  if (color.id && !isAddedColorId(color.id)) return { text: colorName(t, { id: color.id, hex: color.hex }), hex }
  return { text: hex }
}

/** A catalog code's name after its code, its Finish and its color family ("Opaque Black", ticket 0966). */
function catalogColorName(t: Translations, family: string, finish: Finish): string {
  const familyWords = colorName(t, { id: familyColorId(family), hex: '' }) || family
  return fillBlanks(t.palette.catalogColorName, { finish: t.palette.beadColors.finishes[finish], family: familyWords })
}

/** A catalog code with its catalog, "TOHO code 341" (ticket 1226): a list row's first line, and what follows the family in
 * the head and a swatch's Tooltip. */
export function codeInCatalog(t: Translations, catalog: string, code: string): string {
  return fillBlanks(t.palette.codeInCatalog, { section: catalogName(catalog), code })
}

/** A swatch's code named with its catalog (ticket 1226): "Red · TOHO code 341" in the head and the Tooltip, the color
 * family first where it is known (a default color's own, or the loaded `catalog`'s entry); a Custom color has no code and
 * keeps its own name. */
export function codeName(t: Translations, color: PaletteColor | undefined, catalog?: ColorCatalog): string {
  if (!color?.code || !color.catalog) return colorName(t, color)
  const entry = catalog?.id === color.catalog ? catalogEntry(catalog, color.code) : undefined
  const family = isAddedColorId(color.id) ? entry?.family[0] : undefined
  const familyWords = isAddedColorId(color.id) ? family && (colorName(t, { id: familyColorId(family), hex: '' }) || family) : (color.literalName ?? t.colorNames[familyOf(color)])
  const named = codeInCatalog(t, color.catalog, color.code)
  return familyWords ? fillBlanks(t.palette.codeHead, { family: familyWords, section: catalogName(color.catalog), code: color.code }) : named
}

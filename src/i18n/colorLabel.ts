import { catalogEntry, type ColorCatalog, type Finish } from '../domain/colorCatalog'
import { fillBlanks } from '../domain/fillBlanks'
import { familyColorId, isAddedColorId } from '../domain/palette'
import { colorName } from './colorName'
import type { Translations } from './translations'

/** A color as every place that names one knows it: a Palette swatch, a found color's target, a Beads needed row. */
export interface LabelledColor {
  id?: string
  hex: string
  /** The maker's catalog code, when the color was picked from a Color catalog. */
  code?: string
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
    const entry = catalog && catalogEntry(catalog, color.code)
    const family = color.family ?? entry?.family[0]
    const finish = color.finish ?? entry?.finish
    if (!family || !finish) return { text: color.code, hex }
    const familyWords = colorName(t, { id: familyColorId(family), hex: '' }) || family
    const name = fillBlanks(t.palette.catalogColorName, { finish: t.palette.beadColors.finishes[finish], family: familyWords })
    return { text: `${color.code} ${name}`, hex }
  }
  if (color.id && !isAddedColorId(color.id)) return { text: colorName(t, { id: color.id, hex: color.hex }), hex }
  return { text: hex }
}

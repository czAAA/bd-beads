import { isAddedColorId, type PaletteColor } from '../domain/palette'
import type { Translations } from './translations'

/** A Palette color's name in words (ticket 0530): a brand's own literal as it is, a generic color's translation, and
 * "Custom color" for an added one or one the Palette doesn't hold; a swatch with a catalog code adds it (ticket 0538). The one lookup every place that names a color uses. */
export function colorName(t: Translations, color: PaletteColor | undefined): string {
  if (!color) return t.palette.customColorLabel
  if (isAddedColorId(color.id)) return color.code ?? t.palette.customColorLabel
  const name = color.literalName ?? t.colorNames[color.id] ?? color.hex
  return color.code ? `${name} · ${color.code}` : name
}

/** A color's name in a shopping list (Beads needed, the print): the Palette's name for it, or its hex when it has none
 * of its own (an added color, or one outside the Palette), so two added colors stay told apart. */
export function listedColorName(t: Translations, color: PaletteColor | undefined, hex: string): string {
  const name = color && !isAddedColorId(color.id) ? colorName(t, color) : hex.toUpperCase()
  return color?.code ? `${name} · ${color.code}` : name
}

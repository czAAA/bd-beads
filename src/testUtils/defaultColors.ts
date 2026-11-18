import { DEFAULT_BEAD } from '../domain/beads'
import { defaultPalette, type PaletteColor } from '../domain/palette'

/** A Bead's default color of a color family (ticket 1070), as a new Project's Palette holds it: on the Bead a new
 * Project starts on unless another is named. Throws for a family the Bead has no default color of. */
export function defaultColorOf(family: string, beadId: string = DEFAULT_BEAD.id): PaletteColor {
  const color = defaultPalette(beadId).find((each) => (each.family ?? each.id) === family)
  if (!color) throw new Error(`${beadId} has no default color of ${family}`)
  return color
}

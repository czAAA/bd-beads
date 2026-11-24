import { addUsedColor, codesInPalette, paletteColors, type PaletteCodes, type PaletteIds } from './palette'
import { touch, type Project } from './project'
import type { Layer } from './grid'
import { projectColors } from './layerBeads'
import { lettersFor, withLetter, type SwatchLetters } from './swatchLetters'
import { lettersOn, type Layered } from './layerRecord'

// The Project's Palette (ADR 0002, 0103, ticket 0525): its swatches in their sections, catalog codes and Swatch letters,
// which change together.

/** The Swatch letters of a Palette (ticket 0573): each color keeps the letter it had and a new one takes the lowest unused. */
export function lettersOfPalette(palette: PaletteIds, kept: unknown): SwatchLetters {
  return lettersFor(paletteColors(palette).map((color) => color.hex), kept)
}

/** The Project with a new Palette (adding, removing or moving a swatch), each section's swatches together (ADR 0103).
 * `codes` join it by hex and a swatch's code leaves with it (ticket 0538). */
export function setPalette(project: Project, palette: PaletteIds, codes: PaletteCodes = {}): Project {
  const held = { ...project.paletteCodes, ...codes }
  const ids = paletteColors(palette, held).map((color) => color.id)
  const kept = codesInPalette(held, ids)
  const { paletteCodes: _codes, ...rest } = project
  return touch(rest, { palette: ids, paletteLetters: lettersOfPalette(ids, project.paletteLetters), ...(Object.keys(kept).length > 0 ? { paletteCodes: kept } : {}) })
}

/** The Palette with every color the layers show and it lacks added last, among the Custom colors, in the order the
 * layers hold them (ticket 1124): every bead's color has a Swatch letter, so no export prints "?". The same ids when
 * none is missing. */
export function withUsedColors(palette: PaletteIds, project: Layered, codes: PaletteCodes = {}): PaletteIds {
  return projectColors(project).reduce((ids, hex) => addUsedColor(ids, hex, codes).ids, palette)
}

/** The Project with every color its beads show in its Palette (ticket 1124), as every Edit leaves it (a Paste from
 * another Project, a Frame grown back over its Folded beads) and opening does. Not stamped: adding takes no code. The
 * same Project when none is missing. */
export function withColorsInPalette(project: Project): Project {
  const palette = withUsedColors(project.palette, project, project.paletteCodes)
  return palette === project.palette ? project : { ...project, palette, paletteLetters: lettersOfPalette(palette, project.paletteLetters) }
}

/** The Project with a Palette color's Swatch letter changed to one the maker typed (ticket 1092), a color that had it
 * taking this one's; the very same Project when nothing changes (see `withLetter`). */
export function setSwatchLetter(project: Project, hex: string, letter: string): Project {
  const changed = project.paletteLetters && withLetter(project.paletteLetters, hex, letter)
  return changed ? touch(project, { paletteLetters: changed.letters }) : project
}

/** The Project with the letters `kept` given back to the colors that had them (ticket 1092): a color put back in the
 * Palette by a removal's Undo keeps the letter the maker gave it, unless another color has taken it since. */
export function withLettersBack(project: Project, kept: SwatchLetters): Project {
  const letters = { ...project.paletteLetters }
  for (const [hex, letter] of Object.entries(kept)) {
    if (letters[hex] !== undefined && !Object.entries(letters).some(([other, held]) => other !== hex && held === letter)) letters[hex] = letter
  }
  return { ...project, paletteLetters: letters }
}

/** The Swatch letters to print on a layer's beads: the Project's own while that layer's Letters is on, none otherwise
 * (tickets 0573, 1092). */
export function shownLetters(project: Pick<Project, 'layers' | 'paletteLetters'>, layer: Layer): SwatchLetters | undefined {
  return lettersOn(project, layer) ? project.paletteLetters : undefined
}

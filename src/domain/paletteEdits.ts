import { codesInPalette, defaultPalette, paletteColors, removedDefaultsAfter, type PaletteCodes, type PaletteIds } from './palette'
import { touch, type Project } from './project'
import type { Layer } from './grid'
import { lettersFor, withLetter, type SwatchLetters } from './swatchLetters'
import { beadIdOfLayer, lettersOn } from './layerRecord'

// The Project's Palette (ADR 0002, ticket 0525): its swatches, the defaults removed, catalog codes and Swatch letters,
// which change together.

/** The Swatch letters of a Palette (ticket 0573): each color keeps the letter it had and a new one takes the lowest unused. */
export function lettersOfPalette(palette: PaletteIds, beadId: string, kept: unknown): SwatchLetters {
  return lettersFor(paletteColors(palette, defaultPalette(beadId)).map((color) => color.hex), kept)
}

/** The Project with a new Palette (adding, removing or moving a swatch); the default colors that left it are
 * remembered as removed (ticket 0528). `codes` join it by hex and a swatch's code leaves with it (ticket 0538). */
export function setPalette(project: Project, palette: PaletteIds, codes: PaletteCodes = {}): Project {
  const removed = removedDefaultsAfter(project.palette, palette, project.removedDefaults ?? [])
  const beadId = beadIdOfLayer(project, 'frame')
  const kept = codesInPalette({ ...project.paletteCodes, ...codes }, palette, defaultPalette(beadId))
  const { removedDefaults: _removed, paletteCodes: _codes, ...rest } = project
  const paletteLetters = lettersOfPalette(palette, beadId, project.paletteLetters)
  return touch(rest, { palette, paletteLetters, ...(removed.length > 0 ? { removedDefaults: removed } : {}), ...(Object.keys(kept).length > 0 ? { paletteCodes: kept } : {}) })
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

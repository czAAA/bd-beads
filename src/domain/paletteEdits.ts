import { codesInPalette, defaultPalette, paletteColors, removedDefaultsAfter, type PaletteCodes, type PaletteIds } from './palette'
import { touch, type Project } from './project'
import { lettersFor, type SwatchLetters } from './swatchLetters'
import { beadIdOfLayer } from './layerRecord'

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
  const beadId = beadIdOfLayer(project, 'canvas')
  const kept = codesInPalette({ ...project.paletteCodes, ...codes }, palette, defaultPalette(beadId))
  const { removedDefaults: _removed, paletteCodes: _codes, ...rest } = project
  const paletteLetters = lettersOfPalette(palette, beadId, project.paletteLetters)
  return touch(rest, { palette, paletteLetters, ...(removed.length > 0 ? { removedDefaults: removed } : {}), ...(Object.keys(kept).length > 0 ? { paletteCodes: kept } : {}) })
}

/** The Project with Letters on or off (ticket 0573); off is the default and is left unsaved. */
export function withLetters(project: Project, on: boolean): Project {
  const { letters: _old, ...rest } = project
  return on ? { ...rest, letters: true } : rest
}

/** The Swatch letters to print on beads: the Project's own while Letters is on, none otherwise (ticket 0573). */
export function shownLetters(project: Pick<Project, 'letters' | 'paletteLetters'>): SwatchLetters | undefined {
  return project.letters ? project.paletteLetters : undefined
}

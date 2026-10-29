import { backgroundOf, canvasOf, lettersOn, withBackground, withCanvas, withLetters } from './layerRecord'
import type { PaletteCodes, PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { touch, type Project } from './project'
import type { SwatchLetters } from './swatchLetters'

// The Undo snapshot (ADR 0036): everything an Edit can change, taken before it and put back by Undo and Redo.

/** One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change. All immutable,
 * sharing structure. */
export interface UndoEntry {
  /** Every layer whole (ADR 0079, ticket 0664): its Weave, Bead, Bead shape, beads, Piece names, and the Frame's place,
   * shape, turn, name, Folded beads and Row progress, so Undo undoes any of them with the beads they moved. Its views
   * (the Project's name, the Canvas's orientation, the Letters switch, each layer's Background) are not put back. */
  layers: Project['layers']
  /** The Palette as it was, so Undo and Redo of adding, removing or moving a swatch restore it (ticket 0525). */
  palette: PaletteIds
  /** The removed default colors as they were (ticket 0528), restored with the Palette they belong to. */
  removedDefaults?: string[]
  /** The swatch codes as they were (ticket 0538), restored with the Palette they belong to. */
  paletteCodes?: PaletteCodes
  /** The Swatch letters as they were (ticket 0573), restored with the Palette they belong to. */
  paletteLetters?: SwatchLetters
}

/** The Project's state as an undo entry. */
export function snapshotOf(project: Project): UndoEntry {
  const { layers, palette, removedDefaults, paletteCodes, paletteLetters } = project
  return { layers, palette, removedDefaults, paletteCodes, paletteLetters }
}

/** The Project with everything an undo entry holds put back (see UndoEntry), keeping its name, the Canvas's
 * orientation, the Letters switch and each layer's Background (ticket 0666) as they are now. */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  const { removedDefaults: _removed, paletteCodes: _codes, paletteLetters: _letters, ...rest } = project
  const { name, orientation } = canvasOf(project)
  const restored = { ...rest, layers: entry.layers }
  // Each layer put back is the one recorded, the very object, unless a view changed since (ticket 0616).
  const viewed = name === canvasOf(entry).name && orientation === canvasOf(entry).orientation ? restored : withCanvas(restored, { name, orientation })
  const on = lettersOn(project)
  const lettered = viewed.layers.every((layer) => (layer.letters === true) === on) ? viewed : withLetters(viewed, on)
  const layered = (['canvas', 'frame'] as const).reduce((kept, layer) => {
    const now = backgroundOf(project, layer)
    return now === undefined || now === backgroundOf(kept, layer) ? kept : withBackground(kept, layer, now)
  }, lettered)
  return touch(layered, {
    palette: entry.palette,
    ...(entry.removedDefaults ? { removedDefaults: entry.removedDefaults } : {}),
    ...(entry.paletteCodes ? { paletteCodes: entry.paletteCodes } : {}),
    paletteLetters: lettersOfPalette(entry.palette, canvasOf(entry).beadId, entry.paletteLetters),
  })
}

import type { Layer } from './grid'
import type { BeadMap } from './canvas'
import type { HistoryCap } from './history'
import { framePlacement, withFrameAt } from './framePlacement'
import { backgroundOf, canvasOf, lettersOn, withBackground, withCanvas, withLetters, frameIdOf, framesOf } from './layerRecord'
import type { PaletteCodes, PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { MIRROR_OFF, mirrorBarOf, type MirrorBar, type MirrorPlace } from './mirror'
import { touch, type CanvasLayer, type Project } from './project'
import type { SwatchLetters } from './swatchLetters'

// The Undo snapshot (ADR 0036): everything an Edit can change, taken before it and put back by Undo and Redo.

/** One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change. All immutable,
 * sharing structure. */
export interface UndoEntry {
  /** Every layer whole (ADR 0079, ticket 0664): its Weave, Bead, beads, Piece names, and the Frame's place,
   * shape, turn, name, Folded beads and Row progress, so Undo undoes any of them with the beads they moved. Its views
   * (the Project's name, the Canvas's orientation, the Letters switch, each layer's Background) are not put back. */
  layers: Project['layers']
  /** The Palette as it was, so Undo and Redo of adding, removing or moving a swatch restore it (ticket 0525). */
  palette: PaletteIds
  /** The swatch codes as they were (ticket 0538), restored with the Palette they belong to. */
  paletteCodes?: PaletteCodes
  /** The Swatch letters as they were (ticket 0573), restored with the Palette they belong to. */
  paletteLetters?: SwatchLetters
  /** Where the Mirror was (ADR 0082, ticket 0750): making, moving, resizing and closing it are Undo steps, its Mode,
   * Axes and counts are not, so only its place is put back. */
  mirrorPlace?: MirrorPlace | null
  /** The Mirror's Mode, Axes and counts as they were, on a step whose change took them too (ticket 1027: a bar setting
   * that grew the Area), so Undo and Redo put the setting back with the size. Absent on every other step. */
  mirrorBar?: MirrorBar
}

/** The Project's state as an undo entry; with `mirrorBar`, the Mirror's bar settings too (a step that changed them). */
export function snapshotOf(project: Project, options: { mirrorBar?: boolean } = {}): UndoEntry {
  const { layers, palette, paletteCodes, paletteLetters } = project
  return {
    layers,
    palette,
    paletteCodes,
    paletteLetters,
    ...(project.mirror ? { mirrorPlace: project.mirror.place ?? null } : {}),
    ...(options.mirrorBar ? { mirrorBar: mirrorBarOf(project.mirror ?? MIRROR_OFF) } : {}),
  }
}

/** The Project with everything an undo entry holds put back (see UndoEntry), keeping its name, the Canvas's
 * orientation, each layer's Letters switch and its Background (ticket 0666) as they are now. */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  const { paletteCodes: _codes, paletteLetters: _letters, ...rest } = project
  const { name, orientation, origin } = canvasOf(project)
  const restored = { ...rest, layers: entry.layers }
  const was = canvasOf(entry)
  // Each layer put back is the one recorded, the very object, unless a view changed since (ticket 0616).
  // The Canvas's turn is a view: the Canvas put back lies as it does now, the Frame where it was on the table (ticket 1188).
  const unturned = orientation === was.orientation && (origin?.x ?? 0) === (was.origin?.x ?? 0) && (origin?.y ?? 0) === (was.origin?.y ?? 0)
  const viewed = name === was.name && unturned ? restored : unturned ? withCanvas(restored, { name }) : withCanvasAsNow(restored, { name, orientation, origin })
  const layers: Layer[] = ['canvas', ...framesOf(project).map(frameIdOf)]
  const lettered = layers.reduce((kept, layer) => withLetters(kept, layer, lettersOn(project, layer)), viewed)
  const layered = layers.reduce((kept, layer) => {
    const now = backgroundOf(project, layer)
    return now === undefined || now === backgroundOf(kept, layer) ? kept : withBackground(kept, layer, now)
  }, lettered)
  const bar = entry.mirrorBar
  const unplaced = (project.mirror?.place ?? null) === (entry.mirrorPlace ?? null) && !bar
  const placed = unplaced ? {} : { mirror: { ...(bar ?? project.mirror ?? MIRROR_OFF), place: entry.mirrorPlace ?? null } }
  return touch(layered, {
    ...placed,
    palette: entry.palette,
    ...(entry.paletteCodes ? { paletteCodes: entry.paletteCodes } : {}),
    paletteLetters: lettersOfPalette(entry.palette, entry.paletteLetters),
  })
}

/** The Project put back with its Canvas lying as it does now (its name, orientation and origin on the table), its Frame
 * where the entry had it on the table (ticket 1188). */
function withCanvasAsNow(restored: Project, now: Pick<CanvasLayer, 'name' | 'orientation' | 'origin'>): Project {
  const centres = framesOf(restored).map((frame) => [frameIdOf(frame), framePlacement(restored, frameIdOf(frame))!.at] as const)
  const { origin: _was, ...canvas } = canvasOf(restored)
  const { origin, ...view } = now
  const laid = { ...restored, layers: [{ ...canvas, ...view, ...(origin ? { origin } : {}) }, ...restored.layers.slice(1)] as Project['layers'] }
  return centres.reduce((placed, [id, centre]) => withFrameAt(placed, centre, id), laid)
}

// Estimates of what an Undo step holds (ticket 0677), rounded up from the research's 0.85 MB a whole-sheet 300 × 300
// repaint: a bead in a row of a bead map, a row besides its beads, and an entry besides its beads (mostly shared).
const BEAD_BYTES = 16
const ROW_BYTES = 64
const ENTRY_BYTES = 256

/** About how many bytes the rows of `beads` hold that `newer` replaced, each row held by reference (ADR 0036). */
function unsharedBytes(beads: BeadMap | undefined, newer: BeadMap | undefined): number {
  if (!beads || beads === newer) return 0
  let bytes = 0
  for (const row in beads) {
    if (beads[row] !== newer?.[row]) bytes += ROW_BYTES + Object.keys(beads[row]!).length * BEAD_BYTES
  }
  return bytes
}

/** About how many bytes an Undo step holds that the step after it does not share: the bead rows the edit between them
 * replaced, its shown and Folded beads in every layer. A one-bead stroke holds a row, a Fill of the sheet every row. */
function undoStepBytes(older: UndoEntry, newer: UndoEntry): number {
  return older.layers.reduce((bytes, layer, index) => {
    const after = newer.layers[index]
    const folded = (record: typeof layer | undefined) => (record && 'folded' in record ? record.folded : undefined)
    return bytes + unsharedBytes(layer.beads, after?.beads) + unsharedBytes(folded(layer), folded(after))
  }, ENTRY_BYTES)
}

/** How much the editing session's Undo steps may hold (ticket 0677; ADRs 0019, 0036): about 64 MB by the estimate,
 * some 45 whole-sheet repaints of a 300 × 300 Frame or thousands of strokes. Past it, the oldest steps are dropped. */
export const UNDO_CAP: HistoryCap<UndoEntry> = { bytes: 64 * 1024 * 1024, sizeOf: undoStepBytes }

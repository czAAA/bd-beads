import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { PaletteCodes, PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import type { PieceName } from './pieceNames'
import { touch, type Project, type RowProgress } from './project'
import type { SwatchLetters } from './swatchLetters'
import type { BeadShape, Technique } from './weave'

// The Undo snapshot (ADR 0036): everything an Edit can change, taken before it and put back by Undo and Redo.

/** One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change (beads, Row
 * progress, Bead, Frame, Technique). All immutable, sharing structure. */
export interface UndoEntry {
  beads: BeadMap
  rowProgress: RowProgress
  /** The Palette as it was, so Undo and Redo of adding, removing or moving a swatch restore it (ticket 0525). */
  palette: PaletteIds
  /** The removed default colors as they were (ticket 0528), restored with the Palette they belong to. */
  removedDefaults?: string[]
  /** The swatch codes as they were (ticket 0538), restored with the Palette they belong to. */
  paletteCodes?: PaletteCodes
  /** The Swatch letters as they were (ticket 0573), restored with the Palette they belong to. */
  paletteLetters?: SwatchLetters
  beadId: string
  /** The Bead copy as it was, restored with its id (ticket 534). */
  bead?: Bead
  /** The Frame with its own beads, as they were (ADR 0066). */
  frame: FrameSheet | undefined
  /** The Piece names as they were, so Undo and Redo of a naming or of a merge or split restore them (ticket 406). */
  pieceNames?: PieceName[]
  /** The Technique the entry was taken in, so Undo undoes a change of Technique (ticket 351). */
  technique: Technique
  /** The Brick block the entry was taken with, so Undo undoes a change of it (ticket 477). */
  brickBlock?: number
  /** The Net size the entry was taken with, so Undo undoes a change of it along with the beads it moved (ticket 0610). */
  netSize?: number
  /** The Bead shape the entry was taken with, so Undo undoes a change of it (ticket 508). */
  beadShape?: BeadShape
}

/** The Project's state as an undo entry. */
export function snapshotOf(project: Project): UndoEntry {
  return { beads: project.beads, rowProgress: project.rowProgress, palette: project.palette, removedDefaults: project.removedDefaults, paletteCodes: project.paletteCodes, paletteLetters: project.paletteLetters, beadId: project.beadId, bead: project.bead, frame: project.frame, pieceNames: project.pieceNames, technique: project.technique, brickBlock: project.brickBlock, netSize: project.netSize, beadShape: project.beadShape }
}

/** The Project with everything an undo entry holds put back (see UndoEntry). */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  const { pieceNames: _current, brickBlock: _block, netSize: _net, beadShape: _shape, removedDefaults: _removed, paletteCodes: _codes, paletteLetters: _letters, bead: _bead, ...rest } = project
  return touch(rest, {
    beads: entry.beads,
    rowProgress: entry.rowProgress,
    palette: entry.palette,
    beadId: entry.beadId,
    ...(entry.bead ? { bead: entry.bead } : {}),
    frame: entry.frame,
    technique: entry.technique,
    ...(entry.brickBlock ? { brickBlock: entry.brickBlock } : {}),
    ...(entry.netSize ? { netSize: entry.netSize } : {}),
    ...(entry.beadShape ? { beadShape: entry.beadShape } : {}),
    ...(entry.pieceNames ? { pieceNames: entry.pieceNames } : {}),
    ...(entry.removedDefaults ? { removedDefaults: entry.removedDefaults } : {}),
    ...(entry.paletteCodes ? { paletteCodes: entry.paletteCodes } : {}),
    paletteLetters: lettersOfPalette(entry.palette, entry.beadId, entry.paletteLetters),
  })
}

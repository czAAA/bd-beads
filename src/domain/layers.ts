import { beadsOver, beadsWithout, changedPositions, colorAt, frameContains, shiftedBeads, withColors, type BeadMap, type Frame, type FrameSheet } from './canvas'
import type { GridPosition, Layer } from './grid'

export type { Layer }
import { footprintOf } from './footprint'
import { weaveOf, type Project } from './project'

// The two layers of a Project (ADR 0066): the Canvas, and the Frame laid over it. Every drawing command (Paint, Fill,
// Eraser, Paste, Selection fills) works on one Project's beads in one coordinate system; `onLayer` hands it
// the layer as a Project of its own, so none of them has to know there are two.


/** What `layerAt` needs of a Project (ADR 0070): the Frame, and the Weaves that say how much of the Canvas it covers. */
export type Placed = Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>

/** Which layer a press at a Canvas position lands on (ADR 0066, 0070): the one the pointer's hit named, else under what
 * the Frame draws it is the Frame, anywhere else the Canvas. The one place that decides; a stroke asks once, at its
 * press, and keeps the answer. */
export function layerAt(project: Placed, position: GridPosition): Layer {
  if (position.layer) {
    return position.layer === 'frame' && project.frame ? 'frame' : 'canvas'
  }
  const covered = footprintOf(project)
  return covered && frameContains(covered, position) ? 'frame' : 'canvas'
}

/** A Canvas position in a layer's own coordinates: the Frame's are counted from its first row and column. */
export function positionInLayer(project: Pick<Project, 'frame'>, layer: Layer, position: GridPosition): GridPosition {
  const frame = layer === 'frame' ? project.frame : undefined
  return frame ? { row: position.row - frame.row, column: position.column - frame.column } : position
}

/** Every bead you see, by Canvas position: the Frame's laid over the Canvas's, which it hides where it lies. For what
 * asks about the picture as a whole (Select all, Fit to drawing); the same map back when there is no Frame. */
export function shownBeads(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'beads' | 'frame'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>): BeadMap {
  const frame = project.frame
  return frame ? beadsOver(beadsWithout(project.beads, footprintOf(project)!), shiftedBeads(frame.beads, frame.row, frame.column)) : project.beads
}

/** A position of a layer's own, back on the Canvas. */
export function positionOnCanvas(project: Pick<Project, 'frame'>, layer: Layer, position: GridPosition): GridPosition {
  const frame = layer === 'frame' ? project.frame : undefined
  return frame ? { row: position.row + frame.row, column: position.column + frame.column } : position
}

/** The Frame's own beads as a Project of its own: its beads, a Frame at (0, 0) the size of the real one, the Project's
 * Row progress and the Frame's own Weave (ticket 492), so the commands that know a Frame (Fill's limit, the Row
 * progress lock) work on it as they always did. Piece names are the Canvas's. The Project must have a Frame. */
export function frameLayer(project: Project): Project {
  const frame = project.frame!
  const { pieceNames: _canvasNames, brickBlock: _canvasBlock, netSize: _canvasNet, ...rest } = project
  const own: FrameSheet = { row: 0, column: 0, rows: frame.rows, columns: frame.columns, beads: frame.beads, ...weaveOf(frame) }
  return { ...rest, ...weaveOf(frame), beads: frame.beads, frame: own }
}

/** The Canvas as a Project of its own: the Frame is not part of it. */
function canvasLayer(project: Project): Project {
  const { frame: _frame, ...rest } = project
  return rest
}

/** A layer as a Project of its own, for what only reads it (Copy, the paste preview). The Frame's must exist. */
export function layerView(project: Project, layer: Layer): Project {
  return layer === 'frame' && project.frame ? frameLayer(project) : canvasLayer(project)
}

/** `after` with every position under the Frame put back as `before` had it: the Canvas beads a Frame covers are neither
 * changed nor drawn. The same map back when nothing was under it. */
function keepUnderFrame(before: BeadMap, after: BeadMap, frame: Frame): BeadMap {
  const reverts = changedPositions(before, after)
    .filter((position) => frameContains(frame, position))
    .map(({ row, column }) => ({ row, column, color: colorAt(before, row, column) }))
  return reverts.length === 0 ? after : withColors(after, reverts)
}

/** Runs a command on one layer. The command gets the layer as a Project (see `frameLayer`) and `local`, which turns a
 * Canvas position into one of that layer; what it makes is put back. The same Project back when the layer's beads came
 * back as they went in, which is a drawing command's "nothing changed". */
export function onLayer(project: Project, layer: Layer, command: (view: Project, local: (position: GridPosition) => GridPosition) => Project): Project {
  const frame = project.frame
  if (layer === 'frame') {
    if (!frame) {
      return project
    }
    const made = command(frameLayer(project), (position) => positionInLayer(project, 'frame', position))
    return made.beads === frame.beads ? project : { ...project, frame: { ...frame, beads: made.beads }, updatedAt: made.updatedAt }
  }
  const made = command(canvasLayer(project), (position) => position)
  if (made.beads === project.beads) {
    return project
  }
  const covered = footprintOf(project)
  const beads = covered ? keepUnderFrame(project.beads, made.beads, covered) : made.beads
  // Everything the command did was under the Frame, so nothing is left of it.
  if (beads !== made.beads && changedPositions(project.beads, beads).length === 0) {
    return project
  }
  // The Canvas's Pieces are the Canvas's: a command that carried their names (Rotate) carries them here.
  const { pieceNames: _names, ...rest } = project
  return { ...rest, beads, ...(made.pieceNames ? { pieceNames: made.pieceNames } : {}), updatedAt: made.updatedAt }
}

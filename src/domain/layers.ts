import { beadsOver, beadsWithout, changedPositions, colorAt, frameContains, shiftedBeads, withColors, type BeadMap, type FrameSheet, type Rect } from './canvas'
import type { GridPosition, Layer } from './grid'

export type { Layer }
import { footprintOf } from './footprint'
import { frameGeometry, type ShapedSheet } from './frameShape'
import { gridGeometry, type LayerGeometry } from './layerGeometry'
import { layerOf, withLayer } from './layerRecord'
import { frameWeave } from './layerWeave'
import { touch, type Project } from './project'
import { projectCell, type ShapedBead } from './projectBead'
import type { Weave } from './weave'

// The two layers of a Project (ADR 0066): the Canvas, and the Frame laid over it. Every drawing command (Paint, Fill,
// Eraser, Paste, Selection fills) works on one layer's beads in its own positions; `onLayer` hands it the layer as a
// `LayerSheet`, so none of them has to know there are two.

/** One layer as a drawing command works on it (ADR 0066, 0078): its own beads by its own positions, the Weave it is
 * woven in (ticket 492), and the Layer geometry that says where its beads are. */
export interface LayerSheet {
  beads: BeadMap
  /** Its Weave, with the Bead shape's cell the Project draws it in. */
  weave: Weave
  geometry: LayerGeometry
  /** The Frame's rectangle in its own positions, its first row and column 0, 0; none on the Canvas, which has no edge. */
  edge?: Rect
  /** The Frame as its Frame shape reads it (its shape, settings, turn, size and Weave); none on the Canvas. */
  frame?: ShapedSheet
}

/** What `layerAt` needs of a Project (ADR 0066): the Frame, and the Weaves that say how much of the Canvas it covers. */
export type Placed = Pick<Project, 'technique' | 'techniqueSettings' | 'frame'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>

/** A Project as what reads its Frame's geometry needs it: the Frame, the Weaves and the Bead shape's cell. */
type Framed = Pick<Project, 'technique' | 'techniqueSettings' | 'frame'> & ShapedBead

/** Which layer a press at a Canvas position lands on (ADR 0066): the one the pointer's hit named, else under what
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

/** Every bead you see, by Canvas position: the Frame's laid over the Canvas's, which it hides where it lies (a Custom
 * frame's hide them, having no Canvas positions). For what asks about the picture as a whole (Select all, Fit to
 * drawing); the same map back when there is no Frame. */
export function shownBeads(project: Framed & Pick<Project, 'beads'>): BeadMap {
  const frame = project.frame
  if (!frame) {
    return project.beads
  }
  const hidden = beadsWithout(project.beads, footprintOf(project)!)
  // Only a grid's positions are the Canvas's, moved by the Frame's corner; a Custom frame's are named by round and place.
  return frameGeometryOf(project).grid ? beadsOver(hidden, shiftedBeads(frame.beads, frame.row, frame.column)) : hidden
}

/** A position of a layer's own, back on the Canvas. */
export function positionOnCanvas(project: Pick<Project, 'frame'>, layer: Layer, position: GridPosition): GridPosition {
  const frame = layer === 'frame' ? project.frame : undefined
  return frame ? { row: position.row + frame.row, column: position.column + frame.column } : position
}

/** The Frame as its Frame shape reads it, in its own Weave with the Bead shape's cell. The Project must have a Frame. */
function shapedFrame(project: Framed): ShapedSheet {
  const { rows, columns, shape, settings, quarterTurns } = project.frame!
  return { rows, columns, ...(shape ? { shape } : {}), ...(settings ? { settings } : {}), ...(quarterTurns ? { quarterTurns } : {}), ...frameWeave(project) }
}

// A Frame is never changed in place, so its geometry is built once for each Bead shape's cell it is drawn in.
const geometries = new WeakMap<FrameSheet, Map<string, LayerGeometry>>()

/** The Frame's Layer geometry (ADR 0078), counted from its own first row and column. The Project must have a Frame. */
export function frameGeometryOf(project: Framed): LayerGeometry {
  const frame = project.frame!
  const cell = projectCell(project)
  const key = cell ? `${cell.aspect}:${cell.roundness}` : ''
  let known = geometries.get(frame)
  if (!known) {
    known = new Map()
    geometries.set(frame, known)
  }
  let found = known.get(key)
  if (!found) {
    found = frameGeometry(shapedFrame(project))
    known.set(key, found)
  }
  return found
}

/** A layer as a command works on it (see `LayerSheet`): the Frame's from its own first row and column, or the Canvas,
 * open. The Frame's must exist. */
export function layerSheet(project: Project, layer: Layer): LayerSheet {
  const frame = layer === 'frame' ? project.frame : undefined
  if (!frame) {
    const { beads, weave } = layerOf(project, 'canvas')
    return { beads, weave, geometry: gridGeometry(weave) }
  }
  const { beads, weave } = layerOf(project, 'frame')!
  const edge = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
  return { beads, weave, geometry: frameGeometryOf(project), edge, frame: shapedFrame(project) }
}

/** `after` with every position under the Frame put back as `before` had it: the Canvas beads a Frame covers are neither
 * changed nor drawn. The same map back when nothing was under it. */
function keepUnderFrame(before: BeadMap, after: BeadMap, frame: Rect): BeadMap {
  const reverts = changedPositions(before, after)
    .filter((position) => frameContains(frame, position))
    .map(({ row, column }) => ({ row, column, color: colorAt(before, row, column) }))
  return reverts.length === 0 ? after : withColors(after, reverts)
}

/** Runs a command on one layer. The command gets the layer (see `layerSheet`) and `local`, which turns a Canvas position
 * into one of that layer, and gives back the layer's beads, which are put back. The same Project back when they came
 * back as they went in, which is a drawing command's "nothing changed". */
export function onLayer(project: Project, layer: Layer, command: (sheet: LayerSheet, local: (position: GridPosition) => GridPosition) => BeadMap): Project {
  const frame = project.frame
  if (layer === 'frame') {
    if (!frame) {
      return project
    }
    const beads = command(layerSheet(project, 'frame'), (position) => positionInLayer(project, 'frame', position))
    return beads === frame.beads ? project : touch(withLayer(project, 'frame', { beads }), {})
  }
  const made = command(layerSheet(project, 'canvas'), (position) => position)
  if (made === project.beads) {
    return project
  }
  const covered = footprintOf(project)
  const beads = covered ? keepUnderFrame(project.beads, made, covered) : made
  // Everything the command did was under the Frame, so nothing is left of it.
  if (beads !== made && changedPositions(project.beads, beads).length === 0) {
    return project
  }
  return touch(withLayer(project, 'canvas', { beads }), {})
}

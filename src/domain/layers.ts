import { beadsOver, anyChangedPosition, beadsWithout, colorAt, forEachChangedPosition, frameContains, withColors, type BeadChange, type BeadMap, type FrameSheet, type Rect } from './canvas'
import { isFrameLayer, type FrameRef, type GridPosition, type Layer } from './grid'

export type { Layer }
import { footprintOf, layerUnder } from './footprint'
import { frameGeometry, type ShapedSheet } from './frameShape'
import { gridGeometry, type LayerGeometry } from './layerGeometry'
import { beadsOfLayer, frameById, frameIdOf, framesOf, type Layered, layerOf, withLayer } from './layerRecord'
import { frameWeave, laidOnCanvas } from './layerWeave'
import { touch, type Project } from './project'
import type { Weave } from './weave'

// The two layers of a Project (ADR 0066): the Canvas, and the Frame laid over it. Every drawing command (Paint, Fill,
// Eraser, Paste, Selection fills) works on one layer's beads in its own positions; `onLayer` hands it the layer as a
// `LayerSheet`, so none of them has to know there are two.

/** One layer as a drawing command works on it (ADR 0066, 0078): its own beads by its own positions, the Weave it is
 * woven in (ticket 492), and the Layer geometry that says where its beads are. */
export interface LayerSheet {
  beads: BeadMap
  /** Its Weave, with the cell its Bead draws it in. */
  weave: Weave
  geometry: LayerGeometry
  /** The Frame's rectangle in its own positions, its first row and column 0, 0; none on the Canvas, which has no edge. */
  edge?: Rect
  /** The Frame as its Frame shape reads it (its shape, settings, turn, size and Weave); none on the Canvas. */
  frame?: ShapedSheet
}


/** Which layer a position is on (ADR 0066): the one it names (a Frame's cell by its own row and column), else, for a
 * Canvas position, the Frame that hides it where one lies over it (`footprintOf`), the Canvas anywhere else. The one place
 * that decides; a stroke asks once, at its press, and keeps the answer. */
export function layerAt(project: Layered, position: GridPosition): Layer {
  if (position.layer) {
    return isFrameLayer(position.layer) && frameById(project, position.layer) ? position.layer : 'canvas'
  }
  return layerUnder(project, position)
}

/** Every bead you see, by Canvas position: the Frame's laid over the Canvas's, which it hides where it lies (a Custom
 * frame's hide them, having no Canvas positions). For what asks about the picture as a whole (Select all, Fit to
 * drawing); the same map back when there is no Frame. */
export function shownBeads(project: Layered): BeadMap {
  let shown = beadsOfLayer(project, 'canvas')
  for (const frame of framesOf(project)) {
    const id = frameIdOf(frame)
    const covered = footprintOf(project, id)
    // A Frame off the Canvas's grid covers none of its positions (ticket 1188): the Canvas's beads are what lie on them.
    if (!covered) continue
    const hidden = beadsWithout(shown, covered)
    // Only a grid's positions are the Canvas's, moved by the Frame's corner (through millimetres in another Bead, ticket
    // 0665); a Custom frame's are named by round and place.
    shown = frameGeometryOf(project, id).grid ? beadsOver(hidden, laidOnCanvas(project, beadsOfLayer(project, id)!, frameById(project, id)!, id)) : hidden
  }
  return shown
}

/** The Frame as its Frame shape reads it, in its own Weave with its Bead's cell. The Project must have a Frame. */
function shapedFrame(project: Layered, frame: FrameRef): ShapedSheet {
  const { rows, columns, shape, settings, quarterTurns } = frameById(project, frame)!
  return { rows, columns, ...(shape ? { shape } : {}), ...(settings ? { settings } : {}), ...(quarterTurns ? { quarterTurns } : {}), ...frameWeave(project, frame) }
}

// A Frame is never changed in place, so its geometry is built once for each Bead's cell it is drawn in.
const geometries = new WeakMap<FrameSheet, Map<string, LayerGeometry>>()

/** A Frame's Layer geometry (ADR 0078), counted from its own first row and column. The Project must have that Frame. */
export function frameGeometryOf(project: Layered, ref: FrameRef): LayerGeometry {
  const frame = frameById(project, ref)!
  const cell = frameWeave(project, ref).cell
  const key = cell ? `${cell.aspect}:${cell.roundness}` : ''
  let known = geometries.get(frame)
  if (!known) {
    known = new Map()
    geometries.set(frame, known)
  }
  let found = known.get(key)
  if (!found) {
    found = frameGeometry(shapedFrame(project, ref))
    known.set(key, found)
  }
  return found
}

/** A layer as a command works on it (see `LayerSheet`): the Frame's from its own first row and column, or the Canvas,
 * open. The Frame's must exist. */
export function layerSheet(project: Project, layer: Layer): LayerSheet {
  const frame = frameById(project, layer)
  if (!frame || !isFrameLayer(layer)) {
    const { beads, weave } = layerOf(project, 'canvas')
    return { beads, weave, geometry: gridGeometry(weave) }
  }
  const { beads, weave } = layerOf(project, layer)!
  const edge = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
  return { beads, weave, geometry: frameGeometryOf(project, layer), edge, frame: shapedFrame(project, layer) }
}

/** `after` with every position under the Frame put back as `before` had it, but for those `through` lets by: the Canvas
 * beads a Frame covers are neither changed nor drawn. The same map back when nothing was under it. */
function keepUnderFrame(before: BeadMap, after: BeadMap, frame: Rect, through: (position: GridPosition) => boolean = () => false): BeadMap {
  const reverts: BeadChange[] = []
  forEachChangedPosition(before, after, (row, column) => {
    if (frameContains(frame, { row, column }) && !through({ row, column })) reverts.push({ row, column, color: colorAt(before, row, column) })
  })
  return reverts.length === 0 ? after : withColors(after, reverts)
}

/** What a Canvas command may change under the Frame: nothing by default, the Frame hiding what lies there untouched;
 * `underFrame` names the positions it may paint there, hidden: a Canvas Mirror's counterpart's (spec 0702's Edges). */
export interface OnLayerOptions {
  underFrame?: (position: GridPosition) => boolean
}

/** Runs a command on one layer. The command gets the layer (see `layerSheet`), works in that layer's own positions (a
 * Frame cell is named by its Frame and its own row and column), and gives back the layer's beads, which are put back. The same Project back when they came
 * back as they went in, which is a drawing command's "nothing changed". */
export function onLayer(project: Project, layer: Layer, command: (sheet: LayerSheet) => BeadMap, options: OnLayerOptions = {}): Project {
  if (isFrameLayer(layer)) {
    if (!frameById(project, layer)) {
      return project
    }
    const beads = command(layerSheet(project, layer))
    return beads === beadsOfLayer(project, layer) ? project : touch(withLayer(project, layer, { beads }), {})
  }
  const made = command(layerSheet(project, 'canvas'))
  const before = beadsOfLayer(project, 'canvas')
  if (made === before) {
    return project
  }
  let beads = made
  for (const frame of framesOf(project)) {
    const covered = footprintOf(project, frameIdOf(frame))
    if (covered) beads = keepUnderFrame(before, beads, covered, options.underFrame)
  }
  // Everything the command did was under the Frame, so nothing is left of it.
  if (beads !== made && !anyChangedPosition(before, beads)) {
    return project
  }
  return touch(withLayer(project, 'canvas', { beads }), {})
}

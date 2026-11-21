import { withColors, type BeadMap, type FrameSheet } from './canvas'
import type { GridPosition } from './grid'
import { hasProjectBeads } from './layerBeads'
import type { LayerSheet } from './layers'
import { canvasOf, frameOf, startingRowProgressOf, withCanvas, withLayer } from './layerRecord'
import { withFrameSheet } from './frameSheet'
import { frameCornerAt, framePlacement } from './framePlacement'
import { lieAlike } from './table'
import { startOrientation } from './weave'
import { touch, type Project } from './project'
import { INITIAL_ROW_PROGRESS, isInitialRowProgress, rowProgressOf } from './rowProgress'

// The drawing commands' changes to beads: painting a stroke on a layer, and Delete all.

/** Paints `positions` on a layer as one edit, so a whole stroke (ticket 24) is one undo step: a Frame only where its
 * geometry has a position (not off a Custom frame's layout, ticket 0592), the open Canvas
 * anywhere. The same beads back if nothing changes; only the touched rows are copied (see withColors). */
export function paintCells({ beads, geometry, edge }: LayerSheet, positions: GridPosition[], color: string | null): BeadMap {
  const targets = !edge ? positions : positions.filter((position) => geometry.hasPosition(position))
  return withColors(beads, targets.map((position) => ({ ...position, color })))
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, Row progress at the first row,
 * both turns as a new Project starts them (ticket 1188, `withFrameAlike`); name, size, Technique and Bead stay. Ignores
 * the Row progress lock (clearing progress is the point). Returns the same instance if already so. */
export function deleteAll(project: Project): Project {
  // Row progress starts afresh: the first pass, the Frame Technique's way as the Frame lies (spec 1182).
  const frame = frameOf(project)
  const start = frame ? startingRowProgressOf(frame) : INITIAL_ROW_PROGRESS
  const turn = startOrientation(canvasOf(project).technique)
  const laidAlike = !frame || (lieAlike(project) && !frame.quarterTurns)
  if (!hasProjectBeads(project) && !frame?.folded && isInitialRowProgress(rowProgressOf(project), start) && canvasOf(project).orientation === turn && laidAlike) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, ...canvas } = canvasOf(project)
  const unnamed = { ...project, layers: [canvas, ...project.layers.slice(1)] as Project['layers'] }
  const unfolded = frame ? withFrameSheet(unnamed, { ...withoutFolded(frame), rowProgress: start }) : unnamed
  const emptied = withLayer(withLayer(unfolded, 'canvas', { beads: {} }), 'frame', { beads: {} })
  return touch(frame ? withFrameAlike(emptied, turn) : withCanvas(emptied, { orientation: turn }), {})
}

/** The Project with its Canvas at `orientation`, its origin where it is, and its Frame lying alike on it (ticket 1188):
 * upright on it, at the Canvas position whose corner puts its centre nearest where it was on the table. */
function withFrameAlike(project: Project, orientation: number): Project {
  const centre = framePlacement(project)!.at
  const [canvas, held, ...rest] = project.layers
  const { centre: _centre, ...frame } = held!
  const alike: Project = { ...project, layers: [{ ...canvas, orientation }, { ...frame, angle: orientation }, ...rest] }
  return { ...alike, layers: [alike.layers[0], { ...alike.layers[1]!, ...frameCornerAt(alike, centre) }, ...rest] }
}

/** A Frame with its Folded beads gone (ticket 0638). */
function withoutFolded<T extends FrameSheet>({ folded: _folded, ...frame }: T): Omit<T, 'folded'> {
  return frame
}

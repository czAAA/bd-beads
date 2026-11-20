import { withColors, type BeadMap, type FrameSheet } from './canvas'
import type { GridPosition } from './grid'
import { hasProjectBeads } from './layerBeads'
import type { LayerSheet } from './layers'
import { canvasOf, frameOf, withFrameSheet, withLayer } from './layerRecord'
import { startingRowProgress } from './rowWays'
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

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, both Row progress pointers at
 * the first row; name, size, Technique, Bead and rotation stay. Ignores the Row progress lock (see isInFinishedRow):
 * clearing progress is the point, so callers skip keepFinishedRows. Returns the same instance if already so. */
export function deleteAll(project: Project): Project {
  // Row progress goes back to where a Project of its Technique starts: the first pass, its starting way.
  const frame = frameOf(project)
  const start = frame ? startingRowProgress(frame.technique, startOrientation(frame.technique) / 90, !!frame.shape) : INITIAL_ROW_PROGRESS
  if (!hasProjectBeads(project) && !frame?.folded && isInitialRowProgress(rowProgressOf(project), start)) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, ...canvas } = canvasOf(project)
  const unnamed = { ...project, layers: [canvas, ...project.layers.slice(1)] as Project['layers'] }
  const unfolded = frame ? withFrameSheet(unnamed, { ...withoutFolded(frame), rowProgress: start }) : unnamed
  return touch(withLayer(withLayer(unfolded, 'canvas', { beads: {} }), 'frame', { beads: {} }), {})
}

/** A Frame with its Folded beads gone (ticket 0638). */
function withoutFolded<T extends FrameSheet>({ folded: _folded, ...frame }: T): Omit<T, 'folded'> {
  return frame
}

import { withColors, type BeadMap, type FrameSheet } from './canvas'
import type { GridPosition } from './grid'
import { hasProjectBeads } from './layerBeads'
import type { LayerSheet } from './layers'
import { touch, type Project } from './project'
import { INITIAL_ROW_PROGRESS, isInitialRowProgress } from './rowProgress'

// The drawing commands' changes to beads: painting a stroke on a layer, and Delete all.

/** Paints `positions` on a layer as one edit, so a whole stroke (ticket 24) is one undo step: a Frame only where its
 * geometry has a position (not a net's hole, ticket 486, nor off a Custom frame's layout, ticket 0592), the open Canvas
 * anywhere. The same beads back if nothing changes; only the touched rows are copied (see withColors). */
export function paintCells({ beads, geometry }: LayerSheet, positions: GridPosition[], color: string | null): BeadMap {
  const targets = geometry.extent() === undefined ? positions : positions.filter((position) => geometry.hasPosition(position))
  return withColors(beads, targets.map((position) => ({ ...position, color })))
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, both Row progress pointers at
 * the first row; name, size, Technique, Bead and rotation stay. Ignores the Row progress lock (see isInFinishedRow):
 * clearing progress is the point, so callers skip keepFinishedRows. Returns the same instance if already so. */
export function deleteAll(project: Project): Project {
  if (!hasProjectBeads(project) && !project.frame?.folded && isInitialRowProgress(project.rowProgress)) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, ...rest } = project
  return touch(rest, {
    beads: {},
    ...(project.frame ? { frame: emptied(project.frame) } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

/** A Frame with no bead left, its Folded beads gone too (ticket 0638). */
function emptied({ folded: _folded, ...frame }: FrameSheet): FrameSheet {
  return { ...frame, beads: {} }
}

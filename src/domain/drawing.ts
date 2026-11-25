import { withColors, type BeadMap, type FrameSheet } from './canvas'
import type { FrameId, GridPosition } from './grid'
import { hasProjectBeads } from './layerBeads'
import type { LayerSheet } from './layers'
import { canvasOf, frameById, frameIdOf, framesOf, startingRowProgressOf, withLayer } from './layerRecord'
import { withFrameSheet } from './frameSheet'
import { startOrientation } from './weave'
import { touch, type Project } from './project'
import { isInitialRowProgress, rowProgressOf } from './rowProgress'

// The drawing commands' changes to beads: painting a stroke on a layer, and Delete all.

/** Paints `positions` on a layer as one edit, so a whole stroke (ticket 24) is one undo step: a Frame only where its
 * geometry has a position (not off a Custom frame's layout, ticket 0592), the open Canvas
 * anywhere. The same beads back if nothing changes; only the touched rows are copied (see withColors). */
export function paintCells({ beads, geometry, edge }: LayerSheet, positions: GridPosition[], color: string | null): BeadMap {
  const targets = !edge ? positions : positions.filter((position) => geometry.hasPosition(position))
  return withColors(beads, targets.map((position) => ({ ...position, color })))
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): every layer emptied, each Frame's Row progress
 * at the first row, the Canvas turned as a new Project starts it and the Table upright; name, size, Technique, Bead and
 * Frames stay, every Frame's centre and turn exactly as they were (spec 1234).
 * Ignores the Row progress lock (clearing progress is the point). The same instance if already so. */
export function deleteAll(project: Project): Project {
  const frames = framesOf(project).map(frameIdOf)
  // Row progress starts afresh: the first pass, the Frame Technique's way as the Frame lies (spec 1182).
  const startOf = (id: FrameId) => startingRowProgressOf(frameById(project, id)!)
  const turn = startOrientation(canvasOf(project).technique)
  const settled = frames.every((id) => {
    const frame = frameById(project, id)!
    return !frame.folded && isInitialRowProgress(rowProgressOf(project, id), startOf(id))
  })
  if (!hasProjectBeads(project) && settled && canvasOf(project).orientation === turn && !canvasOf(project).tableTurn) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, tableTurn: _turn, ...canvas } = canvasOf(project)
  const unnamed = { ...project, layers: [{ ...canvas, orientation: turn }, ...project.layers.slice(1)] as Project['layers'] }
  const unfolded = frames.reduce((next, id) => withFrameSheet(next, { ...withoutFolded(frameById(next, id)!), rowProgress: startOf(id) }, { frame: id }), unnamed)
  const emptied = frames.reduce((next, id) => withLayer(next, id, { beads: {} }), withLayer(unfolded, 'canvas', { beads: {} }))
  return touch(emptied, {})
}

/** A Frame with its Folded beads gone (ticket 0638). */
function withoutFolded<T extends FrameSheet>({ folded: _folded, ...frame }: T): Omit<T, 'folded'> {
  return frame
}

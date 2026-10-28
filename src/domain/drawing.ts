import { frameContains, withColors, type BeadMap } from './canvas'
import { frameLayoutOf } from './frameKind'
import { layoutPosition } from './frameLayout'
import type { GridPosition } from './grid'
import { hasProjectBeads } from './layerBeads'
import { touch, type Project } from './project'
import { INITIAL_ROW_PROGRESS, isInitialRowProgress } from './rowProgress'
import { describeWeave } from './weave'

// The drawing commands' changes to a Project's beads: painting a stroke, swapping in new beads, and Delete all.

/** Swaps in a whole new set of beads, returning a new Project rather than mutating the one passed in. */
export function restoreBeads(project: Project, beads: BeadMap): Project {
  return touch(project, { beads })
}

/** Paints every position in `positions` as a single edit, so a whole stroke (ticket 24) is one undo step. A position in
 * the Frame where the Weave has no bead (a net's hole, ticket 486) is left alone. Returns the same Project if nothing
 * changes. Only the touched rows are copied (see withColors). */
export function paintCells(project: Project, positions: GridPosition[], color: string | null): Project {
  const { frame } = project
  const { hasPosition } = describeWeave(project)
  // A Custom frame's view holds only its layout's positions, named by round and place (ticket 0592).
  const layout = frame && frameLayoutOf(frame)
  const targets = layout
    ? positions.filter((position) => layoutPosition(layout, position) !== undefined)
    : positions.filter((position) => !frame || !frameContains(frame, position) || hasPosition(position, frame))
  const beads = withColors(project.beads, targets.map((position) => ({ ...position, color })))
  return beads === project.beads ? project : restoreBeads(project, beads)
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, both Row progress pointers at
 * the first row; name, size, Technique, Bead and rotation stay. Ignores the Row progress lock (see isInFinishedRow):
 * clearing progress is the point, so callers skip keepFinishedRows. Returns the same instance if already so. */
export function deleteAll(project: Project): Project {
  if (!hasProjectBeads(project) && isInitialRowProgress(project.rowProgress)) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, ...rest } = project
  return touch(rest, {
    beads: {},
    ...(project.frame ? { frame: { ...project.frame, beads: {} } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

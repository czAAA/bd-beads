import { changedPositions, withColors, type BeadChange } from './canvas'
import { keepFinishedRows } from './rowProgress'
import type { Project } from './project'
import { carryNames, keepNamesApart } from './pieceNames'
import { frameGeometryOf } from './layers'
import { keepMarginClear } from './margin'

/** What a drawing command did, minus finished rows (ticket 33), margin paint, beads outside a Custom frame's layout and joins of named Pieces (ticket 406),
 * with Piece names carried over; `before` itself when nothing is left. */
export function keepAllowedEdits(before: Project, after: Project): Project {
  const allowed = keepNamesApart(before, keepMarginClear(before, keepFinishedRows(before, keepWhereBeadsAre(before, after))))
  if (allowed === before) {
    return before
  }
  return carryNames(before, allowed)
}

/** What an edit did, with every bead it newly painted where the Frame has no position taken back (outside a Custom
 * frame's layout, ticket 0592). Only the positions the edit changed are looked at (ticket 0674). */
function keepWhereBeadsAre(before: Project, after: Project): Project {
  const frame = after.frame
  if (!frame) {
    return after
  }
  const was = before.frame?.beads ?? {}
  const painted = changedPositions(was, frame.beads).filter(({ row, column }) => frame.beads[row]?.[column] !== undefined)
  if (painted.length === 0) {
    return after
  }
  // The Frame's own beads sit at positions of the Frame itself, its top left being 0, 0; a Custom frame's at its layout's.
  const own = frameGeometryOf(after)
  const framed: BeadChange[] = painted
    .filter((position) => !own.hasPosition(position))
    .map(({ row, column }) => ({ row, column, color: was[row]?.[column] ?? null }))
  return framed.length === 0 ? after : { ...after, frame: { ...frame, beads: withColors(frame.beads, framed) } }
}

import { forEachChangedPosition, withColors, type BeadChange } from './canvas'
import { keepFinishedRows } from './rowProgress'
import type { Project } from './project'
import { carryNames, keepNamesApart } from './pieceNames'
import { frameGeometryOf } from './layers'
import { keepMarginClear } from './margin'
import { beadsOfLayer, frameOf, withLayer } from './layerRecord'

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
 * frame's layout, ticket 0592). Only the positions the edit changed are looked at (ticket 0674), and none on a Frame
 * without a shape: its geometry is its whole rectangle, which every drawing command keeps to (ticket 0677). */
function keepWhereBeadsAre(before: Project, after: Project): Project {
  const beads = beadsOfLayer(after, 'frame')
  if (!beads || !frameOf(after)?.shape) {
    return after
  }
  const held = beadsOfLayer(before, 'frame') ?? {}
  // The Frame's own beads sit at positions of the Frame itself, its top left being 0, 0; a Custom frame's at its layout's.
  const own = frameGeometryOf(after)
  const framed: BeadChange[] = []
  forEachChangedPosition(held, beads, (row, column) => {
    if (beads[row]?.[column] !== undefined && !own.hasPosition({ row, column })) framed.push({ row, column, color: held[row]?.[column] ?? null })
  })
  return framed.length === 0 ? after : withLayer(after, 'frame', { beads: withColors(beads, framed) })
}

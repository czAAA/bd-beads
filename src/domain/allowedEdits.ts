import { forEachBead, withColors, type BeadChange, sameFrame } from './canvas'
import { canvasWeave, frameWeave } from './layerWeave'
import { keepFinishedRows } from './rowProgress'
import type { Project } from './project'
import { carryNames, keepNamesApart } from './pieceNames'
import { describeWeave } from './weave'
import { frameHasPosition } from './frameKind'
import { keepMarginClear } from './margin'

/** What a drawing command did, minus finished rows (ticket 33), margin paint, beads where the Weave has none and joins of named Pieces (ticket 406),
 * with Piece names carried over; `before` itself when nothing is left. */
export function keepAllowedEdits(before: Project, after: Project): Project {
  const allowed = keepNamesApart(before, keepMarginClear(before, keepFinishedRows(before, keepWhereBeadsAre(before, after))))
  if (allowed === before) {
    // No bead is left to change, but a command that turned the Frame (Rotate Frame, ticket 471) still did: an empty Frame turns too.
    return sameFrame(before.frame, after.frame) ? before : { ...before, frame: after.frame, updatedAt: after.updatedAt }
  }
  return carryNames(before, allowed)
}

/** What an edit did, with every bead it newly painted where the Weave has no bead taken back (the empty end of a
 * Right-angle weave line, ticket 482). */
function keepWhereBeadsAre(before: Project, after: Project): Project {
  const weave = describeWeave(canvasWeave(after))
  const frame = after.frame
  const reverts: BeadChange[] = []
  forEachBead(after.beads, (row, column, color) => {
    if (!weave.hasPosition({ row, column }, frame) && before.beads[row]?.[column] !== color) {
      reverts.push({ row, column, color: before.beads[row]?.[column] ?? null })
    }
  })
  const canvas = reverts.length === 0 ? after : { ...after, beads: withColors(after.beads, reverts) }
  if (!frame) {
    return canvas
  }
  // The Frame's own beads sit at positions of the Frame itself, its top left being 0, 0; a Custom frame's at its layout's.
  const own = { ...frame, ...frameWeave(after) }
  const framed: BeadChange[] = []
  forEachBead(frame.beads, (row, column, color) => {
    if (!frameHasPosition(own, { row, column }) && before.frame?.beads[row]?.[column] !== color) {
      framed.push({ row, column, color: before.frame?.beads[row]?.[column] ?? null })
    }
  })
  return framed.length === 0 ? canvas : { ...canvas, frame: { ...frame, beads: withColors(frame.beads, framed) } }
}

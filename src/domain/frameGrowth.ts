import { beadsInFrame, beadsWithout, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { foldsOver } from './folding'
import type { GridPosition } from './grid'
import { canvasWeave, frameWeave } from './layerWeave'
import { beadsOfLayer, heldWeave } from './layerRecord'
import { pieceBeadsAt } from './pieces'
import type { Project } from './project'
import { rowCycle } from './weave'

// A Frame woven like the Canvas grown over it (ticket 0639, ADR 0066): positions match one to one, so it lifts the
// Canvas beads it newly covers, as Frame from Selection does, and takes a named Piece whole or not at all.

/** Whether a resize of the Project's Frame trades beads with the Canvas: a Frame woven like it (Technique and Brick
 * block alike), whose own positions are the Canvas's (ADR 0066). */
function tradesWithCanvas(project: Project): boolean {
  return !!project.frame && !foldsOver(canvasWeave(project), heldWeave(project, 'frame')!)
}

/** The beads of each named Piece on the Canvas, with its name. */
function namedPieceBeads(project: Project): { name: string; beads: GridPosition[] }[] {
  const [beads, weave] = [beadsOfLayer(project, 'canvas'), heldWeave(project, 'canvas')]
  return (project.pieceNames ?? []).map(({ name, row, column }) => ({ name, beads: pieceBeadsAt(beads, weave, { row, column }) }))
}

/** Whether a Frame at `from` resized to `to` newly covers a Canvas position. */
const newlyCovers = (from: Rect, to: Rect, position: GridPosition) => frameContains(to, position) && !frameContains(from, position)

/** The Frame a resize to `rectangle` leaves (ticket 0639): an edge growing into a named Piece stops at its edge until it
 * would cover it whole, and `stoppedAt` names it. A Piece the Frame already hides part of stays on the Canvas, so stops
 * nothing; nor does any Piece for a Frame woven unlike the Canvas, which lifts nothing. */
export function grownFrame(project: Project, rectangle: Rect): { rectangle: Rect; stoppedAt?: string } {
  const frame = project.frame
  const pieces = frame && tradesWithCanvas(project) ? namedPieceBeads(project) : []
  if (!frame || pieces.length === 0) return { rectangle }
  const cycle = rowCycle(frameWeave(project))
  let at = rectangle
  let stoppedAt: string | undefined
  for (;;) {
    const cut = pieces.filter(({ beads }) => beads.some((bead) => newlyCovers(frame, at, bead)) && beads.some((bead) => !frameContains(at, bead)) && !beads.some((bead) => frameContains(frame, bead)))
    if (cut.length === 0) return { rectangle: at, ...(stoppedAt === undefined ? {} : { stoppedAt }) }
    stoppedAt ??= cut[0]!.name
    // Each edge whose strip holds a bead of a Piece it would cut goes back a step towards where it was.
    const inStrips = cut.flatMap(({ beads }) => beads.filter((bead) => newlyCovers(frame, at, bead)))
    let top = at.row
    let bottom = at.row + at.rows - 1
    let left = at.column
    let right = at.column + at.columns - 1
    if (inStrips.some(({ row }) => row < frame.row)) top = Math.min(frame.row, top + cycle)
    if (inStrips.some(({ row }) => row >= frame.row + frame.rows)) bottom = Math.max(frame.row + frame.rows - 1, bottom - 1)
    if (inStrips.some(({ column }) => column < frame.column)) left = Math.min(frame.column, left + 1)
    if (inStrips.some(({ column }) => column >= frame.column + frame.columns)) right = Math.max(frame.column + frame.columns - 1, right - 1)
    at = { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
  }
}

/** The Canvas beads a Frame resized to `rectangle` lifts, by Canvas position (ticket 0639): those it newly covers,
 * except a named Piece it does not newly cover whole, which stays on the Canvas whole, hidden under the Frame. None for
 * a Frame woven unlike the Canvas. */
export function canvasLift(project: Project, rectangle: Rect): BeadMap {
  const frame = project.frame
  if (!frame || !tradesWithCanvas(project)) return {}
  const offered = beadsWithout(beadsInFrame(beadsOfLayer(project, 'canvas'), rectangle), frame)
  const kept: BeadChange[] = namedPieceBeads(project)
    .filter(({ beads }) => !beads.every((bead) => newlyCovers(frame, rectangle, bead)))
    .flatMap(({ beads }) => beads.map(({ row, column }) => ({ row, column, color: null })))
  return withColors(offered, kept)
}

/** The name of a named Piece the Canvas held that `taken` (Canvas beads lifted into the Frame) holds whole. */
export function namedPieceTaken(project: Project, taken: BeadMap): string | undefined {
  return namedPieceBeads(project).find(({ beads }) => beads.length > 0 && beads.every(({ row, column }) => colorAt(taken, row, column) !== null))?.name
}

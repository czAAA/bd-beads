import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { snapRow } from './frame'
import { relocateFromMargin, type Cell } from './margin'
import { withFrame, type Project } from './project'

/**
 * Rotate (CONTEXT.md, ADR 0026): a quarter turn clockwise of the Frame and the beads in it, about the Frame's centre. It
 * changes the data, unlike the legacy view-only turn: the beads end up at new positions, and on peyote and brick stitch
 * the way they touch changes with them. The turned Frame may cover Pieces that lay outside the old one; each such Piece
 * moves, whole, to the nearest empty space clear of the turned Frame and its rulers. No bead is lost or overwritten.
 */

export interface Rotated {
  project: Project
  /** How many Pieces were in the way and moved outside the Frame. */
  moved: number
}

/** The Frame turned a quarter about its centre: rows and columns swap, and on stitches whose rows alternate it starts on an even row. */
export function rotatedFrame(project: Pick<Project, 'technique'>, frame: Frame): Frame {
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = frame.rows - frame.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  return { row: snapRow(project.technique, frame.row + rowShift), column: frame.column + columnShift, rows: frame.columns, columns: frame.rows }
}

/** The Project with its Frame and beads turned a quarter clockwise, or undefined with no Frame to turn. */
export function rotateProject(project: Project): Rotated | undefined {
  const frame = project.frame
  if (!frame) {
    return undefined
  }
  const turned = rotatedFrame(project, frame)

  const inside: Cell[] = []
  const outside: BeadMap = {}
  forEachBead(project.beads, (row, column, color) => {
    if (frameContains(frame, { row, column })) {
      inside.push({ row, column, color })
    } else {
      outside[row] ??= {}
      outside[row][column] = color
    }
  })

  // A bead at (r, c) of the Frame goes to (c, rows - 1 - r) of the turned one.
  const rotated: Cell[] = inside.map(({ row, column, color }) => ({
    row: turned.row + (column - frame.column),
    column: turned.column + (frame.rows - 1 - (row - frame.row)),
    color,
  }))

  // Pieces outside the old Frame that reach the turned one or its margin are in the way; the rest stay where they are.
  const moving = relocateFromMargin(project, outside, turned)
  const changes: BeadChange[] = [...inside.map(({ row, column }) => ({ row, column, color: null })), ...moving.changes]
  const placed = moving.placed
  // Vacate first, then place, so a Piece that moves onto where another left (or where the Frame was) is drawn.
  const cleared = withColors(project.beads, changes)
  const beads = withColors(cleared, [...placed, ...rotated])

  // withFrame keeps Row progress's pointers inside the turned Frame, whose rows and columns have swapped.
  return { project: { ...withFrame({ ...project, beads }, turned), updatedAt: Date.now() }, moved: moving.pieces }
}

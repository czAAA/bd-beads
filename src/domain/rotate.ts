import { colorAt, forEachBead, frameContains, withColors, type BeadChange, type Frame } from './canvas'
import { snapRow } from './frame'
import { carryNames } from './pieceNames'
import type { Project } from './project'
import { selectionFrame, type Selection } from './selection'

/**
 * Rotate (CONTEXT.md, ADR 0052): a quarter turn clockwise of the Selection and the beads in it, about the Selection's
 * centre. It changes the data, unlike the legacy view-only turn: the beads end up at new positions, and on peyote and
 * brick stitch the way they touch changes with them. The Frame, the rulers and Row progress's pointers are untouched.
 * Beads under the turned footprint are replaced, as drawing or pasting over them does; nothing is pushed away.
 */

export interface RotatedSelection {
  project: Project
  /** The turned rectangle, which becomes the Selection. */
  selection: Selection
}

/** The Selection turned a quarter about its centre: rows and columns swap, and on stitches whose rows alternate it starts on an even row. */
export function rotatedSelection(project: Pick<Project, 'technique'>, selection: Selection): Selection {
  const frame = selectionFrame(selection)
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = frame.rows - frame.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  return {
    top: snapRow(project.technique, frame.row + rowShift),
    left: frame.column + columnShift,
    rows: frame.columns,
    columns: frame.rows,
  }
}

/** Every position of a rectangle that holds a bead. */
function beadsIn(project: Project, area: Frame): BeadChange[] {
  const found: BeadChange[] = []
  for (let row = area.row; row < area.row + area.rows; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      const color = colorAt(project.beads, row, column)
      if (color) {
        found.push({ row, column, color })
      }
    }
  }
  return found
}

/**
 * The Project with the Selection's beads turned a quarter clockwise, and the turned rectangle. Every position of the
 * turned footprint takes what the turn puts there (empty ones too), so a bead it lands on is replaced. Piece names
 * follow their beads; a named bead that was covered loses its name with the Piece.
 */
export function rotateSelection(project: Project, selection: Selection): RotatedSelection {
  const area = selectionFrame(selection)
  const turned = rotatedSelection(project, selection)
  const footprint = selectionFrame(turned)

  const turn = (row: number, column: number) => ({
    row: turned.top + (column - selection.left),
    column: turned.left + (selection.rows - 1 - (row - selection.top)),
  })

  const lifted = beadsIn(project, area)
  const covered = beadsIn(project, footprint)
  const cleared = withColors(project.beads, [...lifted, ...covered].map(({ row, column }) => ({ row, column, color: null })))
  const beads = withColors(cleared, lifted.map(({ row, column, color }) => ({ ...turn(row, column), color })))

  const named = carryNames(project, { ...project, beads, updatedAt: Date.now() }, (position) => {
    if (frameContains(area, position)) {
      return turn(position.row, position.column)
    }
    return frameContains(footprint, position) ? undefined : position
  })
  return { project: named, selection: turned }
}

/**
 * How many beads outside the Selection the turn replaced: those under the turned footprint, outside the old
 * rectangle, that `after` (the Project once the keep-out margin and finished rows had trimmed the turn) no longer holds.
 */
export function coveredByRotation(before: Project, after: Project, selection: Selection, turned: Selection): number {
  const area = selectionFrame(selection)
  const footprint = selectionFrame(turned)
  let covered = 0
  forEachBead(before.beads, (row, column, color) => {
    if (frameContains(footprint, { row, column }) && !frameContains(area, { row, column }) && colorAt(after.beads, row, column) !== color) {
      covered++
    }
  })
  return covered
}

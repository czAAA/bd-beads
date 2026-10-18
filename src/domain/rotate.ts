import { colorAt, forEachBead, frameContains, withColors, type BeadChange, type Frame } from './canvas'
import { snapRow } from './frame'
import { MARGIN, withMargin } from './margin'
import { carryNames } from './pieceNames'
import type { Project } from './project'
import { selectionFrame, type Selection } from './selection'
import { describeWeave } from './weave'

// Rotate (CONTEXT.md, ADR 0052): a quarter turn clockwise of the Selection's beads about its centre. Unlike the legacy
// view-only turn it changes the data (peyote/brick contacts change). Frame, rulers and Row progress are untouched;
// beads under the turned footprint are replaced, nothing is pushed away.

export interface RotatedSelection {
  project: Project
  /** The turned rectangle, which becomes the Selection. */
  selection: Selection
}

/** The Selection turned a quarter about its centre: rows and columns swap, and on stitches whose rows alternate it
 * starts on a multiple of the shift's cycle. `inset` is how far inside the Selection the row that must land on one
 * begins: the margin, for the Frame inside Rotate Frame's area (ticket 477). */
export function rotatedSelection(project: Pick<Project, 'technique' | 'brickBlock'>, selection: Selection, inset = 0): Selection {
  const frame = selectionFrame(selection)
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = frame.rows - frame.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  return {
    top: snapRow(project, frame.row + rowShift + inset) - inset,
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

/** The Project with the Selection turned a quarter clockwise, and the turned rectangle; covered beads are replaced. */
export function rotateSelection(project: Project, selection: Selection, inset = 0): RotatedSelection {
  const area = selectionFrame(selection)
  const turned = rotatedSelection(project, selection, inset)
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

/** How many beads outside the Selection the turn replaced: under the turned footprint, outside the old rectangle,
 * gone from `after`. */
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

/** The Selection Rotate Frame turns: the Frame and its keep-out margin, the rectangle `selectionAllowed` takes. */
export function frameAreaSelection(frame: Frame): Selection {
  const area = withMargin(frame)
  return { top: area.row, left: area.column, rows: area.rows, columns: area.columns }
}

/**
 * Rotate Frame (ticket 471, ADR 0063): the Frame, its margin and the beads inside turned a quarter clockwise about their
 * centre, as Rotate does a Selection; Width and Height swap, outside beads stay unless covered. No Frame: undefined. */
export function rotateFrame(project: Project): Project | undefined {
  if (!project.frame || !describeWeave(project).quarterTurn) {
    return undefined
  }
  const turned = rotateSelection(project, frameAreaSelection(project.frame), MARGIN)
  const frame: Frame = {
    row: turned.selection.top + MARGIN,
    column: turned.selection.left + MARGIN,
    rows: turned.selection.rows - 2 * MARGIN,
    columns: turned.selection.columns - 2 * MARGIN,
  }
  return { ...turned.project, frame }
}

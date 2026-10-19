import type { GridPosition } from './grid'
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
  const weave = describeWeave(project)
  // Whole Units turn: a Technique with none counts beads as its Units.
  const units = weave.unitsOf(frame)
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = units.rows - units.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  const turned = weave.positionsOf({ columns: units.rows, rows: units.columns })
  return {
    top: snapRow(project, frame.row + rowShift * weave.rowsPerUnit + inset) - inset,
    left: frame.column + columnShift,
    rows: turned.rows,
    columns: turned.columns,
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

  const weave = describeWeave(project)
  const block = { columns: selection.columns, rows: selection.rows }
  const turn = (row: number, column: number): GridPosition | undefined => {
    const to = weave.turned({ row: row - selection.top, column: column - selection.left }, block)
    return to && { row: turned.top + to.row, column: turned.left + to.column }
  }

  // A bead that belongs to no whole Unit of the Selection (a horizontal bead past its last Unit) stays where it is.
  const lifted = beadsIn(project, area).filter(({ row, column }) => turn(row, column))
  const covered = beadsIn(project, footprint)
  const cleared = withColors(project.beads, [...lifted, ...covered].map(({ row, column }) => ({ row, column, color: null })))
  const beads = withColors(cleared, lifted.map(({ row, column, color }) => ({ ...turn(row, column)!, color })))

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

/** How much margin Rotate Frame turns with the Frame. The margin is as many beads on every side, which isn't the same
 * length across and down where beads are laid in Units and would not turn into itself: there the Frame turns alone and
 * beads in its margin stay (ticket 483). */
export function turnedMargin(weave: Pick<Project, 'technique' | 'brickBlock'>): number {
  return describeWeave(weave).countsUnits ? 0 : MARGIN
}

/** The Selection Rotate Frame turns: the Frame and its keep-out margin, the rectangle `selectionAllowed` takes. */
export function frameAreaSelection(frame: Frame, margin = MARGIN): Selection {
  const area = withMargin(frame, margin)
  return { top: area.row, left: area.column, rows: area.rows, columns: area.columns }
}

/**
 * Rotate Frame (ticket 471, ADR 0063): the Frame, its margin and the beads inside turned a quarter clockwise about their
 * centre, as Rotate does a Selection; Width and Height swap, outside beads stay unless covered. No Frame: undefined. */
export function rotateFrame(project: Project): Project | undefined {
  if (!project.frame || !describeWeave(project).quarterTurn) {
    return undefined
  }
  const margin = turnedMargin(project)
  const turned = rotateSelection(project, frameAreaSelection(project.frame, margin), margin)
  const frame: Frame = {
    row: turned.selection.top + margin,
    column: turned.selection.left + margin,
    rows: turned.selection.rows - 2 * margin,
    columns: turned.selection.columns - 2 * margin,
  }
  return { ...turned.project, frame }
}

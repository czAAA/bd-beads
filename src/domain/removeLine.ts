import { forEachBead, frameContains, type BeadMap, type Frame } from './canvas'
import { withFrame, type Pattern } from './pattern'
import type { Selection } from './selection'

/**
 * Remove line (CONTEXT.md, ADR 0026): takes one whole row or column out of the Frame, closing the gap. The Frame's beads
 * after the line shift up or left by one and the Frame loses a row or column; every bead outside the Frame stays where it
 * is. The line is the Selection when it is exactly one row or column of the Frame, which a ruler number picks out.
 */

/** What a Selection reads as: the axis the line runs along and its index counted from the Frame's first row or column. */
export interface FrameLine {
  axis: 'row' | 'column'
  index: number
}

/**
 * Which whole line of the Frame a Selection covers exactly, or undefined when it is neither. On a one-bead Frame the
 * single bead fits both readings; it is called a row, an arbitrary but fixed tiebreak.
 */
export function selectedFrameLine(frame: Frame | undefined, selection: Selection | undefined): FrameLine | undefined {
  if (!frame || !selection) {
    return undefined
  }
  if (selection.rows === 1 && selection.left === frame.column && selection.columns === frame.columns && selection.top >= frame.row && selection.top < frame.row + frame.rows) {
    return { axis: 'row', index: selection.top - frame.row }
  }
  if (selection.columns === 1 && selection.top === frame.row && selection.rows === frame.rows && selection.left >= frame.column && selection.left < frame.column + frame.columns) {
    return { axis: 'column', index: selection.left - frame.column }
  }
  return undefined
}

/** Why Remove line would not apply, or undefined when it would. */
export type RemoveLineRefusal =
  /** The Selection isn't exactly one whole row or column of the Frame (or there is no Frame): nothing for it to act on. */
  | 'no-line'
  /** Row progress is on: the Frame's rows are held still while it is (ADR 0017). */
  | 'locked'
  /** The Frame has only the one row or column the Selection names, and a Frame is never empty. */
  | 'only-line'

export function removeLineRefusal(pattern: Pattern, selection: Selection | undefined): RemoveLineRefusal | undefined {
  const line = selectedFrameLine(pattern.frame, selection)
  if (!line || !pattern.frame) {
    return 'no-line'
  }
  if (pattern.rowProgress.enabled) {
    return 'locked'
  }
  if ((line.axis === 'row' ? pattern.frame.rows : pattern.frame.columns) <= 1) {
    return 'only-line'
  }
  return undefined
}

/** The Pattern without the line the Selection marks out, or the same Pattern, unchanged, when that is refused. */
export function removeSelectedLine(pattern: Pattern, selection: Selection | undefined): Pattern {
  const line = selectedFrameLine(pattern.frame, selection)
  const frame = pattern.frame
  if (!line || !frame || removeLineRefusal(pattern, selection)) {
    return pattern
  }

  const beads: BeadMap = {}
  forEachBead(pattern.beads, (row, column, color) => {
    let newRow = row
    let newColumn = column
    if (frameContains(frame, { row, column })) {
      const relative = line.axis === 'row' ? row - frame.row : column - frame.column
      if (relative === line.index) {
        return
      }
      if (relative > line.index) {
        newRow = line.axis === 'row' ? row - 1 : row
        newColumn = line.axis === 'column' ? column - 1 : column
      }
    }
    beads[newRow] ??= {}
    beads[newRow]![newColumn] = color
  })

  const smaller = { ...frame, rows: line.axis === 'row' ? frame.rows - 1 : frame.rows, columns: line.axis === 'column' ? frame.columns - 1 : frame.columns }
  return { ...withFrame(pattern, smaller), beads }
}

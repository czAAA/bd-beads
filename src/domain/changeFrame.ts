import { forEachBead, frameContains, type BeadMap, type Frame } from './canvas'
import { sameFrame } from './frame'
import type { GridPosition, Technique } from './grid'
import { clearMargin } from './margin'
import { carryNames, namedPieceCutBy } from './pieceNames'
import { rowProgressStarted, withFrame, withRowProgressOnByItself, withTechnique, type Project } from './project'
import type { AreaLine } from './removeLine'

/**
 * The one operation behind every change of the Frame (ticket 361): Set Frame, moving and resizing it, Fit to drawing,
 * Remove Frame and Remove row/column. It owns the rules such a change keeps, so no flow assembles them itself:
 * Row progress's lock (once a pass is done), Row progress turning on by itself at the first Frame,
 * Row progress's pointers ending inside the new Frame, and the keep-out margin left empty with each
 * Piece it reached moved clear, whole (ADR 0027).
 */
export type FrameChange =
  /** Set Frame, moving it, resizing it and Fit to drawing all reduce to this. */
  | { set: Frame }
  | { remove: true }
  /** One whole row or column of the Frame, counted from its first. */
  | { removeLine: AreaLine }
  /** Change the Technique of an open Project (ticket 351): only the geometry changes, every cell keeps its row and column. */
  | { technique: Technique }

/** Why a change did not happen. */
export type FrameChangeRefusal =
  /** Row progress is on and a pass is done: the passes belong to the Frame, which any change would alter (ADR 0026, ticket 411). */
  | 'locked'
  /** Remove line needs a Frame to act on. */
  | 'no-frame'
  /** Remove line's row or column is not one of the Frame's. */
  | 'no-line'
  /** The Frame has only the one row or column asked for, and a Frame is never empty. */
  | 'only-line'
  /** The new Frame would cut through a named Piece (an unframed Schema), which it must take whole or leave whole (ticket 407). */
  | 'cuts-schema'

export type FrameChangeResult =
  | { kind: 'refused'; reason: FrameChangeRefusal }
  /** Nothing differs; `project` is the same instance that came in. */
  | { kind: 'unchanged'; project: Project }
  /** `moved` is how many Pieces moved clear of the Frame's margin. */
  | { kind: 'changed'; project: Project; moved: number }

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange): FrameChangeRefusal | undefined {
  if (rowProgressStarted(project)) {
    return 'locked'
  }
  const frame = project.frame
  if ('removeLine' in change) {
    if (!frame) {
      return 'no-frame'
    }
    const { axis, index } = change.removeLine
    const length = axis === 'row' ? frame.rows : frame.columns
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      return 'no-line'
    }
    if (length <= 1) {
      return 'only-line'
    }
  }
  if ('set' in change && namedPieceCutBy(project, change.set)) {
    return 'cuts-schema'
  }
  return undefined
}

export function changeFrame(project: Project, change: FrameChange): FrameChangeResult {
  const reason = frameChangeRefusal(project, change)
  if (reason) {
    return { kind: 'refused', reason }
  }

  if ('removeLine' in change) {
    const frame = project.frame!
    const { axis } = change.removeLine
    const smaller = { ...frame, rows: axis === 'row' ? frame.rows - 1 : frame.rows, columns: axis === 'column' ? frame.columns - 1 : frame.columns }
    const beads = beadsWithoutLine(project.beads, frame, change.removeLine)
    const shifted = carryNames(project, { ...withFrame(project, smaller), beads }, (at) => shiftedByLine(frame, change.removeLine, at))
    return settled(shifted)
  }

  if ('technique' in change) {
    if (change.technique === project.technique) {
      return { kind: 'unchanged', project }
    }
    return settled(carryNames(project, withTechnique(project, change.technique)))
  }

  const next = 'set' in change ? change.set : undefined
  if (sameFrame(project.frame, next)) {
    return { kind: 'unchanged', project }
  }
  return settled(withRowProgressOnByItself(project, withFrame(project, next)))
}

/** The framed Project with its margin cleared, as the changed result. */
function settled(framed: Project): FrameChangeResult {
  const { project, moved } = clearMargin(framed)
  return { kind: 'changed', project, moved }
}

/** Where a position goes when one line of `area` is taken out and the area's later beads shift up or left; undefined for a position on the removed line. */
export function shiftedByLine(area: Frame, line: AreaLine, position: GridPosition): GridPosition | undefined {
  if (!frameContains(area, position)) {
    return position
  }
  const relative = line.axis === 'row' ? position.row - area.row : position.column - area.column
  if (relative === line.index) {
    return undefined
  }
  if (relative > line.index) {
    return {
      row: line.axis === 'row' ? position.row - 1 : position.row,
      column: line.axis === 'column' ? position.column - 1 : position.column,
    }
  }
  return position
}

/** The Project's beads with one line of `area` taken out and the area's later beads shifted up or left to close the gap. */
export function beadsWithoutLine(beads: BeadMap, area: Frame, line: AreaLine): BeadMap {
  const result: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    const to = shiftedByLine(area, line, { row, column })
    if (!to) {
      return
    }
    result[to.row] ??= {}
    result[to.row]![to.column] = color
  })
  return result
}

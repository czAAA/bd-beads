import { forEachBead, frameContains, type BeadMap, type Frame } from './canvas'
import { sameFrame } from './frame'
import { clearMargin } from './margin'
import { withFrame, type Project } from './project'
import type { AreaLine } from './removeLine'
import { rotateProject } from './rotate'

/**
 * The one operation behind every change of the Frame (ticket 361): Set Frame, moving and resizing it, Fit to drawing,
 * Remove Frame, Rotate and Remove row/column. It owns the rules such a change keeps, so no flow assembles them itself:
 * Row progress's lock, Row progress's pointers ending inside the new Frame, and the keep-out margin left empty with each
 * Piece it reached moved clear, whole (ADR 0027).
 */
export type FrameChange =
  /** Set Frame, moving it, resizing it and Fit to drawing all reduce to this. */
  | { set: Frame }
  | { remove: true }
  | { rotate: true }
  /** One whole row or column of the Frame, counted from its first. */
  | { removeLine: AreaLine }

/** Why a change did not happen. */
export type FrameChangeRefusal =
  /** Row progress is on: its rows are the Frame's, which any change would alter (ADR 0017). */
  | 'locked'
  /** Rotate and Remove line need a Frame to act on. */
  | 'no-frame'
  /** Remove line's row or column is not one of the Frame's. */
  | 'no-line'
  /** The Frame has only the one row or column asked for, and a Frame is never empty. */
  | 'only-line'

export type FrameChangeResult =
  | { kind: 'refused'; reason: FrameChangeRefusal }
  /** Nothing differs; `project` is the same instance that came in. */
  | { kind: 'unchanged'; project: Project }
  /** `moved` is how many Pieces moved clear of the Frame's margin. */
  | { kind: 'changed'; project: Project; moved: number }

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange): FrameChangeRefusal | undefined {
  if (project.rowProgress.enabled) {
    return 'locked'
  }
  const frame = project.frame
  if ('rotate' in change && !frame) {
    return 'no-frame'
  }
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
  return undefined
}

export function changeFrame(project: Project, change: FrameChange): FrameChangeResult {
  const reason = frameChangeRefusal(project, change)
  if (reason) {
    return { kind: 'refused', reason }
  }

  if ('rotate' in change) {
    const turned = rotateProject(project)!
    return { kind: 'changed', project: turned.project, moved: turned.moved }
  }

  if ('removeLine' in change) {
    const frame = project.frame!
    const { axis } = change.removeLine
    const smaller = { ...frame, rows: axis === 'row' ? frame.rows - 1 : frame.rows, columns: axis === 'column' ? frame.columns - 1 : frame.columns }
    const beads = beadsWithoutLine(project.beads, frame, change.removeLine)
    return settled({ ...withFrame(project, smaller), beads })
  }

  const next = 'set' in change ? change.set : undefined
  if (sameFrame(project.frame, next)) {
    return { kind: 'unchanged', project }
  }
  return settled(withFrame(project, next))
}

/** The framed Project with its margin cleared, as the changed result. */
function settled(framed: Project): FrameChangeResult {
  const { project, moved } = clearMargin(framed)
  return { kind: 'changed', project, moved }
}

/** The Project's beads with one line of `area` taken out and the area's later beads shifted up or left to close the gap. */
export function beadsWithoutLine(beads: BeadMap, area: Frame, line: AreaLine): BeadMap {
  const result: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    let newRow = row
    let newColumn = column
    if (frameContains(area, { row, column })) {
      const relative = line.axis === 'row' ? row - area.row : column - area.column
      if (relative === line.index) {
        return
      }
      if (relative > line.index) {
        newRow = line.axis === 'row' ? row - 1 : row
        newColumn = line.axis === 'column' ? column - 1 : column
      }
    }
    result[newRow] ??= {}
    result[newRow]![newColumn] = color
  })
  return result
}

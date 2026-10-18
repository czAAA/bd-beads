import { forEachBead, frameContains, type BeadMap, type Frame } from './canvas'
import { movedFrame, sameFrame } from './frame'
import type { GridPosition } from './grid'
import { describeWeave, type Technique } from './weave'
import { carryNames, namedPieceCutBy } from './pieceNames'
import { clampBrickBlock, rowProgressStarted, withBrickBlock, withFrame, withTechnique, type Project } from './project'
import type { AreaLine } from './removeLine'

// The one operation behind every change of the Frame (ticket 361): Set Frame, move, resize, Fit to drawing, Remove
// Frame and Remove row/column. It owns the rules: Row progress's lock (only Remove Frame passes it, clearing the
// passes), Row progress following the Frame. Beads left in the keep-out margin stay, covered.
export type FrameChange =
  /** Set Frame, moving it, resizing it and Fit to drawing all reduce to this. */
  | { set: Frame }
  | { remove: true }
  /** One whole row or column of the Frame, counted from its first. */
  | { removeLine: AreaLine }
  /** Move the Frame with its beads by whole rows and columns (ticket 452, ADR 0062); allowed after Row progress has
   * started, which then travels with the Frame. */
  | { move: { rows: number; columns: number } }
  /** Change the Technique of an open Project (ticket 351): only the geometry changes, every cell keeps its row and
   * column. */
  | { technique: Technique }
  /** Change the Brick block of an open Project (ticket 477): the same, only the shift's rhythm changes. */
  | { brickBlock: number }

/** Why a change did not happen. */
export type FrameChangeRefusal =
  /** Row progress is on and a pass is done: the passes belong to the Frame, which any change would alter (ADR 0026,
   * ticket 411). */
  | 'locked'
  /** Remove line needs a Frame to act on. */
  | 'no-frame'
  /** Remove line's row or column is not one of the Frame's. */
  | 'no-line'
  /** The Frame has only the one row or column asked for, and a Frame is never empty. */
  | 'only-line'
  /** The new Frame would cut through a named Piece (an unframed Schema), which it must take whole or leave whole
   * (ticket 407). */
  | 'cuts-schema'
  /** A Technique counted in Units is fixed when the Project is created (ADR 0038), and a line of it isn't a Unit. */
  | 'fixed-weave'

export type FrameChangeResult =
  | { kind: 'refused'; reason: FrameChangeRefusal }
  /** Nothing differs; `project` is the same instance that came in. */
  | { kind: 'unchanged'; project: Project }
  | { kind: 'changed'; project: Project }

// Whether the change throws away finished passes: only Remove Frame once a pass is done, as the passes go with the
// Frame (ticket 434, ADR 0055). The one place that rule lives; the Remove frame flow asks it before confirming.
export function frameChangeDiscardsProgress(project: Project, change: FrameChange): boolean {
  return 'remove' in change && rowProgressStarted(project)
}

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange): FrameChangeRefusal | undefined {
  // Remove Frame is how the weaver lets go of finished passes: it clears them with the Frame (ticket 426, ADR 0055).
  if (rowProgressStarted(project) && !frameChangeDiscardsProgress(project, change) && !('move' in change)) {
    return 'locked'
  }
  const frame = project.frame
  if ('technique' in change && change.technique !== project.technique && (!describeWeave(project).switchable || !describeWeave({ technique: change.technique }).switchable)) {
    return 'fixed-weave'
  }
  if ('removeLine' in change && describeWeave(project).countsUnits) {
    return 'fixed-weave'
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
  if ('move' in change && !frame) {
    return 'no-frame'
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
    return { kind: 'changed', project: shifted }
  }

  if ('move' in change) {
    const frame = project.frame!
    const moved = movedFrame(project, frame, change.move.rows, change.move.columns)
    if (sameFrame(frame, moved)) {
      return { kind: 'unchanged', project }
    }
    const shifted = carryNames(project, { ...withFrame(project, moved), beads: beadsWithFrameMoved(project.beads, frame, moved) }, (at) =>
      frameContains(frame, at) ? { row: at.row + moved.row - frame.row, column: at.column + moved.column - frame.column } : at,
    )
    return { kind: 'changed', project: shifted }
  }

  if ('technique' in change) {
    if (change.technique === project.technique) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: carryNames(project, withTechnique(project, change.technique)) }
  }

  if ('brickBlock' in change) {
    if (clampBrickBlock(change.brickBlock) === (project.brickBlock ?? 1)) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: carryNames(project, withBrickBlock(project, change.brickBlock)) }
  }

  const next = 'set' in change ? change.set : undefined
  if (sameFrame(project.frame, next)) {
    return { kind: 'unchanged', project }
  }
  return { kind: 'changed', project: withFrame(project, next) }
}

/** Where a position goes when one line of `area` is taken out and the area's later beads shift up or left; undefined
 * for a position on the removed line. */
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

/** The Project's beads with one line of `area` taken out and the area's later beads shifted up or left to close the
 * gap. */
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

// The beads after the Frame moves from `from` to `to`: its beads travel with it, overwriting everything under the
// destination (held margin beads included), and the cells it left are emptied. Beads in the margin elsewhere stay.
function beadsWithFrameMoved(beads: BeadMap, from: Frame, to: Frame): BeadMap {
  const result: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    if (frameContains(from, { row, column }) || frameContains(to, { row, column })) {
      return
    }
    result[row] ??= {}
    result[row]![column] = color
  })
  forEachBead(beads, (row, column, color) => {
    if (!frameContains(from, { row, column })) {
      return
    }
    const landing = { row: row + to.row - from.row, column: column + to.column - from.column }
    result[landing.row] ??= {}
    result[landing.row]![landing.column] = color
  })
  return result
}

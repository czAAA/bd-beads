import type { FrameRef } from './grid'
import type { Rect } from './canvas'
import { pieceAreasOf } from './pieceAreas'
import { beadsWithoutLine, changeFrame, frameChangeRefusal, shiftedByLine, type FrameChangeResult } from './changeFrame'
import { carryNames } from './pieceNames'
import { finishedOnLine, lineRunsAlong, ownRowWayOf, rowProgressPosition } from './rowProgress'
import { frameWeave } from './layerWeave'
import { beadsOfLayer, heldWeave, withLayer, FIRST_FRAME, frameById } from './layerRecord'
import { describeWeave } from './weave'
import type { Project } from './project'
import type { PassDirection } from './weaveGeometry'
import type { Selection } from './selection'

/** Remove line (CONTEXT.md, ADR 0026, ticket 313): takes one row or column out of the Frame (or Piece area), closing
 * the gap. */

/** What a Selection reads as: the axis the line runs along and its index counted from the area's first row or
 * column. */
export interface AreaLine {
  axis: 'row' | 'column'
  index: number
}

/** An AreaLine and the rectangle it is a line of: the Frame, or with no Frame the Piece area. */
interface ProjectLine extends AreaLine {
  area: Rect
}

/** Which whole line of an area a Selection covers exactly, or undefined; a one-bead area counts as a row (fixed
 * tiebreak).
 * @internal Its test checks which line a Selection covers on its own. */
export function selectedAreaLine(frame: Rect | undefined, selection: Selection | undefined): AreaLine | undefined {
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

/** The line the Selection covers, in the Frame or, with no Frame, in whichever Piece area it is a whole line of. */
function selectedProjectLine(project: Project, selection: Selection | undefined, ref: FrameRef): ProjectLine | undefined {
  // Only a Selection one bead thin is a line: the Piece areas go uncounted otherwise, as after every stroke step (0674).
  if (!selection || (selection.rows !== 1 && selection.columns !== 1)) {
    return undefined
  }
  const frame = frameById(project, ref)
  const areas = frame ? [frame] : pieceAreasOf(beadsOfLayer(project, 'canvas'), heldWeave(project, 'canvas'))
  for (const area of areas) {
    const line = selectedAreaLine(area, selection)
    if (line) {
      return { ...line, area }
    }
  }
  return undefined
}

/** Why Remove line would not apply, or undefined when it would. */
export type RemoveLineRefusal =
  /** The Selection isn't exactly one whole row or column of the Frame, or with no Frame of a Piece area: nothing for
   * it to act on. */
  | 'no-line'
  /** The Frame has only the one row or column the Selection names, and a Frame is never empty. */
  | 'only-line'

/** With a Frame the refusals are changeFrame's, so Remove line and the Frame's other changes agree on them. */
export function removeLineRefusal(project: Project, selection: Selection | undefined, ref: FrameRef = FIRST_FRAME): RemoveLineRefusal | undefined {
  const line = selectedProjectLine(project, selection, ref)
  if (!line) {
    return 'no-line'
  }
  if (!frameById(project, ref)) {
    return undefined
  }
  const refusal = frameChangeRefusal(project, { removeLine: line }, ref)
  // A Frame that does not offer it (a Custom frame, or one lying turned: ticket 0667) has no line to remove.
  if (refusal === 'not-offered') return 'no-line'
  return refusal === 'only-line' ? 'only-line' : undefined
}

/** What Remove line asks before it goes (ticket 0647, ADR 0055), its rows and columns the way the rows run. */
export type RemoveLineQuestion =
  /** A finished row: its number counted the way the rows run (from the far edge on a reversed way), and the row Row
   * progress shows once it has gone back by that row's passes; `shifts` where the removed line is the one that
   * alternates (brick stitch's rows, peyote's columns, ticket 0734). */
  | { kind: 'finished-row'; row: number; backTo: number; shifts: boolean; direction: PassDirection }
  /** A line across finished rows, which each lose a bead and stay finished: how many. */
  | { kind: 'across-rows'; rows: number; direction: PassDirection }

/** The question Remove line asks first, or undefined where it goes without asking: a Piece area's line, or a Frame
 * line that touches no finished pass. The one place the rule lives; the flow knows only the prompt. */
export function removeLineQuestion(project: Project, selection: Selection | undefined, ref: FrameRef = FIRST_FRAME): RemoveLineQuestion | undefined {
  const line = selectedProjectLine(project, selection, ref)
  if (!line || !frameById(project, ref) || removeLineRefusal(project, selection, ref)) {
    return undefined
  }
  const own = ownRowWayOf(project, undefined, ref)
  const { direction } = own
  const { beads } = finishedOnLine(project, line, undefined, ref)
  if (beads === 0) {
    return undefined
  }
  if (!lineRunsAlong(line, own)) {
    return { kind: 'across-rows', rows: beads, direction }
  }
  const removed = changeFrame(project, { removeLine: line }, ref)
  const after = rowProgressPosition(removed.kind === 'changed' ? removed.project : project, ref)
  // As the Progress bar shows it: the row being woven, the last once every pass is done.
  const backTo = Math.min(after.current + 1, after.total)
  const lines = line.axis === 'row' ? line.area.rows : line.area.columns
  const row = (own.reversed ? lines - 1 - line.index : line.index) + 1
  const { shifted, staggers } = describeWeave(frameWeave(project, ref))
  return { kind: 'finished-row', row, backTo, shifts: shifted && staggers === `${line.axis}s`, direction }
}

/** Taking out the Selection's line: changeFrame's result with a Frame, else an edit of a Piece area's beads only. */
export function removeSelectedLine(project: Project, selection: Selection | undefined, ref: FrameRef = FIRST_FRAME): FrameChangeResult {
  const line = selectedProjectLine(project, selection, ref)
  if (!line) {
    return { kind: 'refused', reason: 'no-line' }
  }
  if (frameById(project, ref)) {
    return changeFrame(project, { removeLine: line }, ref)
  }
  const shifted = withLayer(project, 'canvas', { beads: beadsWithoutLine(beadsOfLayer(project, 'canvas'), line.area, line) })
  return { kind: 'changed', project: carryNames(project, shifted, (at) => shiftedByLine(line.area, line, at)) }
}

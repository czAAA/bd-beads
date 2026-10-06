import type { Frame } from './canvas'
import { pieceAreasOf } from './pieces'
import { beadsWithoutLine, changeFrame, frameChangeRefusal } from './changeFrame'
import type { Project } from './project'
import type { Selection } from './selection'

/**
 * Remove line (CONTEXT.md, ADR 0026, ticket 313): takes one whole row or column out of the Frame, or with no Frame out of
 * a Piece area, closing the gap. The area's beads after the line shift up or left by one and the area loses a row or
 * column; every bead outside the area stays where it is. The line is the Selection when it is exactly one row or column
 * of the area, which a ruler number picks out.
 */

/** What a Selection reads as: the axis the line runs along and its index counted from the area's first row or column. */
export interface AreaLine {
  axis: 'row' | 'column'
  index: number
}

/** An AreaLine and the rectangle it is a line of: the Frame, or with no Frame the Piece area. */
interface ProjectLine extends AreaLine {
  area: Frame
}

/**
 * Which whole line of an area a Selection covers exactly, or undefined when it is neither. On a one-bead area the
 * single bead fits both readings; it is called a row, an arbitrary but fixed tiebreak.
 */
export function selectedAreaLine(frame: Frame | undefined, selection: Selection | undefined): AreaLine | undefined {
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
function selectedProjectLine(project: Project, selection: Selection | undefined): ProjectLine | undefined {
  const areas = project.frame ? [project.frame] : pieceAreasOf(project.beads, project.technique)
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
  /** The Selection isn't exactly one whole row or column of the Frame, or with no Frame of a Piece area: nothing for it to act on. */
  | 'no-line'
  /** Row progress is on: the Frame's rows are held still while it is (ADR 0017). */
  | 'locked'
  /** The Frame has only the one row or column the Selection names, and a Frame is never empty. */
  | 'only-line'

/** With a Frame the refusals are changeFrame's, so Remove line and the Frame's other changes agree on them. */
export function removeLineRefusal(project: Project, selection: Selection | undefined): RemoveLineRefusal | undefined {
  const line = selectedProjectLine(project, selection)
  if (!line) {
    return 'no-line'
  }
  if (!project.frame) {
    return undefined
  }
  switch (frameChangeRefusal(project, { removeLine: line })) {
    case 'locked':
      return 'locked'
    case 'only-line':
      return 'only-line'
    default:
      return undefined
  }
}

/**
 * The Project without the line the Selection marks out, or the same Project, unchanged, when that is refused. With a
 * Frame this is a Frame change and goes through changeFrame; with none it is only an edit of a Piece area's beads.
 */
export function removeSelectedLine(project: Project, selection: Selection | undefined): Project {
  const line = selectedProjectLine(project, selection)
  if (!line || removeLineRefusal(project, selection)) {
    return project
  }
  if (project.frame) {
    const result = changeFrame(project, { removeLine: line })
    return result.kind === 'changed' ? result.project : project
  }
  return { ...project, beads: beadsWithoutLine(project.beads, line.area, line) }
}

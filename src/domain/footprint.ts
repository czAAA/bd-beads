import type { Frame } from './canvas'
import { canvasWeave, frameWeave, sameWeave, type Project } from './project'
import { describeWeave, positionStep, type Weave } from './weave'

/** A Weave's cell height over its width: what a Real bead stretches a row by (ADR 0068); 1 where the cell is square. */
const aspectOf = (weave: Weave): number => weave.cell?.aspect ?? 1

/** The Canvas positions a Frame hides and takes presses from (ADR 0070): its own rectangle where Canvas and Frame are
 * woven alike, otherwise the rows whose middle lies inside what the Frame draws. A Frame woven otherwise draws shorter
 * or taller than `rows` Canvas rows, so the rectangle it names and the place it covers differ; this is the place. */
export function frameFootprint(canvas: Weave, frame: Frame & Weave): Frame {
  const rectangle = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
  if (sameWeave(canvas, frame) || describeWeave(canvas).countsUnits || describeWeave(frame).countsUnits) {
    return rectangle
  }
  const drawn = describeWeave(frame).blockExtent(frame.columns, frame.rows, 1, aspectOf(frame)).height
  return { ...rectangle, rows: Math.max(1, Math.ceil((drawn - aspectOf(canvas) / 2) / positionStep(canvas).down)) }
}

/** The Canvas positions the Project's Frame hides (ADR 0070), or nothing without a Frame. */
export function footprintOf(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>): Frame | undefined {
  return project.frame && frameFootprint(canvasWeave(project), { ...project.frame, ...frameWeave(project) })
}

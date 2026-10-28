import type { Rect } from './canvas'
import { canvasWeave, frameWeave, sameWeave } from './layerWeave'
import type { Project } from './project'
import { describeWeave, positionStep, type Weave } from './weave'

/** A Weave's cell height over its width: what a Real bead stretches a row by (ADR 0068); 1 where the cell is square. */
const aspectOf = (weave: Weave): number => weave.cell?.aspect ?? 1

/** The Canvas positions a Frame hides and takes presses from (ADR 0066): its own rectangle where both layers are woven
 * alike or either Technique's policy names it (Units), else the rows whose middle lies inside what the Frame draws,
 * which is shorter or taller than `rows` Canvas rows where it is woven otherwise. */
export function frameFootprint(canvas: Weave, frame: Rect & Weave): Rect {
  const rectangle = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
  const named = (weave: Weave) => describeWeave(weave).policy.footprint === 'named'
  if (sameWeave(canvas, frame) || named(canvas) || named(frame)) {
    return rectangle
  }
  const drawn = describeWeave(frame).blockExtent(frame.columns, frame.rows, 1, aspectOf(frame)).height
  return { ...rectangle, rows: Math.max(1, Math.ceil((drawn - aspectOf(canvas) / 2) / positionStep(canvas).down)) }
}

/** The Canvas positions the Project's Frame hides (ADR 0066), or nothing without a Frame. */
export function footprintOf(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>): Rect | undefined {
  return project.frame && frameFootprint(canvasWeave(project), { ...project.frame, ...frameWeave(project) })
}

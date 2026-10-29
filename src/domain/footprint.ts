import type { FrameSheet, Rect } from './canvas'
import { laidRect } from './frameOrientation'
import { canvasWeave, frameWeave, sameWeave } from './layerWeave'
import { describeWeave, positionStep, type Weave } from './weave'
import { type Layered, frameOf } from './layerRecord'

/** A Weave's cell height over its width: what a Real bead stretches a row by (ADR 0068); 1 where the cell is square. */
const aspectOf = (weave: Weave): number => weave.cell?.aspect ?? 1

/** The Canvas positions a Frame hides and takes presses from (ADR 0066): its own rectangle where both layers are woven
 * alike, else the rows whose middle lies inside what the Frame draws, which is shorter or taller than `rows` Canvas rows
 * where it is woven otherwise. A turned Frame covers the rectangle it lies in (ticket 0667). */
export function frameFootprint(canvas: Weave, sheet: Rect & Weave & Partial<Pick<FrameSheet, 'shape' | 'quarterTurns'>>): Rect {
  // Both layers are drawn in the Project's Bead shape, whose cell the Canvas's Weave carries.
  const laid = laidRect({ ...sheet, cell: sheet.cell ?? canvas.cell })
  const frame = { ...sheet, rows: laid.rows, columns: laid.columns }
  const rectangle = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
  if (sameWeave(canvas, frame)) {
    return rectangle
  }
  const drawn = describeWeave(frame).blockExtent(frame.columns, frame.rows, 1, aspectOf(frame)).height
  return { ...rectangle, rows: Math.max(1, Math.ceil((drawn - aspectOf(canvas) / 2) / positionStep(canvas).down)) }
}

/** The Canvas positions the Project's Frame hides (ADR 0066), or nothing without a Frame. */
export function footprintOf(project: Layered): Rect | undefined {
  return frameOf(project) && frameFootprint(canvasWeave(project), { ...frameOf(project)!, ...frameWeave(project) })
}

import type { FrameSheet, Rect } from './canvas'
import { laidRect } from './frameOrientation'
import { canvasWeave, placedFrame, sameWeave } from './layerWeave'
import { describeWeave, positionStep, type Weave } from './weave'
import type { Layered } from './layerRecord'

/** A Weave's cell height over its width: what a Bead's cell stretches a row by (ADR 0068, ticket 0724); 1 where the cell is square. */
const aspectOf = (weave: Weave): number => weave.cell?.aspect ?? 1

/** The Canvas positions a Frame hides and takes presses from (ADR 0066): its own rectangle where the layers are alike,
 * else those whose middle lies inside what the Frame draws, woven otherwise or in a Bead `scale` times as wide (ticket
 * 0665). A turned Frame covers the rectangle it lies in (ticket 0667). */
export function frameFootprint(canvas: Weave, sheet: Rect & Weave & Partial<Pick<FrameSheet, 'shape' | 'quarterTurns'>> & { scale?: number }): Rect {
  const { scale = 1 } = sheet
  const laid = laidRect({ ...sheet, cell: sheet.cell ?? canvas.cell })
  const frame = { ...sheet, rows: laid.rows, columns: laid.columns }
  const rectangle = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
  if (sameWeave(canvas, frame) && scale === 1 && aspectOf(frame) === aspectOf(canvas)) {
    return rectangle
  }
  const drawn = describeWeave(frame).blockExtent(frame.columns, frame.rows, scale, scale * aspectOf(frame))
  const step = positionStep(canvas)
  const rows = Math.max(1, Math.ceil((drawn.height - aspectOf(canvas) / 2) / step.down))
  // Across, the beads are as wide as before unless the Bead differs; a shifted row's half bead is no column of its own.
  const columns = scale === 1 ? frame.columns : Math.max(1, Math.ceil((frame.columns * scale - 0.5) / step.across))
  return { ...rectangle, rows, columns }
}

/** The Canvas positions the Project's Frame hides (ADR 0066), or nothing without a Frame. */
export function footprintOf(project: Layered): Rect | undefined {
  const frame = placedFrame(project)
  return frame && frameFootprint(canvasWeave(project), frame)
}

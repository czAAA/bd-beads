import type { FrameSheet } from '../domain/canvas'
import { canvasRectCentre } from '../domain/sheets'
import type { Layered } from '../domain/layerRecord'
import type { FrameLayer } from '../domain/project'

/** A Frame's sheet as a test lays it: its rows and columns, and where on the Canvas's positions it starts (0, 0 unless given),
 * which `onCanvas` turns into the centre on the Table the Frame really holds (spec 1234). */
export type CanvasSheet = FrameSheet & Partial<FrameLayer> & { row?: number; column?: number }

/** The sheet with its Canvas position (`row`, `column`) taken as the place on the Table it lies at, in the Project's Canvas:
 * a sheet that has a centre keeps it. */
export function onCanvas(project: Layered, sheet: CanvasSheet): FrameSheet & Partial<FrameLayer> {
  const { row = 0, column = 0, ...rest } = sheet
  if (rest.centre) return rest
  return { ...rest, centre: canvasRectCentre(project, { row, column, rows: rest.rows, columns: rest.columns }) }
}

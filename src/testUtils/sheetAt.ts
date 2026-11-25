import type { FrameRef } from '../domain/grid'
import { frameById, frameIdOf, framesOf, type Layered } from '../domain/layerRecord'
import type { CanvasSheet } from './onCanvas'

/** The sheet of the Project's Frame (the first unless `ref` names one) as a test lays it at Canvas position `row`, `column`
 * (`onCanvas` turns that into the centre on the Table): its own centre dropped, `change` set over it. For `withLayers` and
 * `withFrameSheet` to move a Frame to a Canvas place now that it holds a centre in mm (spec 1234). */
export function sheetAt(project: Layered, row: number, column: number, change: Partial<CanvasSheet> = {}, ref?: FrameRef): CanvasSheet {
  const frame = frameById(project, ref ?? frameIdOf(framesOf(project)[0]!))!
  const { centre: _centre, ...sheet } = frame
  return { ...sheet, row, column, ...change }
}

import type { Rect } from '../domain/canvas'
import type { FrameRef } from '../domain/grid'
import { frameIdOf, framesOf, type Layered } from '../domain/layerRecord'
import { coversOf } from '../domain/sheets'

/** The Canvas positions the Project's Frame (the first unless `ref` names one) lies over, as the rectangle round them (spec
 * 1234): where a test that used to read the Frame's `row` and `column` reads its place now. Rows and columns 0 where none
 * lies under it. */
export function placeOf(project: Layered, ref?: FrameRef): Rect {
  const id = ref ?? frameIdOf(framesOf(project)[0]!)
  return coversOf(project).find((cover) => cover.ref === id)?.frame ?? { row: 0, column: 0, rows: 0, columns: 0 }
}

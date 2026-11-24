import type { FrameId } from '../domain/grid'
import { frameIdOf, framesOf, type Layered } from '../domain/layerRecord'

/** The id a test lays its first Frame under (ticket 1217), so a test can name that Frame without a Project in hand. */
export const FRAME_ID = 'test-frame' as FrameId

/** The id of a test Project's first Frame, for a call that names one; `FRAME_ID` for a Project without a Frame, to lay
 * one under or to read nothing. */
export function frameIdIn(project: Layered): FrameId {
  const first = framesOf(project)[0]
  return first ? frameIdOf(first) : FRAME_ID
}

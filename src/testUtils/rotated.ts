import type { Project } from '../domain/project'
import { orientationOf } from '../domain/layerRecord'
import { turnedOrientation } from '../domain/canvasOrientation'
import { withFields } from './flatFields'

/** The Project turned one quarter clockwise (the Canvas's orientation), for tests that need a rotated one to start from. */
export function turnedClockwise(project: Project): Project {
  return withFields(project, { rotation: turnedOrientation(orientationOf(project), 90) })
}

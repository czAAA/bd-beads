import type { Rotation } from '../domain/grid'
import type { Project } from '../domain/project'

/** The next quarter-turn clockwise, wrapping from 270° back to 0° (Rotate: ticket 171). */
function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}

/** The Project turned one quarter clockwise (see Project.rotation), for tests that need a rotated one to start from. */
export function turnedClockwise(project: Project): Project {
  return { ...project, rotation: nextRotation(project.rotation) }
}

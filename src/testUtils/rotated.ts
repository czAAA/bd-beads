import { nextRotation } from '../domain/grid'
import type { Project } from '../domain/project'

/** The Project turned one quarter clockwise (see Project.rotation), for tests that need a rotated one to start from. */
export function turnedClockwise(project: Project): Project {
  return { ...project, rotation: nextRotation(project.rotation) }
}

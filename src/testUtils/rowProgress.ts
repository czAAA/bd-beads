import type { Project } from '../domain/project'

/**
 * Row progress is on whenever there is a Frame (ticket 426, ADR 0055). A test builds a Project by hand with no Frame set
 * through the app's own operations, so these put the in-memory flag where a Frame would have put it.
 */
export function rowProgressOn(project: Project): Project {
  return { ...project, rowProgress: { ...project.rowProgress, enabled: true } }
}

/** The Project with the flag off, for a hand-built state the app itself never makes (no Frame to count rows on). */
export function rowProgressOff(project: Project): Project {
  return { ...project, rowProgress: { ...project.rowProgress, enabled: false } }
}

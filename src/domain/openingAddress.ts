// The editor's own addresses (ticket 0716): `?open=saved-projects` lands with no Project open and the Menu on Saved
// Projects (the Homepage's button, or a bookmark of it); `?project=<id>` opens that Project (a pick from the Homepage's
// Saved Projects) rather than the most recently saved.

/** What the address the editor was opened at asks for. */
export interface OpeningAddress {
  savedProjects: boolean
  project?: string
}

const OPEN_PARAM = 'open'
const SAVED_PROJECTS = 'saved-projects'
const PROJECT_PARAM = 'project'

/** What a query string (`location.search`) asks for; nothing for any other. */
export function parseOpeningAddress(search: string): OpeningAddress {
  const params = new URLSearchParams(search)
  const project = params.get(PROJECT_PARAM)
  return { savedProjects: params.get(OPEN_PARAM) === SAVED_PROJECTS, ...(project ? { project } : {}) }
}

/** The editor with no Project open and the Menu on Saved Projects, under the app's base path. */
export function savedProjectsAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${SAVED_PROJECTS}`
}

/** The editor on one Project. */
export function projectAddress(base: string, id: string): string {
  return `${base}?${PROJECT_PARAM}=${encodeURIComponent(id)}`
}

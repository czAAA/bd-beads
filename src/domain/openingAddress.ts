// The editor's own addresses (ticket 0716): `?open=saved-projects` lands with no Project open and the Menu on Saved
// Projects; `?project=<id>` opens that Project rather than the most recently saved; `?open=first-project` (the Homepage's
// Make your first Project, ticket 0866) makes a Project on New Project's presets while the library has none.

/** What the address the editor was opened at asks for. */
export interface OpeningAddress {
  savedProjects: boolean
  firstProject: boolean
  project?: string
}

const OPEN_PARAM = 'open'
const SAVED_PROJECTS = 'saved-projects'
const FIRST_PROJECT = 'first-project'
const PROJECT_PARAM = 'project'

/** What a query string (`location.search`) asks for; nothing for any other. */
export function parseOpeningAddress(search: string): OpeningAddress {
  const params = new URLSearchParams(search)
  const project = params.get(PROJECT_PARAM)
  const open = params.get(OPEN_PARAM)
  return { savedProjects: open === SAVED_PROJECTS, firstProject: open === FIRST_PROJECT, ...(project ? { project } : {}) }
}

/** The editor with no Project open and the Menu on Saved Projects, under the app's base path. */
export function savedProjectsAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${SAVED_PROJECTS}`
}

/** The editor making the first Project at once, with no form (ticket 0866). */
export function firstProjectAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${FIRST_PROJECT}`
}

/** The editor on one Project. */
export function projectAddress(base: string, id: string): string {
  return `${base}?${PROJECT_PARAM}=${encodeURIComponent(id)}`
}

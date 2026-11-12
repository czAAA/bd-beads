import type { GridPosition } from './grid'

// The editor's own addresses (ticket 0716): `?open=saved-projects` lands on Saved Projects; `?project=<id>` opens that
// Project, at `&zoom=<zoom>&at=<row>,<column>` this once if given (ticket 0879); `?open=first-project` (ticket 0866)
// makes a Project on New Project's presets while the library has none.

/** The view a Project opens at, this once: its zoom and the Canvas position in the middle of the drawing area. */
export interface OpeningView {
  zoom: number
  at: GridPosition
}

/** What the address the editor was opened at asks for. */
export interface OpeningAddress {
  savedProjects: boolean
  firstProject: boolean
  project?: string
  /** The view the Project opens at, in place of its fit. */
  view?: OpeningView
}

const OPEN_PARAM = 'open'
const SAVED_PROJECTS = 'saved-projects'
const FIRST_PROJECT = 'first-project'
const PROJECT_PARAM = 'project'
const ZOOM_PARAM = 'zoom'
const AT_PARAM = 'at'

/** The view the address names, when it names one whole: a zoom above 0 and a whole row and column. */
function viewOf(params: URLSearchParams): OpeningView | undefined {
  const zoom = Number(params.get(ZOOM_PARAM) ?? Number.NaN)
  const at = (params.get(AT_PARAM) ?? '').split(',').map((part) => (part.trim() === '' ? Number.NaN : Number(part)))
  if (!(zoom > 0) || !Number.isFinite(zoom) || at.length !== 2 || !at.every(Number.isInteger)) return undefined
  return { zoom, at: { row: at[0]!, column: at[1]! } }
}

/** What a query string (`location.search`) asks for; nothing for any other. */
export function parseOpeningAddress(search: string): OpeningAddress {
  const params = new URLSearchParams(search)
  const project = params.get(PROJECT_PARAM)
  const open = params.get(OPEN_PARAM)
  const view = project ? viewOf(params) : undefined
  return { savedProjects: open === SAVED_PROJECTS, firstProject: open === FIRST_PROJECT, ...(project ? { project } : {}), ...(view ? { view } : {}) }
}

/** The editor with no Project open and the Menu on Saved Projects, under the app's base path. */
export function savedProjectsAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${SAVED_PROJECTS}`
}

/** The editor making the first Project at once, with no form (ticket 0866). */
export function firstProjectAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${FIRST_PROJECT}`
}

/** The editor on one Project, at `view` when one is given. */
export function projectAddress(base: string, id: string, view?: OpeningView): string {
  const address = `${base}?${PROJECT_PARAM}=${encodeURIComponent(id)}`
  return view ? `${address}&${ZOOM_PARAM}=${view.zoom}&${AT_PARAM}=${view.at.row},${view.at.column}` : address
}

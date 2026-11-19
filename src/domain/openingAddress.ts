import type { GridPosition } from './grid'

// The editor's own addresses (ticket 0716): `?open=saved-projects`, `?project=<id>` at `&zoom=&at=<row>,<column>` if
// given (0879), `?open=first-project` (0866) and `-starter` (0953); from the Homepage's Menu (1113) `?open=new-project`
// (Menu on the New Project form) and `?open=convert-image`.

/** The view a Project opens at, this once: its zoom and the Canvas position in the middle of the drawing area. */
export interface OpeningView {
  zoom: number
  at: GridPosition
}

/** What the address the editor was opened at asks for. */
export interface OpeningAddress {
  savedProjects: boolean
  firstProject: boolean
  /** Menu opens on the New Project form (ticket 1113). */
  newProject?: true
  /** The Convert image page opens (ticket 1113). */
  convertImage?: true
  /** The first Project opens on the Frame panel's Starter gallery (ticket 0953). */
  starterGallery?: true
  project?: string
  /** The view the Project opens at, in place of its fit. */
  view?: OpeningView
}

const OPEN_PARAM = 'open'
const SAVED_PROJECTS = 'saved-projects'
const FIRST_PROJECT = 'first-project'
const FIRST_PROJECT_STARTER = 'first-project-starter'
const NEW_PROJECT = 'new-project'
const CONVERT_IMAGE = 'convert-image'
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
  const starterGallery = open === FIRST_PROJECT_STARTER
  return {
    savedProjects: open === SAVED_PROJECTS,
    firstProject: open === FIRST_PROJECT || starterGallery,
    ...(open === NEW_PROJECT ? { newProject: true } : {}),
    ...(open === CONVERT_IMAGE ? { convertImage: true } : {}),
    ...(starterGallery ? { starterGallery } : {}),
    ...(project ? { project } : {}),
    ...(view ? { view } : {}),
  }
}

/** The editor with no Project open and the Menu on Saved Projects, under the app's base path. */
export function savedProjectsAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${SAVED_PROJECTS}`
}

/** The editor making the first Project at once, with no form (ticket 0866). */
export function firstProjectAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${FIRST_PROJECT}`
}

/** The editor making the first Project at once and opening the Frame panel on its Starter gallery (ticket 0953). */
export function firstStarterAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${FIRST_PROJECT_STARTER}`
}

/** The editor with Menu on the New Project form (ticket 1113). */
export function newProjectAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${NEW_PROJECT}`
}

/** The editor on the Convert image page (ticket 1113). */
export function convertImageAddress(base: string): string {
  return `${base}?${OPEN_PARAM}=${CONVERT_IMAGE}`
}

/** The editor on one Project, at `view` when one is given. */
export function projectAddress(base: string, id: string, view?: OpeningView): string {
  const address = `${base}?${PROJECT_PARAM}=${encodeURIComponent(id)}`
  return view ? `${address}&${ZOOM_PARAM}=${view.zoom}&${AT_PARAM}=${view.at.row},${view.at.column}` : address
}

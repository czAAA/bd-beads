import { normalizeProject, type GridProject, type Project } from './project'

/**
 * The export file format. There is no backend to migrate a Project for us (ADR 0001), so a file carries the kind it
 * is and the format version that wrote it, and the reader refuses anything it doesn't understand rather than
 * silently importing half a Project.
 */
const PROJECT_FILE_KIND = 'bd-beads/pattern'
const LIBRARY_FILE_KIND = 'bd-beads/library'
/** Version 1 held a fixed grid of cells per Project; version 2 holds beads by position and a Frame (ADR 0026). Both are read, only 2 is written. */
const FILE_VERSION = 2
const FILE_VERSIONS: readonly number[] = [1, 2]

interface ProjectFile {
  kind: typeof PROJECT_FILE_KIND | typeof LIBRARY_FILE_KIND
  version: number
  // The key stays `patterns` on disk (ADR 0028): files already written and shared use it.
  patterns: (Project | GridProject)[]
}

/** What an exported file holds once read back. */
export interface ProjectFileContents {
  projects: Project[]
}

function serialize(kind: ProjectFile['kind'], projects: Project[]): string {
  const file: ProjectFile = { kind, version: FILE_VERSION, patterns: projects }
  return JSON.stringify(file, null, 2)
}

/** The open Project on its own, for sharing or backing it up (ticket 12). */
export function serializeProject(project: Project): string {
  return serialize(PROJECT_FILE_KIND, [project])
}

/** Every saved Project in one file, for moving a whole library to another device (ticket 15). */
export function serializeLibrary(projects: Project[]): string {
  return serialize(LIBRARY_FILE_KIND, projects)
}

/** Project names are free text (and may be Russian), so keep the letters that survive a filename and drop the rest. */
function fileNameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'project'
}

export function projectFileName(project: Project): string {
  return `bd-beads-${fileNameSlug(project.name)}.json`
}

/** The name a picture or document of the Project is saved under (ticket 73, 74), e.g. `bd-beads-my-scarf.png`. */
export function projectExportFileName(project: Project, extension: 'png' | 'pdf'): string {
  return `bd-beads-${fileNameSlug(project.name)}.${extension}`
}

export function libraryFileName(): string {
  return 'bd-beads-library.json'
}

function looksLikeProject(value: unknown): value is Project | GridProject {
  const project = value as Partial<Project & GridProject> | null
  const hasBeads = typeof project?.beads === 'object' && project.beads !== null
  const hasGrid = typeof project?.columns === 'number' && typeof project.rows === 'number' && Array.isArray(project.grid)
  return (
    typeof project === 'object' &&
    project !== null &&
    typeof project.id === 'string' &&
    typeof project.technique === 'string' &&
    typeof project.beadId === 'string' &&
    (hasBeads || hasGrid)
  )
}

/**
 * Reads the Projects out of an exported file, whether it holds one Project or a whole library, so a single import
 * action handles both. Throws when the file isn't one bd-beads wrote, or was written by a format version this build
 * doesn't know.
 */
export function parseProjectsFile(text: string): ProjectFileContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a bd-beads file: it is not valid JSON')
  }

  const file = parsed as Partial<ProjectFile> | null
  if (
    typeof file !== 'object' ||
    file === null ||
    (file.kind !== PROJECT_FILE_KIND && file.kind !== LIBRARY_FILE_KIND)
  ) {
    throw new Error('Not a bd-beads file')
  }

  if (typeof file.version !== 'number' || !FILE_VERSIONS.includes(file.version)) {
    throw new Error(`Unsupported bd-beads file version: ${String(file.version)}`)
  }

  if (!Array.isArray(file.patterns) || !file.patterns.every(looksLikeProject)) {
    throw new Error('This bd-beads file does not contain readable Projects')
  }

  return {
    projects: file.patterns.map(normalizeProject),
  }
}

/**
 * Picks which of the imported Projects to add locally. Importing never overwrites: a Project whose identity is
 * already taken here comes in as a separate entry under a fresh id, so the local copy and the imported one both
 * survive (ticket 15).
 */
export function importProjects(
  incoming: Project[],
  existing: Project[],
  newId: () => string = () => crypto.randomUUID(),
): Project[] {
  const taken = new Set(existing.map((project) => project.id))

  return incoming.map((project) => {
    const added = taken.has(project.id) ? { ...project, id: newId() } : project
    taken.add(added.id)
    return added
  })
}

import { normalizeProject, type GridProject, type Project, type StoredProject } from './project'
import { decodeEarlierProject, decodeProject, encodeProject, type EncodedProject, type EncodedVersionThreeProject } from './projectEncoding'
import type { VersionThreeProject } from './versionThree'
import { isTechnique } from './weave'

// The export file format (ADR 0048). With no backend to migrate for us (ADR 0001), a file carries its kind and format
// version and the reader refuses what it doesn't understand. This is the JSON inside `.openbeads`; the gzip is
// `projectFileCodec`'s.
const PROJECT_FILE_KIND = 'openbeads/project'
const LIBRARY_FILE_KIND = 'openbeads/library'
/** Version 3 is the first gzipped one: `projects`, each with its beads in the compact encoding (ADR 0009). Version 4
 * (ADR 0066) saves the Frame with its own beads; a build that knows only version 3 refuses it rather than drop them. */
const FILE_VERSION = 4

interface ProjectFile {
  kind: typeof PROJECT_FILE_KIND | typeof LIBRARY_FILE_KIND
  version: number
  projects: EncodedProject[]
}

// Every readable file version: each takes the file's encoded Projects and returns Projects for normalizeProject. The
// version 3 reader is temporary (versionThree.ts).
const READERS: Record<number, (projects: unknown[]) => StoredProject[]> = {
  3: (projects) => (projects as EncodedVersionThreeProject[]).map(decodeEarlierProject) as (VersionThreeProject | GridProject)[],
  4: (projects) => (projects as EncodedProject[]).map(decodeProject),
}

/** What an exported file holds once read back. */
export interface ProjectFileContents {
  projects: Project[]
}

function serialize(kind: ProjectFile['kind'], projects: Project[]): string {
  const file: ProjectFile = { kind, version: FILE_VERSION, projects: projects.map(encodeProject) }
  return JSON.stringify(file)
}

/** The open Project on its own, for sharing or backing it up (ticket 12), as the JSON a file wraps. */
export function serializeProject(project: Project): string {
  return serialize(PROJECT_FILE_KIND, [project])
}

/** Every saved Project in one file, for moving a whole library to another device (ticket 15), as the JSON a file
 * wraps. */
export function serializeLibrary(projects: Project[]): string {
  return serialize(LIBRARY_FILE_KIND, projects)
}

/** Project names are free text (and may be Russian), so keep the letters that survive a filename and drop the rest. */
function fileNameSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** `my-scarf_pr.openbeads`, or `openbeads_pr.openbeads` when the name leaves nothing to write (ticket 392). */
export function projectFileName(project: Project): string {
  return `${fileNameSlug(project.name) || 'openbeads'}_pr.openbeads`
}

/** The name a picture or document of the Project is saved under (ticket 73, 74), e.g. `openbeads-my-scarf.png`. */
export function projectExportFileName(project: Project, extension: 'png' | 'pdf'): string {
  return `openbeads-${fileNameSlug(project.name) || 'project'}.${extension}`
}

export function libraryFileName(): string {
  return 'openbeads_lib.openbeads'
}

/** Whether a parsed value has the fields of a Project, in either the beads shape or the older grid shape. */
export function looksLikeProject(value: unknown): value is StoredProject {
  const project = value as Partial<Project & GridProject> | null
  const hasBeads = typeof project?.beads === 'object' && project.beads !== null
  const hasGrid = typeof project?.columns === 'number' && typeof project.rows === 'number' && Array.isArray(project.grid)
  return (
    typeof project === 'object' &&
    project !== null &&
    typeof project.id === 'string' &&
    isTechnique(project.technique) &&
    typeof project.beadId === 'string' &&
    (hasBeads || hasGrid)
  )
}

function looksLikeEncodedProject(value: unknown): value is EncodedProject {
  const project = value as Partial<EncodedProject> | null
  return (
    typeof project === 'object' &&
    project !== null &&
    typeof project.encodedBeads === 'object' &&
    project.encodedBeads !== null &&
    // The rest of the shape is a Project's; its beads are the encoded ones, so stand a placeholder in for them.
    looksLikeProject({ ...project, beads: {} })
  )
}

/** Reads the Projects out of a file's JSON (one Project or a library) of a version this build knows; throws on foreign
 * JSON or an unknown version. */
export function parseProjectsFile(text: string): ProjectFileContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not an openbeads file: it is not valid JSON')
  }

  const file = parsed as Partial<ProjectFile> | null
  if (
    typeof file !== 'object' ||
    file === null ||
    (file.kind !== PROJECT_FILE_KIND && file.kind !== LIBRARY_FILE_KIND)
  ) {
    throw new Error('Not an openbeads file')
  }

  const read = typeof file.version === 'number' ? READERS[file.version] : undefined
  if (!read) {
    throw new Error(`Unsupported openbeads file version: ${String(file.version)}`)
  }

  if (!Array.isArray(file.projects) || !file.projects.every(looksLikeEncodedProject)) {
    throw new Error('This openbeads file does not contain readable Projects')
  }

  return { projects: read(file.projects).map(normalizeProject) }
}

/** Picks which imported Projects to add. Importing never overwrites: a taken id comes in under a fresh id (ticket
 * 15). */
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

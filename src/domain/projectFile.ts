import { inKnownTechniques, normalizeProject, type GridProject, type StoredProject } from './storedProject'
import type { Project } from './project'
import { decodeEarlierProject, decodeFlatProject, decodeProject, decodeVersionElevenProject, decodeVersionTwelveProject, encodeProject, type EncodedFlatProject, type EncodedLayer, type EncodedProject, type EncodedVersionThreeProject } from './projectEncoding'
import type { VersionThreeProject } from './versionThree'
import type { FlatProject } from './flatWeave'
import { isTechnique } from './weave'
import { frameOf, projectNameOf } from './layerRecord'

// The export file format (ADR 0048). With no backend to migrate for us (ADR 0001), a file carries its kind and format
// version and the reader refuses what it doesn't understand. This is the JSON inside `.openbeads`; the gzip is
// `projectFileCodec`'s.
const PROJECT_FILE_KIND = 'openbeads/project'
const LIBRARY_FILE_KIND = 'openbeads/library'
/** Version 3 is the first gzipped one (ADR 0009); 4 (ADR 0066) the Frame's own beads, 5 (0525) the Palette, 6 (0528)
 * removed defaults, 7 (534) the Bead's copy, 8 (0538) swatch codes, 9 (0592) a Custom frame, 10 (0638) Folded beads, 11
 * (0636) layer settings maps, 12 (0664) the layer list, 13 (0691) brick stitch's Drop under its new id; a build knowing only the one before refuses, not misreads. */
const FILE_VERSION = 13

interface ProjectFile {
  kind: typeof PROJECT_FILE_KIND | typeof LIBRARY_FILE_KIND
  version: number
  projects: (EncodedProject | EncodedFlatProject)[]
}

/** Versions 4 to 10 differ only in fields normalizeProject reads when present; each stores a layer's Brick block flat. */
const FLAT_WEAVE_VERSIONS = [4, 5, 6, 7, 8, 9, 10]

// Every readable file version: each takes the file's encoded Projects and returns Projects for normalizeProject. The
// readers of version 3 (versionThree.ts) and 4 (ticket 0525; it has no Palette, so gets the built-in twelve) are
// temporary, removed at the public release (ticket 0391).
const READERS: Record<number, (projects: unknown[]) => StoredProject[]> = {
  3: (projects) => (projects as EncodedVersionThreeProject[]).map(decodeEarlierProject) as (VersionThreeProject | GridProject)[],
  ...Object.fromEntries(FLAT_WEAVE_VERSIONS.map((version) => [version, (projects: unknown[]) => (projects as EncodedFlatProject[]).map(decodeFlatProject)])),
  11: (projects) => (projects as EncodedFlatProject[]).map(decodeVersionElevenProject),
  12: (projects) => (projects as EncodedProject[]).map(decodeVersionTwelveProject),
  [FILE_VERSION]: (projects) => (projects as EncodedProject[]).map(decodeProject),
}

/** What an exported file holds once read back. */
export interface ProjectFileContents {
  projects: Project[]
}

/** A file's JSON from Projects and Projects already in their stored form (the library's version 6 encodes a Project as
 * file version 13 does, ticket 0716), joined as strings so a sealed Project is never decoded. */
function serialize(kind: ProjectFile['kind'], projects: Project[], stored: readonly string[] = []): string {
  const encoded = [...projects.map((project) => JSON.stringify(encodeProject(project))), ...stored]
  return `{"kind":${JSON.stringify(kind)},"version":${FILE_VERSION},"projects":[${encoded.join(',')}]}`
}

/** The open Project on its own, for sharing or backing it up (ticket 12), as the JSON a file wraps. */
export function serializeProject(project: Project): string {
  return serialize(PROJECT_FILE_KIND, [project])
}

/** Every saved Project in one file, for moving a whole library to another device (ticket 15), as the JSON a file
 * wraps. */
export function serializeLibrary(projects: Project[], stored: readonly string[] = []): string {
  return serialize(LIBRARY_FILE_KIND, projects, stored)
}

/** A Project file made from a Project as the library stores it, without decoding it: the Export of a Project that
 * didn't open, or a sealed one (ticket 0716). */
export function serializeStoredProject(stored: string): string {
  return serialize(PROJECT_FILE_KIND, [], [stored])
}

/** Project names are free text (and may be Russian), so keep the letters that survive a filename and drop the rest. */
function fileNameSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** The names, each made filename-safe and joined by `-`; a name that leaves nothing to write is left out, and
 * `openbeads` stands in when none does (ticket 0720). */
function fileStem(names: (string | undefined)[]): string {
  return names.map((name) => fileNameSlug(name ?? '')).filter(Boolean).join('-') || 'openbeads'
}

/** The project file's name, e.g. `summer-ada.openbeads`: it holds the whole Project, so no Frame's name (tickets 392,
 * 0720). */
export function projectFileName(project: Project): string {
  return projectFileNameOf(projectNameOf(project), project.makerName)
}

/** The same from a Project's name and maker alone, for one that is not decoded (ticket 0716). */
export function projectFileNameOf(name: string, makerName?: string): string {
  return `${fileStem([name, makerName])}.openbeads`
}

/** The name a picture or document of the Project is saved under (tickets 73, 74, 0720), e.g. `summer-rose-ada.png`. */
export function projectExportFileName(project: Project, extension: 'png' | 'pdf'): string {
  return `${fileStem([projectNameOf(project), frameOf(project)?.name, project.makerName])}.${extension}`
}

/** A further page of the cover PNG (Beads needed running over, ticket 0583), e.g. `summer-rose-ada_2.png` for the second. */
export function projectListFileName(project: Project, page: number): string {
  return projectExportFileName(project, 'png').replace(/\.png$/, `_${page}.png`)
}

export function libraryFileName(): string {
  return 'openbeads_lib.openbeads'
}

/** Whether a parsed value has the fields of a Project saved before its layers, in either the beads shape or the
 * older grid shape. */
export function looksLikeProject(value: unknown): value is StoredProject {
  const project = value as Partial<FlatProject & GridProject> | null
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

/** Whether a stored layer has what every layer needs (ticket 0664): a Bead id and its encoded beads. Its Technique is
 * the Canvas's to have (`inKnownTechniques`); a Frame woven in one this build does not know takes the Canvas's. */
function looksLikeEncodedLayer(value: unknown): boolean {
  const layer = value as Partial<EncodedLayer> | null
  return typeof layer === 'object' && layer !== null && typeof layer.beadId === 'string' && typeof layer.encodedBeads === 'object' && layer.encodedBeads !== null
}

function looksLikeEncodedProject(value: unknown): boolean {
  const project = value as Partial<EncodedProject & EncodedFlatProject> | null
  if (typeof project !== 'object' || project === null) return false
  if (Array.isArray(project.layers)) {
    return typeof project.id === 'string' && project.layers.length > 0 && project.layers.every(looksLikeEncodedLayer)
  }
  // The rest of the shape is a Project's; its beads are the encoded ones, so stand a placeholder in for them.
  return typeof project.encodedBeads === 'object' && project.encodedBeads !== null && looksLikeProject({ ...project, beads: {} })
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

  // A Project in a Technique this build doesn't know is skipped; a file of nothing else is one it can't read (ticket 0644).
  const known = Array.isArray(file.projects) ? inKnownTechniques(file.projects) : []
  if (!Array.isArray(file.projects) || (file.projects.length > 0 && known.length === 0) || !known.every(looksLikeEncodedProject)) {
    throw new Error('This openbeads file does not contain readable Projects')
  }

  return { projects: read(known).map(normalizeProject) }
}

/** Picks which imported Projects to add. Importing never overwrites: a taken id comes in under a fresh id (ticket
 * 15). */
export function importProjects(
  incoming: Project[],
  existing: readonly Pick<Project, 'id'>[],
  newId: () => string = () => crypto.randomUUID(),
): Project[] {
  const taken = new Set(existing.map((project) => project.id))

  return incoming.map((project) => {
    const added = taken.has(project.id) ? { ...project, id: newId() } : project
    taken.add(added.id)
    return added
  })
}

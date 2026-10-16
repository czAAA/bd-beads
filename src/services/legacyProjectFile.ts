import { normalizeProject, type GridProject, type Project } from '../domain/project'
import { looksLikeProject, type ProjectFileContents } from '../domain/projectFile'

const LEGACY_KINDS = ['bd-beads/pattern', 'bd-beads/library']
/** Version 1 held a grid of cells per Project, 2 beads by position and a Frame (ADR 0026), 3 added Piece names (ticket 406). */
const LEGACY_VERSIONS = [1, 2, 3]

interface LegacyProjectFile {
  kind: string
  version: number
  patterns: (Project | GridProject)[]
}

/**
 * Reads a plain-JSON Project file as written before ADR 0048: kinds `bd-beads/pattern` and `bd-beads/library`, the key
 * `patterns`, a full object per bead. Throws on anything else, like the current reader.
 *
 * Versions 1 to 3 are read, not just 1 and 2: the JSON files written until ADR 0048 already said version 3 (Piece names).
 *
 * @deprecated Ticket 392: the old `.json` files people already have. Remove it, and `.json` from the import picker, after release.
 */
export function parseLegacyProjectsFile(text: string): ProjectFileContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not an openbeads file: it is not valid JSON')
  }

  const file = parsed as Partial<LegacyProjectFile> | null
  if (typeof file !== 'object' || file === null || typeof file.kind !== 'string' || !LEGACY_KINDS.includes(file.kind)) {
    throw new Error('Not an openbeads file')
  }

  if (typeof file.version !== 'number' || !LEGACY_VERSIONS.includes(file.version)) {
    throw new Error(`Unsupported openbeads file version: ${String(file.version)}`)
  }

  if (!Array.isArray(file.patterns) || !file.patterns.every(looksLikeProject)) {
    throw new Error('This openbeads file does not contain readable Projects')
  }

  return { projects: file.patterns.map(normalizeProject) }
}

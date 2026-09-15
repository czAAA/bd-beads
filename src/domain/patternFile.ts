import type { ColorBeadDefaults } from './beadMapping'
import { normalizePattern, type Pattern } from './pattern'

/**
 * The export file format. There is no backend to migrate a Pattern for us (ADR 0001), so a file carries the kind it
 * is and the format version that wrote it, and the reader refuses anything it doesn't understand rather than
 * silently importing half a Pattern.
 */
const PATTERN_FILE_KIND = 'bd-beads/pattern'
const LIBRARY_FILE_KIND = 'bd-beads/library'
const FILE_VERSION = 1

interface PatternFile {
  kind: typeof PATTERN_FILE_KIND | typeof LIBRARY_FILE_KIND
  version: number
  patterns: Pattern[]
  /**
   * The global color-to-bead defaults the Patterns lean on (ADR 0002). They live on the device, not on a Pattern,
   * so without them in the file every color that relies on a default would arrive unmapped on the other device.
   * Optional on the way in: files written before this field existed simply carry none.
   */
  colorBeadDefaults?: ColorBeadDefaults
}

/** What an exported file holds once read back. */
export interface PatternFileContents {
  patterns: Pattern[]
  colorBeadDefaults: ColorBeadDefaults
}

function serialize(
  kind: PatternFile['kind'],
  patterns: Pattern[],
  colorBeadDefaults: ColorBeadDefaults,
): string {
  const file: PatternFile = { kind, version: FILE_VERSION, patterns, colorBeadDefaults }
  return JSON.stringify(file, null, 2)
}

/** The open Pattern on its own, for sharing or backing it up (ticket 12). */
export function serializePattern(pattern: Pattern, colorBeadDefaults: ColorBeadDefaults): string {
  return serialize(PATTERN_FILE_KIND, [pattern], colorBeadDefaults)
}

/** Every saved Pattern in one file, for moving a whole library to another device (ticket 15). */
export function serializeLibrary(
  patterns: Pattern[],
  colorBeadDefaults: ColorBeadDefaults,
): string {
  return serialize(LIBRARY_FILE_KIND, patterns, colorBeadDefaults)
}

/** Pattern names are free text (and may be Russian), so keep the letters that survive a filename and drop the rest. */
function fileNameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'pattern'
}

export function patternFileName(pattern: Pattern): string {
  return `bd-beads-${fileNameSlug(pattern.name)}.json`
}

export function libraryFileName(): string {
  return 'bd-beads-library.json'
}

function looksLikePattern(value: unknown): value is Pattern {
  const pattern = value as Pattern | null
  return (
    typeof pattern === 'object' &&
    pattern !== null &&
    typeof pattern.id === 'string' &&
    typeof pattern.technique === 'string' &&
    typeof pattern.beadId === 'string' &&
    typeof pattern.columns === 'number' &&
    typeof pattern.rows === 'number' &&
    Array.isArray(pattern.grid)
  )
}

/**
 * Reads the Patterns out of an exported file, whether it holds one Pattern or a whole library, so a single import
 * action handles both. Throws when the file isn't one bd-beads wrote, or was written by a format version this build
 * doesn't know.
 */
export function parsePatternsFile(text: string): PatternFileContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a bd-beads file: it is not valid JSON')
  }

  const file = parsed as Partial<PatternFile> | null
  if (
    typeof file !== 'object' ||
    file === null ||
    (file.kind !== PATTERN_FILE_KIND && file.kind !== LIBRARY_FILE_KIND)
  ) {
    throw new Error('Not a bd-beads file')
  }

  if (file.version !== FILE_VERSION) {
    throw new Error(`Unsupported bd-beads file version: ${String(file.version)}`)
  }

  if (!Array.isArray(file.patterns) || !file.patterns.every(looksLikePattern)) {
    throw new Error('This bd-beads file does not contain readable Patterns')
  }

  return {
    patterns: file.patterns.map(normalizePattern),
    colorBeadDefaults: file.colorBeadDefaults ?? {},
  }
}

/**
 * Picks which of the imported Patterns to add locally. Importing never overwrites: a Pattern whose identity is
 * already taken here comes in as a separate entry under a fresh id, so the local copy and the imported one both
 * survive (ticket 15).
 */
export function importPatterns(
  incoming: Pattern[],
  existing: Pattern[],
  newId: () => string = () => crypto.randomUUID(),
): Pattern[] {
  const taken = new Set(existing.map((pattern) => pattern.id))

  return incoming.map((pattern) => {
    const added = taken.has(pattern.id) ? { ...pattern, id: newId() } : pattern
    taken.add(added.id)
    return added
  })
}

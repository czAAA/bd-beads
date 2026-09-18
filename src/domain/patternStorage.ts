import { beadLabel, findBead } from './beads'
import { normalizePattern, type Pattern } from './pattern'
import { decodePattern, encodePattern, type EncodedPattern } from './patternEncoding'

const STORAGE_KEY = 'bd-beads:patterns'

/**
 * The stored format savePatterns writes (ADR 0009). Version 1 is the original: a bare JSON array of Patterns, each
 * carrying an object per cell with a full hex string in it. Version 2 wraps the library in this envelope and stores
 * every grid compactly (see patternEncoding).
 *
 * Nothing but loadPatterns and savePatterns ever sees either shape — the rest of the app works with plain Patterns.
 */
const STORED_VERSION = 2

interface StoredLibrary {
  version: number
  patterns: EncodedPattern[]
}

/**
 * Every stored format this build can read, keyed by version: each takes the parsed JSON and hands back plain Patterns.
 * A third format needs only another entry here — version 1 is the one shape that has to be recognised by its own
 * outline (an array, not an envelope), and everything since says which version it is.
 *
 * A reader may throw on a value that isn't the shape it claims to be; loadPatterns treats that the same as unparseable
 * JSON.
 */
const READERS: Record<number, (parsed: unknown) => Pattern[]> = {
  1: (parsed) => parsed as Pattern[],
  2: (parsed) => (parsed as StoredLibrary).patterns.map(decodePattern),
}

/** Which stored format a parsed value is in, or undefined when it's neither a version-1 array nor a versioned envelope. */
function versionOf(parsed: unknown): number | undefined {
  if (Array.isArray(parsed)) {
    return 1
  }
  const version = (parsed as StoredLibrary | null)?.version
  return typeof version === 'number' ? version : undefined
}

/** Patterns saved before the `name` field existed have none; fall back to the bead label. */
function withName(pattern: Pattern): Pattern {
  if (pattern.name) {
    return pattern
  }
  const bead = findBead(pattern.beadId)
  return { ...pattern, name: bead ? beadLabel(bead) : pattern.beadId }
}

/**
 * Reads the whole Pattern library, in whichever stored format wrote it (see READERS). A library still in an older
 * format decodes to exactly the Patterns it held; the next save rewrites it in the current one, since savePatterns
 * always writes the whole library.
 *
 * Returns no Patterns at all — rather than throwing — for a value this build can't read: unparseable JSON, a shape
 * that doesn't match the version it claims, or a version a newer build wrote.
 */
export function loadPatterns(): Pattern[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const version = versionOf(parsed)
    const read = version === undefined ? undefined : READERS[version]
    return read ? read(parsed).map(withName).map(normalizePattern) : []
  } catch {
    return []
  }
}

/**
 * Writes the whole Pattern library, replacing whatever was there. The caller's in-memory library is the source of
 * truth (see usePatternLibrary), so this deliberately doesn't read storage back first to merge: a save used to parse
 * and re-normalise every saved Pattern before writing a single changed one, which is most of what ticket 55 measured
 * on the per-cell paint path.
 *
 * Every grid is encoded compactly on the way out (ADR 0009), which is the whole of the format change: an ordinary
 * 60×90 Pattern costs about 3KB here instead of about 100KB.
 *
 * Throws whatever the browser throws when the write doesn't fit (a QuotaExceededError, typically) — the caller is
 * expected to catch that and surface it rather than lose the edit silently.
 */
export function savePatterns(patterns: Pattern[]): void {
  const stored: StoredLibrary = { version: STORED_VERSION, patterns: patterns.map(encodePattern) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

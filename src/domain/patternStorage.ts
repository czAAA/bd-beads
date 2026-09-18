import { beadLabel, findBead } from './beads'
import { normalizePattern, type Pattern } from './pattern'

const STORAGE_KEY = 'bd-beads:patterns'

/** Patterns saved before the `name` field existed have none; fall back to the bead label. */
function withName(pattern: Pattern): Pattern {
  if (pattern.name) {
    return pattern
  }
  const bead = findBead(pattern.beadId)
  return { ...pattern, name: bead ? beadLabel(bead) : pattern.beadId }
}

export function loadPatterns(): Pattern[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Pattern[]).map(withName).map(normalizePattern) : []
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
 * Throws whatever the browser throws when the write doesn't fit (a QuotaExceededError, typically) — the caller is
 * expected to catch that and surface it rather than lose the edit silently.
 */
export function savePatterns(patterns: Pattern[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

import { beadLabel } from './beads'
import { findBead } from './beadStorage'
import type { Pattern } from './pattern'

const STORAGE_KEY = 'bd-beads:patterns'

function saveAll(patterns: Pattern[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

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
    return Array.isArray(parsed) ? (parsed as Pattern[]).map(withName) : []
  } catch {
    return []
  }
}

export function savePattern(pattern: Pattern): void {
  const patterns = loadPatterns()
  const index = patterns.findIndex((existing) => existing.id === pattern.id)

  if (index === -1) {
    patterns.push(pattern)
  } else {
    patterns[index] = pattern
  }

  saveAll(patterns)
}

export function removePattern(id: string): void {
  saveAll(loadPatterns().filter((pattern) => pattern.id !== id))
}

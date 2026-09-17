import { BEAD_CATALOG, type Bead } from './beads'

/**
 * Finds a Bead by id in the fixed built-in catalog (ADR 0007 / ticket 38 — the catalog is no longer user-editable).
 * Used wherever a Pattern references a Bead by id. Returns undefined for an id the catalog doesn't have: a custom
 * Bead saved before this change, or one an imported file names that this device never had — callers show a neutral
 * "unknown bead" placeholder for that case (see resolvePatternBead in pattern.ts) rather than breaking.
 */
export function findBead(id: string): Bead | undefined {
  return BEAD_CATALOG.find((bead) => bead.id === id)
}

import { BEAD_CATALOG, type Bead } from './beads'

const STORAGE_KEY = 'bd-beads:custom-beads'

export function loadCustomBeads(): Bead[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Bead[]) : []
  } catch {
    return []
  }
}

function saveAll(beads: Bead[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(beads))
}

export function saveCustomBead(bead: Bead): void {
  const beads = loadCustomBeads()
  const index = beads.findIndex((existing) => existing.id === bead.id)

  if (index === -1) {
    beads.push(bead)
  } else {
    beads[index] = bead
  }

  saveAll(beads)
}

export function removeCustomBead(id: string): void {
  saveAll(loadCustomBeads().filter((bead) => bead.id !== id))
}

/** Every bead available for use in a Pattern: the seeded catalog plus any user-added custom beads. */
export function allBeads(): Bead[] {
  return [...BEAD_CATALOG, ...loadCustomBeads()]
}

/** Finds a bead by id across the seeded catalog and custom beads — used wherever a Pattern references a bead by id. */
export function findBead(id: string): Bead | undefined {
  return allBeads().find((bead) => bead.id === id)
}

export type FormFactor = 'round' | 'cylinder' | 'cube'

export interface Bead {
  id: string
  brand: string
  name: string
  size: string
  formFactor: FormFactor
  /** The bead's own color, e.g. a PALETTE hex value; null for the seeded catalog entries, which predate this field. */
  color: string | null
  /** Bead footprint in millimeters, used to convert a physical pattern size into a grid. */
  widthMm: number
  heightMm: number
}

export const BEAD_CATALOG: readonly Bead[] = [
  {
    id: 'toho-cube-1.5mm',
    brand: 'TOHO',
    name: 'Cube',
    size: '1.5mm',
    formFactor: 'cube',
    color: null,
    widthMm: 1.5,
    heightMm: 1.5,
  },
  {
    id: 'toho-round-11-0',
    brand: 'TOHO',
    name: 'Round',
    size: '11/0',
    formFactor: 'round',
    color: null,
    widthMm: 2.2,
    heightMm: 2.2,
  },
  {
    id: 'miyuki-delica-11-0',
    brand: 'Miyuki',
    name: 'Delica',
    size: '11/0',
    formFactor: 'cylinder',
    color: null,
    widthMm: 1.6,
    heightMm: 1.3,
  },
]

/** A human-readable label for a Bead, e.g. "TOHO Cube 1.5mm". */
export function beadLabel(bead: Bead): string {
  return `${bead.brand} ${bead.name} ${bead.size}`
}

/**
 * Finds a Bead by id in the fixed built-in catalog (ADR 0007 / ticket 38 — the catalog is no longer user-editable).
 * Used wherever a Pattern references a Bead by id. Returns undefined for an id the catalog doesn't have: a custom
 * Bead saved before this change, or one an imported file names that this device never had — callers show a neutral
 * "unknown bead" placeholder for that case (see resolvePatternBead in pattern.ts) rather than breaking.
 */
export function findBead(id: string): Bead | undefined {
  return BEAD_CATALOG.find((bead) => bead.id === id)
}

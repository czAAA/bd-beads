export type FormFactor = 'round' | 'cylinder' | 'cube'

export interface Bead {
  id: string
  brand: string
  name: string
  size: string
  formFactor: FormFactor
  /** The bead's own color, e.g. a PALETTE hex value; null for the seeded catalog entries, which predate this field. */
  color: string | null
  /**
   * Bead footprint in millimeters, used to convert a physical pattern size into a grid. `widthMm` runs along the
   * thread (the bead's length through its hole), `heightMm` across it (the bead's diameter): on a loom, and in peyote
   * and brick stitch, the thread passes through the holes along a row, so beads sit side by side hole to hole.
   */
  widthMm: number
  heightMm: number
  /**
   * Extra millimeters added to each bead's `widthMm` for the thread and slack between neighbouring beads, which the
   * manufacturer's dimensions don't include. Empirical rather than published; absent means none.
   */
  widthCorrectionMm?: number
  /**
   * Average weight of one bead in grams, used only for the Beads needed box's Estimated weight (never stored on a
   * Pattern). PROVISIONAL: taken from public seller listings' counts per gram, not measured and not yet confirmed with
   * a dealer (ticket 155). Real beads vary by color and finish, so this is an average.
   */
  gramsPerBead?: number
}

/** A Bead's real column pitch: its own width plus the per-bead correction. What a grid's columns are counted in. */
export function beadPitchMm(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm'>): number {
  return bead.widthMm + (bead.widthCorrectionMm ?? 0)
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
    gramsPerBead: 0.0108,
  },
  {
    id: 'toho-round-11-0',
    brand: 'TOHO',
    name: 'Round',
    size: '11/0',
    formFactor: 'round',
    color: null,
    // Manufacturer: 2.2mm across, 1.5mm long. The correction is measured: 9 beads span 15mm on a loom (~1.65 each).
    widthMm: 1.5,
    heightMm: 2.2,
    widthCorrectionMm: 0.15,
    gramsPerBead: 0.0091,
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
    gramsPerBead: 0.005,
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

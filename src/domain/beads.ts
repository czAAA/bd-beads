/** A maker of Beads (ADR 0072). Its name is a literal, the same in every language. */
interface Brand {
  id: string
  name: string
}

/** The words a Form factor is named by: a translation key in every language (ticket 533), one per Form factor. */
export interface FormFactorNames {
  cube: string
  round: string
  delica: string
}

type FormFactorNameKey = keyof FormFactorNames

/** Which way a Bead's hole runs: `along` its width (the thread's way on a loom, peyote and brick stitch) or `across`. */
type HoleDirection = 'along' | 'across'

/** The shape of a family of Beads (ADR 0072): what is drawn for it and how it is threaded. A new shape is a new row,
 * not a new union member. */
interface FormFactor {
  id: string
  nameKey: FormFactorNameKey
  /** How much of a bead's width its corners are rounded by: near sharp for a cylinder, a pill for a round bead,
   * square for a cube. */
  roundness: number
  holes: { count: number; direction: HoleDirection }
  /** The id of the Brand's Color catalog this shape's Beads take their codes from (ticket 536); absent for a Form
   * factor with none, whose Beads keep the default colors. */
  colorCatalog?: string
}

export interface Bead {
  /** Built from its parts, `brand/form-factor/size`; never changed or reused (ADR 0072). */
  id: string
  brand: Brand
  formFactor: FormFactor
  size: string
  // Bead footprint in millimeters, to convert a physical size into a grid. `widthMm` runs along the thread (length
  // through the hole), `heightMm` across it (diameter): on a loom, peyote and brick stitch the thread passes along a
  // row, so beads sit side by side hole to hole.
  widthMm: number
  heightMm: number
  // Extra millimeters added to each bead's `widthMm` for thread and slack between neighbours, which the manufacturer's
  // dimensions omit. Empirical rather than published; absent means none.
  widthCorrectionMm?: number
  // Beads in a kilogram, used only for the Estimated weight and the print gram note (never stored). Absent when the
  // maker publishes no figure.
  beadsPerKg?: number
  /** A Bead that left the catalog stays in it, flagged, and is offered nowhere (ADR 0072). */
  retired?: boolean
}

/** A Bead's real column pitch: its own width plus the per-bead correction. What a grid's columns are counted in. */
export function beadPitchMm(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm'>): number {
  return bead.widthMm + (bead.widthCorrectionMm ?? 0)
}

/** Average weight of one bead in grams, from its beads per kg, to three significant digits so a figure reads the same
 * wherever it is shown; undefined for a Bead with no published figure. */
export function gramsPerBead(bead: Pick<Bead, 'beadsPerKg'> | undefined): number | undefined {
  return bead?.beadsPerKg ? Number((1000 / bead.beadsPerKg).toPrecision(3)) : undefined
}

const TOHO: Brand = { id: 'toho', name: 'TOHO' }
const MIYUKI: Brand = { id: 'miyuki', name: 'Miyuki' }

const CUBE: FormFactor = { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' } }
const ROUND: FormFactor = { id: 'round', nameKey: 'round', roundness: 0.5, holes: { count: 1, direction: 'along' } }
const DELICA: FormFactor = {
  id: 'delica',
  nameKey: 'delica',
  roundness: 0.1,
  holes: { count: 1, direction: 'along' },
  colorCatalog: 'miyuki-delica',
}

type BeadParts = Omit<Bead, 'id'>

function defineBead(parts: BeadParts): Bead {
  const size = parts.size.replace('/', '-')
  return { id: `${parts.brand.id}/${parts.formFactor.id}/${size}`, ...parts }
}

/** The Bead a new Project starts on. */
export const DEFAULT_BEAD: Bead = defineBead({
  brand: TOHO,
  formFactor: CUBE,
  size: '1.5mm',
  widthMm: 1.5,
  heightMm: 1.5,
  // PROVISIONAL: from public seller listings' counts per gram, not confirmed with a dealer (ticket 155).
  beadsPerKg: 92593,
})

export const BEAD_CATALOG: readonly Bead[] = [
  DEFAULT_BEAD,
  defineBead({
    brand: TOHO,
    formFactor: ROUND,
    size: '11/0',
    // Manufacturer: 2.2mm across, 1.5mm long. The correction is measured: 9 beads span 15mm on a loom (~1.65 each).
    widthMm: 1.5,
    heightMm: 2.2,
    widthCorrectionMm: 0.15,
    // PROVISIONAL, as above (ticket 155).
    beadsPerKg: 109890,
  }),
  defineBead({ brand: MIYUKI, formFactor: DELICA, size: '11/0', widthMm: 1.6, heightMm: 1.3, beadsPerKg: 200000 }),
]

/** The ids Beads had before they were built from their parts, read as the Bead they named (ADR 0072). */
const LEGACY_BEAD_IDS: Readonly<Record<string, string>> = {
  'toho-cube-1.5mm': 'toho/cube/1.5mm',
  'toho-round-11-0': 'toho/round/11-0',
  'miyuki-delica-11-0': 'miyuki/delica/11-0',
}

/** The English names, the default for a label made where no language is at hand (a new Project's name, an old
 * library's) and the English file's own. */
export const FORM_FACTOR_NAMES_EN: FormFactorNames = { cube: 'Cube', round: 'Round', delica: 'Delica' }

/** A human-readable label for a Bead, e.g. "TOHO Cube 1.5mm", with the Form factor named in the app's language. */
export function beadLabel(bead: Bead, names: FormFactorNames = FORM_FACTOR_NAMES_EN): string {
  return `${bead.brand.name} ${names[bead.formFactor.nameKey]} ${bead.size}`
}

/** The Beads a person can pick: the catalog without those that left it (ADR 0072). */
export function offeredBeads(): readonly Bead[] {
  return BEAD_CATALOG.filter((candidate) => !candidate.retired)
}

// Finds a Bead by id in the fixed built-in catalog (ADR 0007, ticket 38), reading an id from before ids were built from
// their parts. Returns undefined for an id the catalog lacks (a custom Bead saved earlier, or one an imported file names
// that this device never had); callers show an "unknown bead" placeholder (see resolveProjectBead).
export function findBead(id: string): Bead | undefined {
  const current = LEGACY_BEAD_IDS[id] ?? id
  return BEAD_CATALOG.find((candidate) => candidate.id === current)
}

/** A color family of a Brand, as its default Palette holds it: the id names it in every language (`colorNames`). */
interface ColorFamily {
  id: string
  hex: string
}

/** A maker of Beads (ADR 0072). Its name is a literal, the same in every language. */
interface Brand {
  id: string
  name: string
  /** The Brand's color families (ADR 0078): its Beads' default Palette and the base of its catalog's swatches. Absent,
   * the twelve built-in colors stand in. A Project's Bead copy leaves them out. */
  colorFamilies?: readonly ColorFamily[]
}

/** Which way a Bead's hole runs: `along` its width (its length through the hole) or `across` it, along its height. */
type HoleDirection = 'along' | 'across'

/** The shape of a family of Beads (ADR 0072): what is drawn for it and how it is threaded. A new shape is a new row,
 * not a new union member. */
interface FormFactor {
  id: string
  nameKey: string
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
  // Bead footprint in millimeters, to convert a physical size into a grid. `widthMm` is the length through the hole and
  // `heightMm` the diameter across it (for a hole running `along`); the Technique's Thread direction decides which way
  // each is laid on its Grid (ticket 0734).
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

/** A Bead's real pitch along the thread when its hole runs along its width: its length through the hole plus the
 * per-bead correction. */
export function beadPitchMm(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm'>): number {
  return bead.widthMm + (bead.widthCorrectionMm ?? 0)
}

/** What a Bead's measures need to be laid on a thread: its Form factor's hole direction is read where it is known (ticket
 * 0734), and a bead without one is a hole along its width. */
export type BeadMeasures = Pick<Bead, 'widthMm' | 'widthCorrectionMm' | 'heightMm'> & { formFactor?: Pick<Bead['formFactor'], 'holes'> }

/** A Bead laid with its hole along the thread (ticket 0734): the length through its hole plus the thread slack, which
 * goes with the thread, and its diameter across. A hole that runs `across` the width turns the bead the other way. */
export function threadMeasures(bead: BeadMeasures): { alongMm: number; acrossMm: number } {
  const turned = bead.formFactor?.holes.direction === 'across'
  const [length, diameter] = turned ? [bead.heightMm, bead.widthMm] : [bead.widthMm, bead.heightMm]
  return { alongMm: length + (bead.widthCorrectionMm ?? 0), acrossMm: diameter }
}

/** Average weight of one bead in grams, from its beads per kg, to three significant digits so a figure reads the same
 * wherever it is shown; undefined for a Bead with no published figure. */
export function gramsPerBead(bead: Pick<Bead, 'beadsPerKg'> | undefined): number | undefined {
  return bead?.beadsPerKg ? Number((1000 / bead.beadsPerKg).toPrecision(3)) : undefined
}

/** TOHO's color families (ticket 0694): our words and hexes for the hue tags of TOHO's Japanese search data (research
 * note brand-color-groups-for-default-palettes), every tag that is some code's only hue, so each code has a swatch
 * (Cream and Amber never stand alone). The twelve first, then TOHO's own; a color shared with Miyuki keeps id and hex. */
const TOHO: Brand = {
  id: 'toho',
  name: 'TOHO',
  colorFamilies: [
    { id: 'black', hex: '#1a1a1a' },
    { id: 'white', hex: '#ffffff' },
    { id: 'red', hex: '#e63746' },
    { id: 'orange', hex: '#f2994a' },
    { id: 'yellow', hex: '#f2c94c' },
    { id: 'green', hex: '#27ae60' },
    { id: 'teal', hex: '#2fb6ae' },
    { id: 'blue', hex: '#2f6fed' },
    { id: 'purple', hex: '#9b51e0' },
    { id: 'pink', hex: '#ec5990' },
    { id: 'brown', hex: '#8a5a3b' },
    { id: 'grey', hex: '#9aa0a6' },
    { id: 'lime', hex: '#a6d140' },
    { id: 'aqua', hex: '#5ec8e5' },
    { id: 'navy', hex: '#1f3a7a' },
    { id: 'beige', hex: '#e6d5b8' },
    { id: 'gold', hex: '#d4af37' },
    { id: 'silver', hex: '#c0c0c0' },
    { id: 'copper', hex: '#b87333' },
    { id: 'crystal', hex: '#dcebf2' },
    { id: 'iridescent', hex: '#8fb8de' },
  ],
}
/** Miyuki's 16 color families without "Mix" (research note brand-color-groups-for-default-palettes, ticket 0527): the
 * names are the MIYUKI Beads Directory's, the hexes our own picks, measured from no photo. A color shared with the
 * twelve keeps its id and hex, so it is one color whichever Bead is open (a test checks). */
const MIYUKI: Brand = {
  id: 'miyuki',
  name: 'Miyuki',
  colorFamilies: [
    { id: 'black', hex: '#1a1a1a' },
    { id: 'white', hex: '#ffffff' },
    { id: 'red', hex: '#e63746' },
    { id: 'orange', hex: '#f2994a' },
    { id: 'yellow', hex: '#f2c94c' },
    { id: 'green', hex: '#27ae60' },
    { id: 'blue', hex: '#2f6fed' },
    { id: 'purple', hex: '#9b51e0' },
    { id: 'pink', hex: '#ec5990' },
    { id: 'brown', hex: '#8a5a3b' },
    { id: 'grey', hex: '#9aa0a6' },
    { id: 'beige', hex: '#e6d5b8' },
    { id: 'gold', hex: '#d4af37' },
    { id: 'silver', hex: '#c0c0c0' },
    { id: 'crystal', hex: '#dcebf2' },
    { id: 'iridescent', hex: '#8fb8de' },
  ],
}

// TOHO numbers its colors in one series shared by every shape, so its Form factors share the one `toho` catalog and a
// code lists the sizes of each shape it exists in (ticket 0694).
const CUBE: FormFactor = { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' }, colorCatalog: 'toho' }
const ROUND: FormFactor = { id: 'round', nameKey: 'round', roundness: 0.5, holes: { count: 1, direction: 'along' }, colorCatalog: 'toho' }
const DELICA: FormFactor = {
  id: 'delica',
  nameKey: 'delica',
  roundness: 0.1,
  holes: { count: 1, direction: 'along' },
  colorCatalog: 'miyuki-delica',
}

/** Miyuki's Round Rocailles: drawn like TOHO's Round, but with Miyuki's own Color catalog (ticket 0693). */
const MIYUKI_ROUND: FormFactor = { ...ROUND, colorCatalog: 'miyuki-round' }

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
  defineBead({ brand: MIYUKI, formFactor: DELICA, size: '11/0', widthMm: 1.3, heightMm: 1.6, beadsPerKg: 200000 }),
  // Miyuki's size table (ticket 539) gives an outer diameter (`heightMm`) and beads per 10 cm of strung beads, which
  // gives the length along the thread (`widthMm`, 100 / count). Every figure is "approx." there.
  defineBead({ brand: MIYUKI, formFactor: DELICA, size: '15/0', widthMm: 1.1, heightMm: 1.3, beadsPerKg: 350000 }),
  defineBead({ brand: MIYUKI, formFactor: DELICA, size: '10/0', widthMm: 1.7, heightMm: 2.2, beadsPerKg: 108000 }),
  defineBead({ brand: MIYUKI, formFactor: DELICA, size: '8/0', widthMm: 2.7, heightMm: 3, beadsPerKg: 30000 }),
  defineBead({ brand: MIYUKI, formFactor: MIYUKI_ROUND, size: '15/0', widthMm: 1, heightMm: 1.5, beadsPerKg: 250000 }),
  defineBead({ brand: MIYUKI, formFactor: MIYUKI_ROUND, size: '11/0', widthMm: 1.4, heightMm: 2, beadsPerKg: 110000 }),
  defineBead({ brand: MIYUKI, formFactor: MIYUKI_ROUND, size: '8/0', widthMm: 2.1, heightMm: 3, beadsPerKg: 39000 }),
  defineBead({ brand: MIYUKI, formFactor: MIYUKI_ROUND, size: '6/0', widthMm: 2.9, heightMm: 4.5, beadsPerKg: 12000 }),
  // TOHO publishes diameters (its Shape Chart) but no length, so `widthMm` is the diameter at the measured 11/0 ratio
  // (1.5 / 2.2). PROVISIONAL until measured. Beads per kg only where TOHO's chart has one.
  defineBead({ brand: TOHO, formFactor: ROUND, size: '15/0', widthMm: 1, heightMm: 1.5, beadsPerKg: 269400 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '10/0', widthMm: 1.6, heightMm: 2.4 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '9/0', widthMm: 1.8, heightMm: 2.6 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '8/0', widthMm: 2, heightMm: 3, beadsPerKg: 41800 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '7/0', widthMm: 2.4, heightMm: 3.5 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '6/0', widthMm: 2.7, heightMm: 4, beadsPerKg: 16700 }),
  defineBead({ brand: TOHO, formFactor: ROUND, size: '3/0', widthMm: 3.7, heightMm: 5.5 }),
]

/** The ids Beads had before they were built from their parts, read as the Bead they named (ADR 0072). */
const LEGACY_BEAD_IDS: Readonly<Record<string, string>> = {
  'toho-cube-1.5mm': 'toho/cube/1.5mm',
  'toho-round-11-0': 'toho/round/11-0',
  'miyuki-delica-11-0': 'miyuki/delica/11-0',
}

/** The Form factors' names, by name key: literals like a Brand's name, the same in every language, as the maker names
 * the shape on the bag (ticket 0692). A new Form factor is its row and its name here. */
const FORM_FACTOR_NAMES: Readonly<Record<string, string>> = { cube: 'Cube', round: 'Round', delica: 'Delica' }

/** A Form factor's name; its id where it has none (a test keeps that from shipping). */
export function formFactorName(formFactor: Pick<FormFactor, 'id' | 'nameKey'>): string {
  return FORM_FACTOR_NAMES[formFactor.nameKey] ?? formFactor.id
}

/** A human-readable label for a Bead, e.g. "TOHO Cube 1.5mm", the same in every language. */
export function beadLabel(bead: Bead): string {
  return `${bead.brand.name} ${formFactorName(bead.formFactor)} ${bead.size}`
}

/** The catalog's Brand with this id, with its color families; undefined for a Brand no catalog Bead is made by. */
export function findBrand(id: string): Brand | undefined {
  return BEAD_CATALOG.find((bead) => bead.brand.id === id)?.brand
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

/** The Bead a Project saves as its own (ADR 0072): the catalog's Bead without the retired flag, which is the catalog's
 * to say and not the Project's, nor its Brand's color families, which are read from the catalog (ADR 0078). The Form
 * factor is kept whole, as files hold it since ticket 536; its `colorCatalog` is read from the catalog too (`colorCatalogOf`). */
export function beadCopy(bead: Bead): Bead {
  const { retired: _retired, ...copy } = bead
  return { ...copy, brand: { id: bead.brand.id, name: bead.brand.name } }
}

/** The Color catalog a Bead's codes come from (ticket 0694): the registry's Form factor names it, never a Project's
 * copy, as the catalog is the app's and a Bead saved before it had one gains it. Undefined for a Bead nobody knows or
 * one without. */
export function colorCatalogOf(beadId: string | undefined): string | undefined {
  return beadId === undefined ? undefined : findBead(beadId)?.formFactor.colorCatalog
}

/** What a layer's Bead could switch to (tickets 48, 534, 0670): everything offered but its own, and the catalog's current
 * Bead of its id when its copy has gone out of date (ADR 0072). */
export function replaceCandidates(own: Bead | undefined): Bead[] {
  return offeredBeads().filter((bead) => bead.id !== own?.id || beadsDiffer(own, bead))
}

/** Whether two Beads of one id differ in anything that changes how a Project looks or weighs: footprint, correction,
 * Form factor outline and holes, and beads per kg. Names and labels do not count (ADR 0072). */
export function beadsDiffer(a: Bead, b: Bead): boolean {
  return (
    a.widthMm !== b.widthMm ||
    a.heightMm !== b.heightMm ||
    (a.widthCorrectionMm ?? 0) !== (b.widthCorrectionMm ?? 0) ||
    a.beadsPerKg !== b.beadsPerKg ||
    a.formFactor.roundness !== b.formFactor.roundness ||
    a.formFactor.holes.count !== b.formFactor.holes.count ||
    a.formFactor.holes.direction !== b.formFactor.holes.direction
  )
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** The Bead copy a stored Project holds, or undefined when it is missing or not the shape of a Bead (the catalog's Bead
 * of the same id stands in then). */
export function readBeadCopy(stored: unknown): Bead | undefined {
  const bead = stored as Partial<Bead> | null
  const { brand, formFactor } = bead ?? {}
  const holes = formFactor?.holes
  const valid =
    typeof bead === 'object' && bead !== null &&
    typeof bead.id === 'string' && typeof bead.size === 'string' &&
    typeof brand?.id === 'string' && typeof brand.name === 'string' &&
    typeof formFactor?.id === 'string' && typeof formFactor.nameKey === 'string' && isNumber(formFactor.roundness) &&
    isNumber(holes?.count) && (holes.direction === 'along' || holes.direction === 'across') &&
    isNumber(bead.widthMm) && isNumber(bead.heightMm) &&
    (bead.widthCorrectionMm === undefined || isNumber(bead.widthCorrectionMm)) &&
    (bead.beadsPerKg === undefined || isNumber(bead.beadsPerKg))
  return valid ? withDelica11Corrected(beadCopy(bead as Bead)) : undefined
}

/** A Delica 11/0 copy saved with the sizes the catalog had the wrong way round (1.6 along, 1.3 across, ticket 0722)
 * turned to Miyuki's: 1.3 along the thread, 1.6 across. A copy with any other numbers is left as it is. */
function withDelica11Corrected(copy: Bead): Bead {
  return copy.id === 'miyuki/delica/11-0' && copy.widthMm === 1.6 && copy.heightMm === 1.3 ? { ...copy, widthMm: 1.3, heightMm: 1.6 } : copy
}

/** The Bead a pick in Brand or Type leads to (ticket 554): the three pickers narrow each other, so a new Brand keeps
 * the Type and the size when it has them, else its first. Picking a Size is a Bead of its own and needs none of this. */
/** The items with the first of each key kept, in order: the distinct Brands, Form factors or Sizes of a list of Beads. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return items.filter((item, index) => items.findIndex((other) => key(other) === key(item)) === index)
}

export function beadAfterPick(beads: readonly Bead[], current: Bead, pick: { brandId?: string; formFactorId?: string }): Bead | undefined {
  const brandId = pick.brandId ?? current.brand.id
  const inBrand = beads.filter((bead) => bead.brand.id === brandId)
  const formFactorId = pick.formFactorId ?? current.formFactor.id
  const inType = inBrand.filter((bead) => bead.formFactor.id === formFactorId)
  const pool = inType.length ? inType : inBrand
  return pool.find((bead) => bead.size === current.size) ?? pool[0]
}

import { beadPitchMm, type Bead } from './beads'
import type { BeadMap } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { customFrameSize, frameGeometry, frameShapeOf, settingValuesOf, type FrameShapeId, type FrameSettingName, type FrameSettings } from './frameShape'
import type { GridDimensions, GridPosition } from './grid'
import { createProject } from './createProject'
import { resolveProjectBead } from './projectBead'
import { weaveOf } from './layerWeave'
import type { Project } from './project'
import { decodeBeads, type EncodedBeads } from './projectEncoding'
import { estimatedSizeMm } from './projectSize'
import type { SettingSpec } from './settingSpec'
import { describeWeave, type Technique } from './weave'
import categories from '../data/starters/categories.json'

// The Starters (spec 0590, tickets 0596, 0597, 0633; StarterGallery card): each a design for a Frame at one best
// size, kept with the app in `src/data/starters/` as a manifest (`<id>.starter.json`) beside its design, its Frame's
// size and beads alone (ticket 0636). A new one is data alone.

/** The Starter gallery's categories. */
export type StarterCategoryId = 'shapes' | 'earrings' | 'rings' | 'bands'

/** A Starter by id: a Shape's is its Frame shape's and it is named by it, the others name their copy (`starters.options.<id>`). */
export type StarterId = string

/** What a Starter's setup sizes in numbers: a Custom frame's settings, or a Ring's or Band's Width in beads and its Ring
 * size (EU: the inside round in mm) or Wrist (cm, measured snug). */
export type StarterSizeName = FrameSettingName | 'width' | 'ringSize' | 'wrist'

/** What a Starter's setup chooses: a Fringe earring's style, or how a Band fits. */
export type StarterPickName = 'fringeStyle' | 'fit'

/** How a Band sits on the wrist (StarterGallery card): the ease added to the wrist, 1, 1.5 or 2 cm. */
export type BandFit = 'snug' | 'comfortable' | 'loose'

/** Each Fit's ease, in mm.
 * @internal The registry test checks every Band's Fits have one. */
export const BAND_EASE_MM: Readonly<Record<BandFit, number>> = { snug: 10, comfortable: 15, loose: 20 }

/** The Bead the designs are made for and the cards are drawn and counted with (StarterGallery card): Delica 11/0. */
export const STARTER_BEAD_ID = 'miyuki/delica/11-0'

/** What a Band leaves for its clasp, in mm (StarterGallery card). */
export const BAND_CLASP_MM = 15

/** A Ring runs small once woven, so its band is this much longer than the finger's round, in mm (StarterGallery card). */
const RING_EASE_MM = 4

/** The usual US Ring sizes, offered as chips when the Size system is US. */
export const US_RING_PRESETS: readonly number[] = [5, 6, 7, 8, 9]

/** How a Starter's Frame is sized and measured, the rule its manifest names (ticket 0633): `frame` by its Frame shape's
 * settings, `ring` and `band` as a strip lying across, as long as the finger's round or the wrist with its Fit. */
type StarterMeasureRule = 'frame' | 'ring' | 'band'

/** One size of a Starter, in the shape every setting has (ADR 0078): its default is the value its design is made for,
 * never cropped, scaled or repeated to another; its presets the usual values offered as chips. */
export type StarterSize = SettingSpec<StarterSizeName> & {
  presets: readonly number[]
  /** Left out of a card's caption, where it would make it too long. */
  caption?: false
}

/** One choice of a Starter: the value its design is made for, the values offered, and the size the setup shows it
 * before (a Fringe style before the Fringe length), or after them all. */
export interface StarterPick {
  id: StarterPickName
  default: string
  values: readonly string[]
  before?: StarterSizeName
}

/** A size as a manifest gives it: one of its Frame shape's settings names only what differs from the shape's own (the design's
 * default and presets), any other every field. */
type ManifestSize = Partial<StarterSize> & Pick<StarterSize, 'id'>

/** A Starter's manifest (ticket 0633), the file `<id>.starter.json` beside its design: its Frame shape, the Technique it
 * is woven in, its sizes and choices, how it is measured, and whether it is made as a pair (an earring).
 * @internal The registry test reads every manifest file as one, to find any no category lists. */
export interface StarterManifest {
  id: StarterId
  /** Its design's file name, beside it: the design's Frame size and beads (StoredDesign). */
  design: string
  /** Its Frame shape: a Shape's or an earring's; none for a Ring or Band, a Frame without one. */
  shape?: FrameShapeId
  technique: Technique
  measure: StarterMeasureRule
  pair?: true
  sizes: readonly ManifestSize[]
  picks: readonly StarterPick[]
}

/** A Starter's design as its file stores it (ticket 0636): its Frame's rows and columns, and its beads in the compact
 * encoding a Project file uses (ADR 0009), by their position in the layout or the rectangle. */
interface StoredDesign {
  rows: number
  columns: number
  encodedBeads: EncodedBeads
}

/** A ready-made design for a Frame (ADR 0077): its manifest, its sizes in full, its category and its stored design. A
 * Ring or Band is a Frame without a Frame shape, sized for the finger or the wrist. */
export interface Starter extends Omit<StarterManifest, 'design' | 'sizes'> {
  category: StarterCategoryId
  sizes: readonly StarterSize[]
  /** Its design as its file stores it. */
  file: StoredDesign
}

/** A category of the gallery: its Starters in the order its step shows them, and the one whose design is its picture. */
export interface StarterCategory {
  id: StarterCategoryId
  starters: readonly Starter[]
  best: Starter
}

const FOLDER = '../data/starters/'
const MANIFESTS = import.meta.glob<StarterManifest>('../data/starters/*.starter.json', { eager: true, import: 'default' })
const DESIGNS = import.meta.glob<StoredDesign>(['../data/starters/*.json', '!**/*.starter.json', '!**/categories.json'], { eager: true, import: 'default' })

/** A size in full: a setting of the Starter's Frame shape takes the shape's range, default and presets where it gives
 * none. */
function sizeOf(shape: FrameShapeId | undefined, size: ManifestSize): StarterSize {
  const own = frameShapeOf({ shape })?.settings.find((each) => each.id === size.id)
  return { presets: [], ...own, ...size } as StarterSize
}

/** A Starter from its manifest, in the category that lists it. */
function starterOf({ design, sizes, ...manifest }: StarterManifest, category: StarterCategoryId): Starter {
  return { ...manifest, category, sizes: sizes.map((size) => sizeOf(manifest.shape, size)), file: DESIGNS[FOLDER + design] }
}

const BY_ID = new Map(Object.values(MANIFESTS).map((manifest) => [manifest.id, manifest]))

/** The registry, in the order step 1 shows the categories (`categories.json`): each its Starters in order, and the one
 * whose design is its picture. */
export const STARTER_CATEGORIES: readonly StarterCategory[] = categories.map(({ id, best, starters }) => {
  const listed = starters.map((each) => starterOf(BY_ID.get(each)!, id as StarterCategoryId))
  return { id: id as StarterCategoryId, starters: listed, best: listed.find((starter) => starter.id === best)! }
})

/** The Starter with this id. */
export function starterById(id: StarterId): Starter {
  return STARTER_CATEGORIES.flatMap((each) => each.starters).find((starter) => starter.id === id)!
}

/** A Starter's design as read: its Frame's beads and size. */
interface Design {
  beads: BeadMap
  rows: number
  columns: number
}

const designs = new Map<StarterId, Design>()

function designOf(starter: Starter): Design {
  const known = designs.get(starter.id)
  if (known) return known
  const { rows, columns, encodedBeads } = starter.file
  const design = { beads: decodeBeads(encodedBeads), rows, columns }
  designs.set(starter.id, design)
  return design
}

/** A Starter's design: the beads of its Frame. Read once.
 * @internal Tests compare a new Project with the Starter's own beads. */
export function starterDesign(starter: Starter): BeadMap {
  return designOf(starter).beads
}

/** A Starter's sizes as the setup holds them: a value for each, a Ring size always in EU. */
export type StarterSizes = Partial<Record<StarterSizeName, number>>

/** A Starter's choices as the setup holds them. */
export type StarterPicks = Partial<Record<StarterPickName, string>>

/** What the setup asks of a Starter: its sizes and choices, and whether the design is put in place or the Frame starts
 * empty. The design goes in only at its own sizes and choices; any not given are the design's. */
export interface StarterChoice {
  sizes: StarterSizes
  picks?: StarterPicks
  useDesign: boolean
}

/** A Starter's sizes as its design is made. */
export function designSizes(starter: Starter): StarterSizes {
  return Object.fromEntries(starter.sizes.map((size) => [size.id, size.default]))
}

/** A Starter's choices as its design is made. */
export function designPicks(starter: Starter): StarterPicks {
  return Object.fromEntries(starter.picks.map((pick) => [pick.id, pick.default]))
}

/** A size the choice sets, or the design's where it sets none. */
function sizeIn(starter: Starter, sizes: StarterSizes, id: StarterSizeName): number {
  return sizes[id] ?? starter.sizes.find((each) => each.id === id)!.default
}

/** A choice the setup makes, or the design's where it makes none. */
function pickIn(starter: Starter, picks: StarterPicks | undefined, id: StarterPickName): string {
  return picks?.[id] ?? starter.picks.find((each) => each.id === id)!.default
}

/** The design's sizes and choices a setup has moved away from, in the setup's order; none when the design fits. A Ring
 * size set in US counts as the whole EU size it comes to. */
export function designDifferences(starter: Starter, { sizes, picks }: Pick<StarterChoice, 'sizes' | 'picks'>): ({ size: StarterSize } | { pick: StarterPick })[] {
  return [
    ...starter.sizes.filter((size) => Math.round(sizeIn(starter, sizes, size.id)) !== size.default).map((size) => ({ size })),
    ...starter.picks.filter((pick) => pickIn(starter, picks, pick.id) !== pick.default).map((pick) => ({ pick })),
  ]
}

/** Whether a choice's sizes and choices are the design's. */
export function designFits(starter: Starter, choice: Pick<StarterChoice, 'sizes' | 'picks'>): boolean {
  return designDifferences(starter, choice).length === 0
}

/** The range each of a Starter's sizes may take with the others as they are: a Fringe earring's top has fewer rows than
 * its base row has beads. */
export function starterSizeRanges(starter: Starter, sizes: StarterSizes): Partial<Record<StarterSizeName, { min: number; max: number }>> {
  const custom = new Map(settingValuesOf({ shape: starter.shape, settings: customSettings(starter, { sizes }) }).map((each) => [each.name as StarterSizeName, each]))
  return Object.fromEntries(starter.sizes.map(({ id, min, max }) => [id, { min, max: custom.get(id)?.max ?? max }]))
}

/** A strip rule's length round the finger or wrist, in mm: a Ring's size and its ease, or a Band's wrist with its Fit's
 * ease, less the clasp. */
const STRIP_LENGTH_MM: Readonly<Record<Exclude<StarterMeasureRule, 'frame'>, (starter: Starter, choice: Pick<StarterChoice, 'sizes' | 'picks'>) => number>> = {
  ring: (starter, { sizes }) => sizeIn(starter, sizes, 'ringSize') + RING_EASE_MM,
  band: (starter, { sizes, picks }) => sizeIn(starter, sizes, 'wrist') * 10 + (BAND_EASE_MM[pickIn(starter, picks, 'fit') as BandFit] ?? BAND_EASE_MM.comfortable) - BAND_CLASP_MM,
}

/** A Custom frame Starter's settings for a choice: its sizes and choices in its Frame shape's settings. */
function customSettings(starter: Starter, { sizes, picks }: Pick<StarterChoice, 'sizes' | 'picks'>): FrameSettings {
  const numbers = Object.fromEntries(starter.sizes.map(({ id }) => [id, sizeIn(starter, sizes, id)]))
  return { ...numbers, ...Object.fromEntries(starter.picks.map(({ id }) => [id, pickIn(starter, picks, id)])) }
}

/** A Starter's Frame rows and columns for a choice on a Bead, by its measuring rule: a Custom frame's rectangle; a Ring
 * or Band lying across takes its Width in rows and its length in columns of the Bead's pitch, as put in place.
 * @internal Its test checks each Starter's size on its own. */
export function starterFrameSize(starter: Starter, choice: StarterChoice, bead: Bead): GridDimensions {
  if (starter.measure === 'frame') return customFrameSize(starter.shape!, customSettings(starter, choice))
  if (choice.useDesign && designFits(starter, choice)) return { rows: designOf(starter).rows, columns: designOf(starter).columns }
  return { rows: sizeIn(starter, choice.sizes, 'width'), columns: Math.max(1, Math.round(STRIP_LENGTH_MM[starter.measure](starter, choice) / beadPitchMm(bead))) }
}

/** How many beads a Starter's Frame holds for a choice on a Bead: every position its geometry has. */
export function starterBeadCount(starter: Starter, choice: StarterChoice, bead: Bead): number {
  const size = starterFrameSize(starter, choice, bead)
  return frameGeometry({ shape: starter.shape, settings: customSettings(starter, choice), ...size, technique: starter.technique }).positions().length
}

/** What a Starter's setup measures with a Bead (StarterGallery card, Setup): a Shape's or earring's width and height; a
 * Ring's inside across, its width and its rows round; a Band's width, its length and its rows. */
export type StarterMeasure =
  | { shape: 'frame'; widthMm: number; heightMm: number }
  | { shape: 'ring'; insideMm: number; widthMm: number; rows: number }
  | { shape: 'band'; widthMm: number; lengthMm: number; rows: number }

/** A Starter's Frame for a choice, measured with a Bead by its measuring rule. */
export function starterMeasure(starter: Starter, choice: StarterChoice, bead: Bead): StarterMeasure {
  const { rows, columns } = starterFrameSize(starter, choice, bead)
  if (starter.measure === 'frame') {
    return { shape: 'frame', ...estimatedSizeMm({ rows, columns, shape: starter.shape, settings: customSettings(starter, choice) }, bead) }
  }
  // Lying across, the strip's length is the Frame's width on screen and its width the Frame's height.
  const { widthMm: lengthMm, heightMm: widthMm } = estimatedSizeMm({ rows, columns }, bead)
  // Where every other row shifts, each column zig-zags through two rows as a pattern counts them round (peyote).
  const round = columns * (describeWeave({ technique: starter.technique }).shifted ? 2 : 1)
  if (starter.measure === 'ring') return { shape: 'ring', insideMm: sizeIn(starter, choice.sizes, 'ringSize') / Math.PI, widthMm, rows: round }
  return { shape: 'band', widthMm, lengthMm, rows: round }
}

/** The beads a Starter puts in place: its design when asked for at its sizes and choices, else none. */
function chosenBeads(starter: Starter, choice: StarterChoice): BeadMap {
  return choice.useDesign && designFits(starter, choice) ? starterDesign(starter) : {}
}

/** Add Frame from Starter and Replace Frame (tickets 0596, 0597, 0633): the Frame change that puts the Starter's Frame
 * round a Canvas position, in place of any Frame there, in the Starter's Technique, pre-filled with its design or empty.
 * Colours stay as painted, whatever the Project's Bead; an empty Ring's or Band's length is worked out from it. */
export function placedStarter(project: Project, starter: Starter, choice: StarterChoice, centre: GridPosition): FrameChangeResult {
  const beads = chosenBeads(starter, choice)
  if (starter.shape) return changeFrame(project, { custom: { shape: starter.shape, settings: customSettings(starter, choice), centre, beads } })
  const { rows, columns } = starterFrameSize(starter, choice, resolveProjectBead(project)!)
  const frame = { row: centre.row - Math.floor(rows / 2), column: centre.column - Math.floor(columns / 2), rows, columns }
  return changeFrame(project, { place: { frame, weave: weaveOf({ technique: starter.technique }), beads } })
}

/** A new Project from a Starter (New Project's Pick a starter): its Canvas in the Starter's Technique, and its Frame
 * with its first row and column at the origin. Nothing in it records the Starter. */
export function starterProject(starter: Starter, choice: StarterChoice & { name: string; beadId: string }): Project {
  const project = createProject({ name: choice.name, technique: starter.technique, beadId: choice.beadId })
  const { rows, columns } = starterFrameSize(starter, choice, resolveProjectBead(project)!)
  const placed = placedStarter(project, starter, choice, { row: Math.floor(rows / 2), column: Math.floor(columns / 2) })
  return placed.kind === 'changed' ? placed.project : project
}

/** A Ring size in US sizes, to the nearest half, from the EU one (the inside round in mm): US size n is
 * 11.63 + 0.8128 × n mm across, as the usual conversion charts give it. */
export function usRingSize(eu: number): number {
  return Math.round(((eu / Math.PI - 11.63) / 0.8128) * 2) / 2
}

/** A US Ring size as the EU one, the inside round in mm. */
export function euRingSize(us: number): number {
  return Math.PI * (11.63 + 0.8128 * us)
}

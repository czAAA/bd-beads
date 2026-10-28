import { beadPitchMm, type Bead } from './beads'
import type { BeadMap } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { customFrameSize, frameKindOf, frameLayoutOf, FRINGE_STYLES, settingValuesOf, type FrameKindId, type FrameSettingName, type FrameSettings, type FringeStyle } from './frameKind'
import type { GridDimensions, GridPosition } from './grid'
import { createProject, resolveProjectBead, weaveOf, type Project } from './project'
import { parseProjectsFile } from './projectFile'
import { estimatedSizeMm } from './projectSize'
import { STRIP_TECHNIQUE, type Technique } from './weave'
import triangleDesign from '../data/starters/triangle.json'
import warpedSquareDesign from '../data/starters/warpedSquare.json'
import kiteDesign from '../data/starters/kite.json'
import starDesign from '../data/starters/star.json'
import kaleidocycleDesign from '../data/starters/kaleidocycle.json'
import straightFringeDesign from '../data/starters/straightFringe.json'
import vFringeDesign from '../data/starters/vFringe.json'
import ringStripesDesign from '../data/starters/ringStripes.json'
import ringChevronsDesign from '../data/starters/ringChevrons.json'
import ringDiamondsDesign from '../data/starters/ringDiamonds.json'
import ringPlaidDesign from '../data/starters/ringPlaid.json'
import bandStripesDesign from '../data/starters/bandStripes.json'
import bandChevronsDesign from '../data/starters/bandChevrons.json'
import bandDiamondsDesign from '../data/starters/bandDiamonds.json'
import bandPlaidDesign from '../data/starters/bandPlaid.json'

// The Starters (spec 0590, tickets 0596, 0597; StarterGallery card): each a design for one Frame kind at one best size,
// a Project file kept with the app in `src/data/starters/` (the JSON inside an exported `.openbeads`, so a design tweaked
// in the app replaces its file by `gunzip -c`). Its Frame's beads are the design; nothing else of the file is used.

/** The Starter gallery's categories. */
export type StarterCategoryId = 'shapes' | 'earrings' | 'rings' | 'bands'

/** A Starter by id; a Shape's is its kind's, the others name their copy (`starters.options.<id>`). */
export type StarterId = ShapeId | OptionId

/** The Shapes, each named by its kind. */
type ShapeId = 'triangle' | 'warpedSquare' | 'kite' | 'star' | 'kaleidocycle'

/** The Earrings, Rings and Bands (ticket 0597), each with a name of its own. */
export type OptionId =
  | 'straightFringe'
  | 'vFringe'
  | 'ringStripes'
  | 'ringChevrons'
  | 'ringDiamonds'
  | 'ringPlaid'
  | 'bandStripes'
  | 'bandChevrons'
  | 'bandDiamonds'
  | 'bandPlaid'

/** What a Starter's setup sizes in numbers: a Custom frame's settings, or a Ring's or Band's Width in beads and its Ring
 * size (EU: the inside round in mm) or Wrist (cm, measured snug). */
export type StarterSizeName = FrameSettingName | 'width' | 'ringSize' | 'wrist'

/** What a Starter's setup chooses: a Fringe earring's style, or how a Band fits. */
export type StarterPickName = 'fringeStyle' | 'fit'

/** How a Band sits on the wrist (StarterGallery card): the ease added to the wrist, 1, 1.5 or 2 cm. */
export type BandFit = 'snug' | 'comfortable' | 'loose'

const BAND_EASE_MM: Readonly<Record<BandFit, number>> = { snug: 10, comfortable: 15, loose: 20 }

/** The Fits, in the order they are offered. */
const BAND_FITS: readonly BandFit[] = ['snug', 'comfortable', 'loose']

/** The Bead the designs are made for and the cards are drawn and counted with (StarterGallery card): Delica 11/0. */
export const STARTER_BEAD_ID = 'miyuki/delica/11-0'

/** What a Band leaves for its clasp, in mm (StarterGallery card). */
export const BAND_CLASP_MM = 15

/** A Ring runs small once woven, so its band is this much longer than the finger's round, in mm (StarterGallery card). */
const RING_EASE_MM = 4

/** The usual US Ring sizes, offered as chips when the Size system is US. */
export const US_RING_PRESETS: readonly number[] = [5, 6, 7, 8, 9]

/** One size of a Starter: the value its design is made for, its range, and the usual values offered as chips. */
export interface StarterSize {
  name: StarterSizeName
  /** The value the design is made for: it is never cropped, scaled or repeated to another. */
  size: number
  min: number
  max: number
  presets: readonly number[]
  /** Left out of a card's caption, where it would make it too long. */
  caption?: false
}

/** One choice of a Starter: the value its design is made for, the values offered, and the size the setup shows it
 * before (a Fringe style before the Fringe length), or after them all. */
export interface StarterPick {
  name: StarterPickName
  value: string
  values: readonly string[]
  before?: StarterSizeName
}

/** A ready-made design for one Frame kind (ADR 0077): its kind, the Technique it is woven in, its sizes and choices,
 * and the design itself. A Ring or Band is a Rectangular Frame sized for the finger or the wrist. */
export interface Starter {
  id: StarterId
  category: StarterCategoryId
  kind: FrameKindId
  technique: Technique
  sizes: readonly StarterSize[]
  picks: readonly StarterPick[]
  /** The Project file the design is, as its JSON. */
  file: unknown
}

/** A category of the gallery: its Starters in the order its step shows them, and the one whose design is its picture. */
export interface StarterCategory {
  id: StarterCategoryId
  starters: readonly Starter[]
  best: Starter
}

/** A Custom frame Starter's size in one of its kind's settings: the setting's range, and the design's value and chips,
 * the kind's own default and presets unless given. */
function setting(kind: FrameKindId, name: FrameSettingName, design?: { size: number; presets: readonly number[] }, caption?: false): StarterSize {
  const { min, max, default: size, presets } = frameKindOf({ kind }).custom!.settings.find((each) => each.name === name)!
  return { name, size, min, max, presets, ...design, ...(caption === false ? { caption } : {}) }
}

/** A Shape: a Custom frame of its kind, sized in its kind's one setting. */
function shape(kind: ShapeId, size: number, presets: readonly number[], file: unknown): Starter {
  const custom = frameKindOf({ kind }).custom!
  return { id: kind, category: 'shapes', kind, technique: custom.technique, sizes: [setting(kind, custom.settings[0].name, { size, presets })], picks: [], file }
}

/** A Fringe earring (ticket 0597): its kind's top of 7 and 6 rows, its fringe sized, its Fringe style the design's. */
function earring(id: OptionId, fringeStyle: FringeStyle, fringe: { size: number; presets: readonly number[] }, file: unknown): Starter {
  const kind = 'fringeEarring'
  return {
    id,
    category: 'earrings',
    kind,
    technique: frameKindOf({ kind }).custom!.technique,
    sizes: [setting(kind, 'topWidth'), setting(kind, 'topRows', undefined, false), setting(kind, 'fringeLength', fringe)],
    picks: [{ name: 'fringeStyle', value: fringeStyle, values: FRINGE_STYLES, before: 'fringeLength' }],
    file,
  }
}

/** A Ring (ticket 0597): a peyote band of Width beads, lying across, round the finger of its Ring size. */
function ring(id: OptionId, file: unknown): Starter {
  const sizes: StarterSize[] = [
    { name: 'width', size: 7, min: 3, max: 20, presets: [5, 7, 9] },
    { name: 'ringSize', size: 54, min: 44, max: 76, presets: [50, 52, 54, 56, 58] },
  ]
  return { id, category: 'rings', kind: 'rectangular', technique: STRIP_TECHNIQUE, sizes, picks: [], file }
}

/** A Band (ticket 0597): a peyote band of Width beads, lying across, round the wrist with its Fit and the clasp. */
function band(id: OptionId, file: unknown): Starter {
  const sizes: StarterSize[] = [
    { name: 'width', size: 11, min: 3, max: 40, presets: [7, 9, 11, 13] },
    { name: 'wrist', size: 16, min: 12, max: 24, presets: [15, 16, 17, 18] },
  ]
  return { id, category: 'bands', kind: 'rectangular', technique: STRIP_TECHNIQUE, sizes, picks: [{ name: 'fit', value: 'comfortable', values: BAND_FITS }], file }
}

const SHAPES: readonly Starter[] = [
  shape('triangle', 10, [6, 8, 10, 12], triangleDesign),
  shape('warpedSquare', 8, [6, 8, 10], warpedSquareDesign),
  shape('kite', 21, [15, 21, 30], kiteDesign),
  shape('star', 5, [3, 5, 7, 9], starDesign),
  shape('kaleidocycle', 9, [9, 11, 13], kaleidocycleDesign),
]
const EARRINGS: readonly Starter[] = [
  earring('straightFringe', 'straight', { size: 10, presets: [8, 10, 12, 16] }, straightFringeDesign),
  earring('vFringe', 'v', { size: 12, presets: [8, 12, 16] }, vFringeDesign),
]
const RINGS: readonly Starter[] = [
  ring('ringStripes', ringStripesDesign),
  ring('ringChevrons', ringChevronsDesign),
  ring('ringDiamonds', ringDiamondsDesign),
  ring('ringPlaid', ringPlaidDesign),
]
const BANDS: readonly Starter[] = [
  band('bandStripes', bandStripesDesign),
  band('bandChevrons', bandChevronsDesign),
  band('bandDiamonds', bandDiamondsDesign),
  band('bandPlaid', bandPlaidDesign),
]

/** A category, its picture the design of the Starter named. */
function category(id: StarterCategoryId, starters: readonly Starter[], best: StarterId): StarterCategory {
  return { id, starters, best: starters.find((starter) => starter.id === best)! }
}

/** The registry, in the order step 1 shows the categories. */
export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  category('shapes', SHAPES, 'star'),
  category('earrings', EARRINGS, 'vFringe'),
  category('rings', RINGS, 'ringChevrons'),
  category('bands', BANDS, 'bandDiamonds'),
]

/** The Starter with this id. */
export function starterById(id: StarterId): Starter {
  return STARTER_CATEGORIES.flatMap((each) => each.starters).find((starter) => starter.id === id)!
}

/** Whether a Starter has a name of its own rather than its kind's. */
export function isOption(starter: Starter): starter is Starter & { id: OptionId } {
  return starter.category !== 'shapes'
}

/** A Starter's design: its Project file's Frame, its beads by their position in the layout or the rectangle. */
interface Design {
  beads: BeadMap
  rows: number
  columns: number
}

const designs = new Map<StarterId, Design>()

function designOf(starter: Starter): Design {
  const known = designs.get(starter.id)
  if (known) return known
  const frame = parseProjectsFile(JSON.stringify(starter.file)).projects[0]?.frame
  const design = { beads: frame?.beads ?? {}, rows: frame?.rows ?? 0, columns: frame?.columns ?? 0 }
  designs.set(starter.id, design)
  return design
}

/** A Starter's design: the beads of its Project file's Frame. Read once. */
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
  return Object.fromEntries(starter.sizes.map(({ name, size }) => [name, size]))
}

/** A Starter's choices as its design is made. */
export function designPicks(starter: Starter): StarterPicks {
  return Object.fromEntries(starter.picks.map(({ name, value }) => [name, value]))
}

/** A size the choice sets, or the design's where it sets none. */
function sizeIn(starter: Starter, sizes: StarterSizes, name: StarterSizeName): number {
  return sizes[name] ?? starter.sizes.find((each) => each.name === name)!.size
}

/** A choice the setup makes, or the design's where it makes none. */
function pickIn(starter: Starter, picks: StarterPicks | undefined, name: StarterPickName): string {
  return picks?.[name] ?? starter.picks.find((each) => each.name === name)!.value
}

/** The design's sizes and choices a setup has moved away from, in the setup's order; none when the design fits. A Ring
 * size set in US counts as the whole EU size it comes to. */
export function designDifferences(starter: Starter, { sizes, picks }: Pick<StarterChoice, 'sizes' | 'picks'>): ({ size: StarterSize } | { pick: StarterPick })[] {
  return [
    ...starter.sizes.filter(({ name, size }) => Math.round(sizeIn(starter, sizes, name)) !== size).map((size) => ({ size })),
    ...starter.picks.filter(({ name, value }) => pickIn(starter, picks, name) !== value).map((pick) => ({ pick })),
  ]
}

/** Whether a choice's sizes and choices are the design's. */
export function designFits(starter: Starter, choice: Pick<StarterChoice, 'sizes' | 'picks'>): boolean {
  return designDifferences(starter, choice).length === 0
}

/** The range each of a Starter's sizes may take with the others as they are: a Fringe earring's top has fewer rows than
 * its base row has beads. */
export function starterSizeRanges(starter: Starter, sizes: StarterSizes): Partial<Record<StarterSizeName, { min: number; max: number }>> {
  const custom = new Map(settingValuesOf({ kind: starter.kind, settings: customSettings(starter, { sizes }) }).map((each) => [each.name as StarterSizeName, each]))
  return Object.fromEntries(starter.sizes.map(({ name, min, max }) => [name, { min, max: custom.get(name)?.max ?? max }]))
}

/** A Ring's or Band's length round the finger or wrist, in mm: the Ring size and its ease, or the wrist with its Fit's
 * ease, less the clasp. */
function lengthMm(starter: Starter, { sizes, picks }: Pick<StarterChoice, 'sizes' | 'picks'>): number {
  if (starter.category === 'rings') return sizeIn(starter, sizes, 'ringSize') + RING_EASE_MM
  return sizeIn(starter, sizes, 'wrist') * 10 + BAND_EASE_MM[BAND_FITS.find((fit) => fit === pickIn(starter, picks, 'fit')) ?? 'comfortable'] - BAND_CLASP_MM
}

/** A Custom frame Starter's settings for a choice: its sizes and choices in its kind's settings. */
function customSettings(starter: Starter, { sizes, picks }: Pick<StarterChoice, 'sizes' | 'picks'>): FrameSettings {
  const numbers = Object.fromEntries(starter.sizes.map(({ name }) => [name, sizeIn(starter, sizes, name)]))
  return { ...numbers, ...Object.fromEntries(starter.picks.map(({ name }) => [name, pickIn(starter, picks, name)])) }
}

/** The rows and columns of a Starter's Frame for a choice on a Bead: a Custom frame's bounding rectangle; for a Ring or
 * Band lying across, its Width in rows and its length in columns of the Bead's pitch (two peyote rows a column), the
 * design's own rectangle when it is put in place. */
export function starterFrameSize(starter: Starter, choice: StarterChoice, bead: Bead): GridDimensions {
  if (frameKindOf(starter).custom) return customFrameSize(starter.kind, customSettings(starter, choice))
  if (choice.useDesign && designFits(starter, choice)) return { rows: designOf(starter).rows, columns: designOf(starter).columns }
  return { rows: sizeIn(starter, choice.sizes, 'width'), columns: Math.max(1, Math.round(lengthMm(starter, choice) / beadPitchMm(bead))) }
}

/** How many beads a Starter's Frame holds for a choice on a Bead: every position of its layout or rectangle. */
export function starterBeadCount(starter: Starter, choice: StarterChoice, bead: Bead): number {
  const layout = frameLayoutOf({ kind: starter.kind, settings: customSettings(starter, choice) })
  if (layout) return layout.positions.length
  const { rows, columns } = starterFrameSize(starter, choice, bead)
  return rows * columns
}

/** What a Starter's setup measures with a Bead (StarterGallery card, Setup): a Shape's or earring's width and height; a
 * Ring's inside across, its width and its peyote rows round; a Band's width, its length and its rows. */
export type StarterMeasure =
  | { shape: 'frame'; widthMm: number; heightMm: number }
  | { shape: 'ring'; insideMm: number; widthMm: number; rows: number }
  | { shape: 'band'; widthMm: number; lengthMm: number; rows: number }

/** A Starter's Frame for a choice, measured with a Bead. */
export function starterMeasure(starter: Starter, choice: StarterChoice, bead: Bead): StarterMeasure {
  const { rows, columns } = starterFrameSize(starter, choice, bead)
  if (frameKindOf(starter).custom) {
    const settings = customSettings(starter, choice)
    return { shape: 'frame', ...estimatedSizeMm({ rows, columns, technique: starter.technique, kind: starter.kind, settings }, bead) }
  }
  // Lying across, the strip's length is the Frame's width on screen and its width the Frame's height.
  const { widthMm: lengthMm, heightMm: widthMm } = estimatedSizeMm({ rows, columns, technique: starter.technique }, bead)
  // A peyote column is two rows, as a pattern counts them round the band.
  if (starter.category === 'rings') return { shape: 'ring', insideMm: sizeIn(starter, choice.sizes, 'ringSize') / Math.PI, widthMm, rows: 2 * columns }
  return { shape: 'band', widthMm, lengthMm, rows: 2 * columns }
}

/** The beads a Starter puts in place: its design when asked for at its sizes and choices, else none. */
function chosenBeads(starter: Starter, choice: StarterChoice): BeadMap {
  return choice.useDesign && designFits(starter, choice) ? starterDesign(starter) : {}
}

/** Add Frame from Starter and Replace Frame (tickets 0596, 0597): the Starter's Frame round a Canvas position, in place
 * of any Frame there, in the Starter's Technique, pre-filled with its design or empty. Colours stay as painted, whatever
 * the Project's Bead; an empty Ring's or Band's length is worked out from it. */
export function placedStarter(project: Project, starter: Starter, choice: StarterChoice, centre: GridPosition): FrameChangeResult {
  const beads = chosenBeads(starter, choice)
  if (frameKindOf(starter).custom) return changeFrame(project, { custom: { kind: starter.kind, settings: customSettings(starter, choice), centre, beads } })
  const { rows, columns } = starterFrameSize(starter, choice, resolveProjectBead(project)!)
  const frame = { row: centre.row - Math.floor(rows / 2), column: centre.column - Math.floor(columns / 2), rows, columns }
  const placed = changeFrame(project, { place: { frame, weave: weaveOf({ technique: starter.technique }) } })
  return placed.kind === 'changed' ? { kind: 'changed', project: { ...placed.project, frame: { ...placed.project.frame!, beads } } } : placed
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

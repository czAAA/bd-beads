import { findBead, type Bead } from './beads'
import { forEachBead, type BeadMap } from './canvas'
import { changeFrame, type FrameChange, type FrameChangeResult } from './changeFrame'
import { laidSize } from './frameOrientation'
import { changedSettings, customFrameSize, followsWeave, frameGeometry, frameLayoutOf, frameShapeOf, settingsOf, settingValuesOf, type FrameShapeId, type FrameSettingName, type FrameSettings, type QuarterTurns } from './frameShape'
import type { GridDimensions, GridPosition } from './grid'
import { createProject } from './createProject'
import { resolveProjectBead, withWovenPalette } from './projectBead'
import { sameWeave, weaveOf } from './layerWeave'
import { quarterTurnOf, withBackground, withCanvas, withLayer } from './layerRecord'
import type { Background, Project } from './project'
import { decodeBeads, type EncodedBeads } from './projectEncoding'
import { estimatedSizeMm } from './projectSize'
import { backBeadsAt } from './pieceFaces'
import type { SettingSpec } from './settingSpec'
import { beadCell, describeWeave, withCell, type Weave } from './weave'
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
 * settings, `ring` and `band` as a strip woven across its width (ticket 0832), shown lying across, as long as the
 * finger's round or the wrist with its Fit. */
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

/** A Starter's manifest (ticket 0633), the file `<id>.starter.json` beside its design: its Frame shape, its Frame's
 * Weave, its sizes and choices, how it is measured, and whether it is made as a pair (an earring).
 * @internal The registry test reads every manifest file as one, to find any no category lists. */
export interface StarterManifest {
  id: StarterId
  /** Its design's file name, beside it: the design's Frame size and beads (StoredDesign). */
  design: string
  /** Its Frame shape: a Shape's or an earring's; none for a Ring or Band, a Frame without one. */
  shape?: FrameShapeId
  /** Its Frame's Weave (ADR 0079): its only Technique, one its Frame shape supports, and that Technique's settings. */
  weave: Weave
  measure: StarterMeasureRule
  pair?: true
  sizes: readonly ManifestSize[]
  picks: readonly StarterPick[]
}

/** A Starter's design as its file stores it (ticket 0636): its Frame's rows and columns, and its beads in the compact
 * encoding a Project file uses (ADR 0009), by their position in the layout or the rectangle. A Ring's or Band's is
 * drawn as peyote weaves it (ticket 0832): its length in rows, its Width in columns. */
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
  /** The Frame's Weave as the setup sets it (ticket 0671); the Starter's own where none is given. */
  weave?: Weave
}

/** The rest of the Frame's Layer settings a Starter's setup sets (ADR 0079, ticket 0671): its Bead and Background.
 * Left out, a Frame keeps what it would have had: a new one the Canvas's, one replaced its own. */
export interface StarterLayerSettings {
  beadId: string
  background: Background
}

/** What a Starter's setup asks on New Project (ticket 0671): its choice, the Frame's Layer settings and a name. */
export type StarterProjectChoice = StarterChoice & StarterLayerSettings & { name: string }

/** The Weave a choice weaves a Starter's Frame in: the setup's, or else the Starter's own. */
function weaveIn(starter: Starter, choice: Pick<StarterChoice, 'weave'>): Weave {
  return weaveOf(choice.weave ?? starter.weave)
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

/** What a setup has moved off its Starter's design: a size, a choice, or a Custom frame's Weave, whose layout the design's
 * beads are named by (a Fringe earring's top, ticket 0814). */
export type DesignDifference = { size: StarterSize } | { pick: StarterPick } | { weave: Weave }

/** The design's Weave, sizes and choices a setup has moved away from, in the setup's order; none when the design fits.
 * A Ring size set in US counts as the whole EU size it comes to. */
export function designDifferences(starter: Starter, { sizes, picks, weave }: Pick<StarterChoice, 'sizes' | 'picks' | 'weave'>): DesignDifference[] {
  const rewoven = starter.measure === 'frame' && weave !== undefined && !sameWeave(weaveOf(weave), weaveOf(starter.weave))
  return [
    ...(rewoven ? [{ weave: starter.weave }] : []),
    ...starter.sizes.filter((size) => Math.round(sizeIn(starter, sizes, size.id)) !== size.default).map((size) => ({ size })),
    ...starter.picks.filter((pick) => pickIn(starter, picks, pick.id) !== pick.default).map((pick) => ({ pick })),
  ]
}

/** Whether a choice's sizes and choices are the design's. */
export function designFits(starter: Starter, choice: Pick<StarterChoice, 'sizes' | 'picks' | 'weave'>): boolean {
  return designDifferences(starter, choice).length === 0
}

/** The range each of a Starter's sizes may take with the others as they are: on a Fringe earring, Top rows up to the
 * highest its brick body keeps (ticket 0814). */
export function starterSizeRanges(starter: Starter, sizes: StarterSizes, weave: Weave = starter.weave): Partial<Record<StarterSizeName, { min: number; max: number }>> {
  const custom = new Map(settingValuesOf({ shape: starter.shape, settings: customSettings(starter, { sizes }), ...weave }).map((each) => [each.name as StarterSizeName, each]))
  return Object.fromEntries(starter.sizes.map(({ id, min, max }) => [id, { min, max: custom.get(id)?.max ?? max }]))
}

/** A Starter's sizes with one set from its stepper or a chip (ticket 0814): within its range, and on a Custom frame
 * Starter kept together as a change of its Frame shape's settings keeps them (a Fringe earring's body steps two rows,
 * a Width keeps it as tall, and a V fringe's length moves with it, ticket 0816, as the choices `picks` have it). */
export function sizesWith(starter: Starter, sizes: StarterSizes, id: StarterSizeName, value: number, weave: Weave = starter.weave, picks?: StarterPicks): StarterSizes {
  const { min, max } = starterSizeRanges(starter, sizes, weave)[id]!
  const set = { ...sizes, [id]: Math.min(max, Math.max(min, Math.round(value))) }
  if (starter.measure !== 'frame') return set
  const changed = changedSettings({ shape: starter.shape, settings: customSettings(starter, { sizes, picks }), ...weave }, { [id]: set[id] })
  return Object.fromEntries(starter.sizes.map((size) => [size.id, changed[size.id as FrameSettingName] ?? set[size.id]]))
}

/** A Custom frame Starter's sizes as its layout keeps them in a Weave (ticket 0814): a peyote Width an odd number of
 * blocks, the one below an even one; a Ring's or Band's as they are. */
export function sizesIn(starter: Starter, sizes: StarterSizes, weave: Weave): StarterSizes {
  if (starter.measure !== 'frame') return sizes
  const kept = settingsOf({ shape: starter.shape, settings: customSettings(starter, { sizes }), ...weave })!
  return Object.fromEntries(starter.sizes.map((size) => [size.id, kept[size.id as FrameSettingName] ?? sizeIn(starter, sizes, size.id)]))
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

/** Whether a strip's length runs down a Weave's rows (ticket 0832). A strip is woven across its width, the thread from
 * edge to edge, so its length runs across the thread: down the rows in peyote and on a loom, whose Canvas is turned a
 * quarter to show it lying across, and along the rows in brick stitch, peyote turned a quarter. */
function runsDown(weave: Weave): boolean {
  return describeWeave(weave).threadDirection === 'leftToRight'
}

/** The quarter turn a strip in a Weave lies across at, in degrees clockwise: what a new Project's Canvas starts at. */
function lyingTurn(weave: Weave): number {
  return runsDown(weave) ? 90 : 0
}

/** The quarter turn a Starter's Frame is seen at, in degrees clockwise: a strip lying across, a shape laid by its size
 * and Bead alone upright, as it is charted (ticket 0872); none for a Fringe earring, laid in its Weave's own lines, which
 * stands as the Canvas shows that Weave. */
function seenTurn(starter: Starter, weave: Weave): number | undefined {
  if (!starter.shape) return lyingTurn(weave)
  return followsWeave(starter) ? undefined : 0
}

/** A Starter's Frame rows and columns for a choice on a Bead: a Custom frame's rectangle; a Ring or Band its length in
 * beads on their sides (the design's own when put in place) and its Width, as its Weave works a strip (`runsDown`).
 * @internal Its test checks each Starter's size on its own. */
export function starterFrameSize(starter: Starter, choice: StarterChoice, bead: Bead): GridDimensions {
  const weave = weaveIn(starter, choice)
  if (starter.measure === 'frame') return customFrameSize(starter.shape!, customSettings(starter, choice), undefined, weave, beadCell(bead, weave.technique))
  const step = describeWeave(weave).stepMm(bead)
  const worked = Math.max(1, Math.round(STRIP_LENGTH_MM[starter.measure](starter, choice) / (runsDown(weave) ? step.down : step.across)))
  const length = choice.useDesign && designFits(starter, choice) ? designOf(starter).rows : worked
  const width = sizeIn(starter, choice.sizes, 'width')
  return runsDown(weave) ? { rows: length, columns: width } : { rows: width, columns: length }
}

/** How many beads a Starter's Frame holds for a choice on a Bead: every position its geometry has, a Star's front and
 * back (ticket 0875). */
export function starterBeadCount(starter: Starter, choice: StarterChoice, bead: Bead): number {
  const size = starterFrameSize(starter, choice, bead)
  const positions = frameGeometry({ shape: starter.shape, settings: customSettings(starter, choice), ...size, ...withCell(weaveIn(starter, choice), beadCell(bead, weaveIn(starter, choice).technique)) }).positions()
  const back = starterBack(starter, choice)
  return back ? positions.reduce((sum, position) => sum + back(position), 0) : positions.length
}

/** How a Starter's Frame counts its back, where its back mirrors its face (ticket 0875, a Star): see `backBeadsAt`. */
function starterBack(starter: Starter, choice: StarterChoice): ReturnType<typeof backBeadsAt> {
  return starter.shape ? backBeadsAt(frameLayoutOf({ shape: starter.shape, settings: customSettings(starter, choice) })) : undefined
}

/** Whether a Starter's bead count is its piece's front and back (ticket 0875): a Star's back mirrors its face. */
export function starterCountsBack(starter: Starter, choice: StarterChoice): boolean {
  return starterBack(starter, choice) !== undefined
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
  const { technique } = weaveIn(starter, choice)
  if (starter.measure === 'frame') {
    return { shape: 'frame', ...estimatedSizeMm({ rows, columns, shape: starter.shape, settings: customSettings(starter, choice) }, bead, technique) }
  }
  const size = estimatedSizeMm({ rows, columns }, bead, technique)
  const down = runsDown(weaveIn(starter, choice))
  const [lengthMm, widthMm] = down ? [size.heightMm, size.widthMm] : [size.widthMm, size.heightMm]
  // Where every other line shifts, a round zig-zags through two lines as a pattern counts it.
  const round = (down ? rows : columns) * (describeWeave(weaveIn(starter, choice)).shifted ? 2 : 1)
  if (starter.measure === 'ring') return { shape: 'ring', insideMm: sizeIn(starter, choice.sizes, 'ringSize') / Math.PI, widthMm, rows: round }
  return { shape: 'band', widthMm, lengthMm, rows: round }
}

const designsAlongRows = new Map<StarterId, BeadMap>()

/** A strip's design laid along a Weave's rows (brick stitch, ticket 0832): its rows the columns, which is the design
 * lying across seen in a mirror. The mirror keeps the stagger in register: peyote's odd lines, turned, sit half a
 * bead left, brick's half a bead right. Made once. */
function designAlongRows(starter: Starter): BeadMap {
  const known = designsAlongRows.get(starter.id)
  if (known) return known
  const { beads } = designOf(starter)
  const along: BeadMap = {}
  forEachBead(beads, (row, column, color) => ((along[column] ??= {})[row] = color))
  designsAlongRows.set(starter.id, along)
  return along
}

/** The beads a Starter puts in place: its design when asked for at its sizes and choices, else none. */
function chosenBeads(starter: Starter, choice: StarterChoice): BeadMap {
  if (!choice.useDesign || !designFits(starter, choice)) return {}
  return starter.measure === 'frame' || runsDown(weaveIn(starter, choice)) ? starterDesign(starter) : designAlongRows(starter)
}

/** Add Frame from Starter and Replace Frame (tickets 0596, 0633, 0671): the Starter's Frame round a Canvas position, in
 * place of any Frame, in the setup's Layer settings (ADR 0079), with its design or empty, colours as painted; the Canvas
 * as it is, the Frame turned by what it lacks, so a Ring or Band lies across (0832) and a shape stands as charted (0872). */
export function placedStarter(project: Project, starter: Starter, choice: StarterChoice & Partial<StarterLayerSettings>, centre: GridPosition): FrameChangeResult {
  const bead = choice.beadId === undefined ? undefined : findBead(choice.beadId)
  const placement = starterPlacement(project, starter, choice, centre, bead ?? resolveProjectBead(project)!)
  const placed = changeFrame(project, placement)
  if (placed.kind !== 'changed' || (!bead && choice.background === undefined)) return placed
  // Laid again once it has its Bead, a replaced Frame keeping it, so it lies round the centre at that Bead's size.
  const dressed = withLayer(placed.project, 'frame', { bead })
  const relaid = changeFrame(choice.background === undefined ? dressed : withBackground(dressed, 'frame', choice.background), placement)
  return relaid.kind === 'changed' ? { kind: 'changed', project: withWovenPalette(project, relaid.project) } : relaid
}

/** The Frame change that puts a Starter's Frame in place round a Canvas position, a Ring's or Band's length in `bead`
 * and its turn the quarters from the Canvas's own to the one it is seen at (`seenTurn`). */
function starterPlacement(project: Project, starter: Starter, choice: StarterChoice, centre: GridPosition, bead: Bead): FrameChange {
  const beads = chosenBeads(starter, choice)
  const weave = weaveIn(starter, choice)
  const seen = seenTurn(starter, weave)
  const quarterTurns = seen === undefined ? 0 : ((((seen - quarterTurnOf(project)) / 90 + 4) % 4) as QuarterTurns | 0)
  const turned = quarterTurns ? { quarterTurns } : {}
  if (starter.shape) return { custom: { shape: starter.shape, settings: customSettings(starter, choice), centre, beads, weave, ...turned } }
  const { rows, columns } = starterFrameSize(starter, choice, bead)
  const laid = laidSize({ rows, columns, ...turned, ...withCell(weave, beadCell(bead, weave.technique)) })
  const frame = { row: centre.row - Math.floor(laid.rows / 2), column: centre.column - Math.floor(laid.columns / 2), rows, columns }
  return { place: { frame, weave, beads, ...turned } }
}

/** A new Project from a Starter (New Project's Pick a starter): its Frame as the setup sets it, with its first row and
 * column at the origin, and its Canvas a copy of the Frame's Layer settings (ADR 0079), turned so a Ring or Band lies
 * across (ticket 0832) and a shape stands as charted (ticket 0872). Nothing in it records the Starter. */
export function starterProject(starter: Starter, choice: StarterChoice & Pick<StarterProjectChoice, 'name' | 'beadId'> & Partial<StarterLayerSettings>): Project {
  const { name, beadId, background } = choice
  const made = createProject({ name, ...weaveIn(starter, choice), beadId, ...(background !== undefined ? { background } : {}) })
  const seen = seenTurn(starter, weaveIn(starter, choice))
  const project = seen === undefined ? made : withCanvas(made, { orientation: seen })
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

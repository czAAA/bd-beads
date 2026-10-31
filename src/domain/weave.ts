import { threadMeasures, type Bead, type BeadMeasures } from './beads'
import type { Rect } from './canvas'
import type { GridPosition } from './grid'
import { columnsGeometry } from './columnsGeometry'
import { rowsGeometry } from './rowsGeometry'
import { settingValue, type SettingSpec } from './settingSpec'
import type { CellCenter, GeometryNumber, GeometryRef, GeometryStrategy, WeaveGeometry } from './weaveGeometry'

/** The weaving method, which determines a Project's grid geometry: a key of the config map below. */
export type Technique = keyof typeof TECHNIQUE_RULES

/** One line to a block of lines: every other line shifts, as ordinary peyote's and brick stitch's do. */
const ONE_LINE_BLOCK = 1
/** The most beads a Drop may pick up in one stitch, so the most lines level beside each other (tickets 477, 0691). */
const MAX_DROP = 20
/** One more than the longest cycle a stagger repeats after (2 × MAX_DROP). */
const MAX_CYCLE = 2 * MAX_DROP + 1

/** A Technique's setting (ticket 0627): the shape every setting has, and the number of its Technique's geometry it sets
 * in place of the entry's own, where it changes the layout. */
interface TechniqueSetting<Sets extends string = GeometryNumber> extends SettingSpec {
  sets?: Sets
}

/** A Drop (ticket 0691): the beads each stitch picks up, so the lines' block, 1, every other line, up to MAX_DROP; the
 * same cells, so a change loses no bead. Each Technique that has one keeps its own, under its own id and words. */
function dropSetting<Id extends string>(id: Id): TechniqueSetting<'block'> & { id: Id } {
  return { id, labelKey: id, min: ONE_LINE_BLOCK, max: MAX_DROP, step: 1, default: ONE_LINE_BLOCK, sets: 'block' }
}

/** Peyote's Drop (ticket 0691): 2-drop, 3-drop and on; 1 is ordinary peyote. */
const PEYOTE_DROP_SETTING = dropSetting('peyoteDrop')

/** Brick stitch's Drop, called its Brick block before ticket 0691 (ticket 0624); 1 is ordinary brick stitch. */
export const BRICK_DROP_SETTING = dropSetting('brickDrop')

/** A layer's Technique settings by id (ticket 0624): each its Technique describes, and any kept off it (brick stitch's
 * Drop on peyote, for a switch back). */
export type TechniqueSettings = Readonly<Record<string, number>>

/** The settings of a Technique that describes none, shared: a Weave's description is asked for per bead. */
const NO_SETTINGS: TechniqueSettings = Object.freeze({})

/** What decides how a Project is laid out: the Technique and its settings, such as peyote's or brick stitch's Drop
 * (tickets 477, 0691). A Project is one, and so is its Frame. */
export interface Weave {
  technique: Technique
  /** Its settings by id (tickets 0624, 0625, 0627); a setting left out is its default. */
  techniqueSettings?: TechniqueSettings
  /** How the layer's Bead is drawn (ADR 0068, ticket 0724); absent is the Technique's own cell. Never stored with a
   * layer: the layer's Bead decides it (`beadCell`). */
  cell?: BeadCell
}

/** A Bead's cell as laid on its Technique's Grid (ticket 0734): its height over its width, and how much of the cell's
 * width its corners are rounded by, from the Bead's Form factor. */
export interface BeadCell {
  aspect: number
  roundness: number
}

/** Which way the thread runs through the beads on a Technique's Grid (ticket 0734): fixed by the Technique, never a
 * setting. Each bead is laid with its hole along it. */
type ThreadDirection = 'leftToRight' | 'topToBottom'

/** A Technique's own facts: its geometry kind with its values (ADR 0078), and what it offers and costs. */
interface TechniqueRules<G extends GeometryRef = GeometryRef> {
  /** Its name's key in the `techniques` translations: a plain string, checked in every language by a test (ADR 0078). */
  nameKey: string
  /** Which way its thread runs: left to right on loom and peyote, top to bottom on brick stitch. */
  threadDirection: ThreadDirection
  /** How its beads are laid out: a kind of geometry and the values that kind reads. */
  geometry: G
  /** Its settings (ticket 0624), in the order they are offered: the Weave holds their values in `techniqueSettings`, and
   * one that sets a number of its geometry sets one of this geometry's own. */
  settings: readonly TechniqueSetting<GeometryNumber<G>>[]
  /** Its Word chart (ticket 0574): `marked` rows carry an (L) or (R) for the end they start from, the others all read
   * left to right. */
  wordChart: { marked: boolean }
  /** What one of its beads costs to draw on every move of a drag, in square beads: a rounded bead costs three (measured,
   * ticket 122). */
  draftCost: number
}

/** An entry's rules on whichever geometry kind it names, so a setting may set only a number that kind has. */
type CheckedRules = { [Kind in GeometryRef['kind']]: TechniqueRules<Extract<GeometryRef, { kind: Kind }>> }[GeometryRef['kind']]

const ROUNDED_BEAD_CORNER = 0.22

/** The single config map: one entry per Technique. A Technique on an existing geometry is an entry here (ADR 0078). */
const TECHNIQUE_RULES = {
  loom: {
    nameKey: 'loom',
    threadDirection: 'leftToRight',
    geometry: { kind: 'rows', shifted: false, shift: 0, cellAspect: 1, roundness: 0, passes: 'one', block: ONE_LINE_BLOCK },
    settings: [],
    wordChart: { marked: false },
    draftCost: 1,
  },
  peyote: {
    nameKey: 'peyote',
    threadDirection: 'leftToRight',
    geometry: { kind: 'columns', shift: 0.5, cellAspect: 1, roundness: ROUNDED_BEAD_CORNER, passes: 'twoAfterFirst', block: ONE_LINE_BLOCK },
    settings: [PEYOTE_DROP_SETTING],
    wordChart: { marked: true },
    draftCost: 3,
  },
  brick: {
    nameKey: 'brick',
    threadDirection: 'topToBottom',
    geometry: { kind: 'rows', shifted: true, shift: 0.5, cellAspect: 1, roundness: 0, passes: 'one', block: ONE_LINE_BLOCK },
    settings: [BRICK_DROP_SETTING],
    wordChart: { marked: true },
    draftCost: 1,
  },
} satisfies Record<string, CheckedRules>

const RULES: Record<Technique, TechniqueRules> = TECHNIQUE_RULES

/** A Bead laid on a Technique's thread (ticket 0734): its length through the hole, with the thread slack, runs the way the
 * thread does, and its diameter across; so the cell's width and height in mm. A turned bead swaps them. */
function laidMm(direction: ThreadDirection, bead: BeadMeasures): { widthMm: number; heightMm: number } {
  const { alongMm, acrossMm } = threadMeasures(bead)
  return direction === 'leftToRight' ? { widthMm: alongMm, heightMm: acrossMm } : { widthMm: acrossMm, heightMm: alongMm }
}

/** The one geometry function for a Bead's cell (ADR 0068, tickets 0724, 0734): the Bead as its Technique lays it, its
 * height over its width and its outline. No Bead (a bare Weave) leaves the Technique's own cell, so every rule below
 * reads as before. */
export function beadCell(bead: (BeadMeasures & { formFactor: Pick<Bead['formFactor'], 'roundness'> }) | undefined, technique: Technique): BeadCell | undefined {
  if (!bead) {
    return undefined
  }
  const { widthMm, heightMm } = laidMm(RULES[technique].threadDirection, bead)
  return { aspect: heightMm / widthMm, roundness: bead.formFactor.roundness }
}

/** The Weave with the Bead's cell added (none, without a Bead, leaves it as it is). */
export function withCell(weave: Weave, cell: BeadCell | undefined): Weave {
  return cell ? { ...weave, cell } : weave
}

/** Every Technique, in the order the choices are listed: the config map's own order, so a new entry is listed too. */
export const TECHNIQUES = Object.keys(TECHNIQUE_RULES) as readonly Technique[]

/** The Technique a new Project and an unframed Canvas start in: the first listed. */
export const DEFAULT_TECHNIQUE: Technique = TECHNIQUES[0]

/** What a Weave answers about the Bead it is laid with, beside its Technique's facts and its geometry's answers. */
interface BeadLaid {
  /** A Bead's cell in mm as this Technique lays it: its width across and its height down. */
  beadMm(bead: BeadMeasures): { widthMm: number; heightMm: number }
  /** The physical size, in mm, of one step across and one step down from a Bead. */
  stepMm(bead: BeadMeasures): { across: number; down: number }
}

/** Everything the app asks about how a Weave is laid out: its Technique's facts and its geometry's answers. */
export interface WeaveDescription extends Omit<TechniqueRules, 'geometry'>, WeaveGeometry, BeadLaid {}

/** The Weave's settings, each its Technique describes, read within its range from its settings map, or else its
 * default. Another Technique's (brick stitch's Drop kept off it) is left out. */
export function weaveSettings(weave: Weave): TechniqueSettings {
  const { settings } = RULES[weave.technique]
  if (settings.length === 0) {
    return NO_SETTINGS
  }
  return Object.fromEntries(settings.map((setting) => [setting.id, settingValue(setting, weave.techniqueSettings?.[setting.id])]))
}

/** Every setting a Technique describes, each once: what a layer's settings map may hold. */
const EVERY_SETTING: readonly SettingSpec[] = [...new Map(Object.values(RULES).flatMap(({ settings }) => settings.map((setting) => [setting.id, setting] as const))).values()]

/** The settings of a held map moved off their default: what a file stores of a layer's Weave (ticket 0636), as
 * heldSettings puts the defaults back on reading. */
export function settingsOffDefault(values: TechniqueSettings = NO_SETTINGS): TechniqueSettings {
  return Object.fromEntries(
    EVERY_SETTING.flatMap((setting) => {
      const value = values[setting.id]
      return value !== undefined && value !== setting.default ? [[setting.id, value]] : []
    }),
  )
}

/** The settings a layer woven in `technique` holds of `values` (ticket 0625): each the Technique describes, within its
 * range or its default, and each other one off its default, kept for a switch back (a Drop, tickets 477, 0691), left
 * out at its default as a file leaves it (`settingsOffDefault`); an id no Technique describes is dropped. */
export function heldSettings(technique: Technique, values: Readonly<Record<string, number | undefined>> = {}): TechniqueSettings {
  const described = RULES[technique].settings
  return Object.fromEntries(
    EVERY_SETTING.flatMap((setting) => {
      const value = settingValue(setting, values[setting.id])
      return described.includes(setting) || value !== setting.default ? [[setting.id, value]] : []
    }),
  )
}

/** A Technique's geometry kind and values, as its entry names them.
 * @internal The registry test checks every entry's values. */
export function techniqueGeometry(technique: Technique): GeometryRef {
  return RULES[technique].geometry
}

/** The one place a geometry is chosen (ADR 0078): by its kind, never by a Technique's name. A new geometry is one
 * module and one entry here; the compiler names a kind left out. */
const GEOMETRIES: { [Kind in GeometryRef['kind']]: GeometryStrategy<Extract<GeometryRef, { kind: Kind }>> } = {
  rows: rowsGeometry,
  columns: columnsGeometry,
}

function geometryOf(geometry: GeometryRef, cell: BeadCell | undefined): WeaveGeometry {
  return (GEOMETRIES[geometry.kind] as GeometryStrategy<GeometryRef>)(geometry, cell)
}

/** Descriptions already built, by Weave: drawing asks for one per bead, and builds it only once (ticket 0621). */
const descriptions = new Map<string, WeaveDescription>()
/** Weaves differ by Technique, setting and Bead, so few are ever asked for; past this many the cache starts over. */
const MAX_DESCRIPTIONS = 256

/** The Weave's description (ticket 481): its Technique's facts, and its geometry's answers built once for its settings. */
export function describeWeave(weave: Weave): WeaveDescription {
  const rules = RULES[weave.technique]
  const values = weaveSettings(weave)
  // Everything a geometry reads from the Weave: a Bead's cell roundness decides where a press misses a bead's corner.
  const key = `${weave.technique} ${Object.values(values).join(' ')} ${weave.cell?.aspect ?? ''} ${weave.cell?.roundness ?? ''}`
  const known = descriptions.get(key)
  if (known) {
    return known
  }
  const { geometry, ...facts } = rules
  // Each setting that sets a number of the geometry, in place of the entry's own (ADR 0078, ticket 0627).
  const set = Object.fromEntries(rules.settings.flatMap(({ id, sets }) => (sets ? [[sets, values[id]]] : [])))
  const built = geometryOf({ ...geometry, ...set } as GeometryRef, weave.cell)
  const beadMm = (bead: BeadMeasures) => laidMm(rules.threadDirection, bead)
  const stepMm = (bead: BeadMeasures) => {
    const { widthMm, heightMm } = beadMm(bead)
    return { across: widthMm, down: heightMm }
  }
  const description: WeaveDescription = { ...facts, ...built, beadMm, stepMm }
  if (descriptions.size >= MAX_DESCRIPTIONS) {
    descriptions.clear()
  }
  descriptions.set(key, description)
  return description
}

const techniqueDescriptions = new Map<Technique, WeaveDescription>()

/** A Technique's own description, with no settings or Bead: what its facts and row values are read from, per bead. */
function describeTechnique(technique: Technique): WeaveDescription {
  let known = techniqueDescriptions.get(technique)
  if (!known) {
    known = describeWeave({ technique })
    techniqueDescriptions.set(technique, known)
  }
  return known
}

/** After how many rows the stagger repeats: 1 where rows stand straight (loom, and peyote, whose columns are staggered
 * instead), 2N for brick stitch with a Drop of N. A Frame's top edge, starts and moves go by multiples of it. */
export function rowCycle(weave: Weave): number {
  return describeWeave(weave).rowCycle
}

/** After how many columns the stagger repeats (ticket 0734): 2N for peyote with a Drop of N, 1 for loom and brick stitch.
 * A Frame's left edge, starts and moves go by multiples of it. */
export function columnCycle(weave: Weave): number {
  return describeWeave(weave).columnCycle
}

/** A number the same for Weaves whose beads touch alike (tickets 0691, 0734): the stagger's cycle along rows and along
 * columns, which brick stitch and peyote with the same Drop do not share. What a cache of Pieces is keyed by. */
export function touchKey(weave: Weave): number {
  const { rowCycle: rows, columnCycle: columns } = describeWeave(weave)
  return rows * MAX_CYCLE + columns
}

/** A Technique's name key in the `techniques` translations. */
export function techniqueNameKey(technique: Technique): string {
  return RULES[technique].nameKey
}

/** What one of the Technique's beads costs to draw on every move of a drag, in square beads. */
export function draftCost(technique: Technique): number {
  return RULES[technique].draftCost
}

/** Whether the Technique is one of these. */
export function isTechnique(value: unknown): value is Technique {
  return TECHNIQUES.includes(value as Technique)
}

/** How much of a bead's width its corners are rounded by, per Technique. The one place the look is decided: the
 * Surface view's hit test and the overlay read it too. */
export function beadRoundness(technique: Technique, cell?: BeadCell): number {
  return cell ? cell.roundness : describeTechnique(technique).roundness
}

// Physical and px geometry both come from the grid units of the Weave's geometry, scaled by the cell size asked for.

/** Horizontal offset for a row's cells: only brick stitch's rows shift, every other one (or block of N) by half a bead,
 * so beads interlock instead of stacking in a straight grid.
 * @internal Tests check a Technique's shift on its own. */
export function rowOffset(weave: Weave, rowIndex: number, cellSize: number): number {
  return describeWeave(weave).rowOffset(rowIndex, cellSize)
}

/** Vertical offset for a column's cells (ticket 0734): only peyote's columns shift, every other one (or block of N) by half
 * a bead.
 * @internal Tests check a Technique's shift on its own. */
export function columnOffset(weave: Weave, columnIndex: number, cellSize: number): number {
  return describeWeave(weave).columnOffset(columnIndex, cellSize)
}

/** How far one step across and one step down go in a Weave, in the Weave's cell widths: what converts a distance counted
 * in one Weave's positions into another's (a Frame in a Technique other than the Canvas's, ticket 492). */
export function positionStep(weave: Weave): { across: number; down: number } {
  return { across: 1, down: describeWeave(weave).cellAspect }
}

/** Where a cell's centre sits from the grid's top-left, in the unit of the cell size passed (real mm for a Bead's
 * footprint, ticket 58, ADR 0010), using the Technique's real shift and row pitch.
 * @internal Tests check where a Technique puts a cell on its own. */
export function cellCenter(weave: Weave, position: GridPosition, cellWidth: number, cellHeight: number): CellCenter {
  return describeWeave(weave).center(position, cellWidth, cellHeight)
}

/** The cells adjacent to (row, column) for the Weave's geometry, so Fill respects real adjacency (ticket 06). Only
 * positions inside `bounds` come back; with no bounds the canvas is open. */
export function neighborsOf(weave: Weave, bounds: Rect | undefined, position: GridPosition): GridPosition[] {
  return describeWeave(weave).neighbors(bounds, position)
}

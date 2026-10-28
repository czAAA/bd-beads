import { beadPitchMm, type Bead } from './beads'
import type { Rect } from './canvas'
import type { GridPosition } from './grid'
import { netGeometry } from './netGeometry'
import { rightAngleGeometry } from './rightAngleGeometry'
import { rowsGeometry } from './rowsGeometry'
import { settingValue, type SettingSpec } from './settingSpec'
import type { CellCenter, GeometryNumber, GeometryRef, WeaveGeometry } from './weaveGeometry'

/** The weaving method, which determines a Project's grid geometry: a key of the config map below. */
export type Technique = keyof typeof TECHNIQUE_RULES

/** One row to a block of rows: every other row shifts, as peyote's and an unblocked brick stitch's do. */
const ONE_ROW_BLOCK = 1
/** The most rows a Brick block may hold straight on top of each other (ticket 477). */
const MAX_BRICK_BLOCK = 20

/** The beads in one Netting loop, odd (ticket 485): the middle one is shared with the next row. */
const MIN_NET_SIZE = 3
/** The most beads in a Netting loop. */
const MAX_NET_SIZE = 9
/** The Net size a new Netting Project starts with. */
const DEFAULT_NET_SIZE = 3

/** A Technique's setting (ticket 0627): the shape every setting has, and the number of its Technique's geometry it sets
 * in place of the entry's own, where it changes the layout. */
interface TechniqueSetting<Sets extends string = GeometryNumber> extends SettingSpec {
  sets?: Sets
}

/** Brick stitch's Brick block, as its entry describes it (ticket 0624): the rows' block, 1, every other row, up to
 * MAX_BRICK_BLOCK; the same cells, so a change loses no bead. */
export const BRICK_BLOCK_SETTING: TechniqueSetting<'block'> = { id: 'brickBlock', labelKey: 'brickBlock', min: ONE_ROW_BLOCK, max: MAX_BRICK_BLOCK, step: 1, default: ONE_ROW_BLOCK, keptOffTechnique: true, sets: 'block' }

/** Netting's Net size, as its entry describes it (ticket 0624): the beads in a loop of its mesh, odd, from 3 to 9. A
 * change moves the holes, so it asks before beads are lost (ADR 0038). */
export const NET_SIZE_SETTING: TechniqueSetting<'loopBeads'> = { id: 'netSize', labelKey: 'netSize', min: MIN_NET_SIZE, max: MAX_NET_SIZE, step: 2, default: DEFAULT_NET_SIZE, lossOnChange: true, sets: 'loopBeads' }

/** A layer's Technique settings by id (ticket 0624): each its Technique describes, and any kept off it (a Brick block). */
export type TechniqueSettings = Readonly<Record<string, number>>

/** The settings of a Technique that describes none, shared: a Weave's description is asked for per bead. */
const NO_SETTINGS: TechniqueSettings = Object.freeze({})

/** What decides how a Project is laid out: the Technique and its settings, such as brick stitch's Brick block (ticket
 * 477) and Netting's Net size (ticket 485). A Project is one, and so is its Frame. */
export interface Weave {
  technique: Technique
  /** Its settings by id (tickets 0624, 0625, 0627); a setting left out is its default. */
  techniqueSettings?: TechniqueSettings
  /** How the Bead is drawn when the Project's Bead shape is Real (ADR 0068); absent is Symmetric. Never stored with a
   * layer: the Project's Bead and Bead shape decide it (`beadCell`). */
  cell?: BeadCell
}

/** A Real cell: the Bead's height over its pitch along the thread, and how much of the cell's width its corners are
 * rounded by, from the Bead's Form factor. */
export interface BeadCell {
  aspect: number
  roundness: number
}

/** What a Technique allows and how its sizes read, beside its layout (ticket 0622): policy, not geometry, so each is a
 * switch of its own that a Technique on any geometry sets. */
interface TechniquePolicy {
  /** Whether Remove row and Remove column work on a Frame woven in it: a line of Units isn't a Unit (ADR 0038). */
  removeLine: boolean
  /** What a Frame woven unlike the Canvas hides of it (ADR 0066, ticket 514): the Canvas rows under what it draws,
   * where both layers' Techniques measure it so, or else the rectangle it names. */
  footprint: 'covered' | 'named'
  /** The fewest a side of a typed Frame size counts, in what the size counts (beads or Units; ticket 473). */
  fewestTypedSide: number
  /** How a size in mm reads as positions and back (ADR 0026): by a Bead's own width and height per position, how rows
   * pack left out, or by the steps and extent its geometry draws. */
  measure: 'bead' | 'drawn'
  /** How its PDF chart draws a bead (ticket 0642): a cell each, with cell lines and the 5th and 10th lines between beads,
   * or each bead outlined on its own, with the 5th and 10th lines between the geometry's steps. */
  chart: 'cells' | 'outlined'
}

/** A Technique's own facts: its geometry kind with its values (ADR 0078), and what it offers and costs. */
interface TechniqueRules<G extends GeometryRef = GeometryRef> {
  /** Its name's key in the `techniques` translations: a plain string, checked in every language by a test (ADR 0078). */
  nameKey: string
  /** How its beads are laid out: a kind of geometry and the values that kind reads. */
  geometry: G
  /** Its settings (ticket 0624), in the order they are offered: the Weave holds their values in `techniqueSettings`, and
   * one that sets a number of its geometry sets one of this geometry's own. */
  settings: readonly TechniqueSetting<GeometryNumber<G>>[]
  /** Whether Rotate and Rotate Frame are offered. */
  quarterTurn: boolean
  /** Whether Turn row direction is offered. */
  rowDirection: boolean
  /** Its Word chart (ticket 0574), absent where it has none: `marked` rows carry an (L) or (R) for the end they start from,
   * the others all read left to right. */
  wordChart?: { marked: boolean }
  /** What one of its beads costs to draw on every move of a drag, in square beads: a rounded bead costs three (measured,
   * ticket 122). */
  draftCost: number
  /** From how many cells of a Frame's own grid (not the margin) framing a picture in it may be slow to update (ticket 61). */
  slowFramingCells: number
  /** What it allows and how its sizes read: switches, never read off its geometry kind. */
  policy: TechniquePolicy
}

/** An entry's rules on whichever geometry kind it names, so a setting may set only a number that kind has. */
type CheckedRules = { [Kind in GeometryRef['kind']]: TechniqueRules<Extract<GeometryRef, { kind: Kind }>> }[GeometryRef['kind']]

const ROUNDED_BEAD_CORNER = 0.22
/** Every Technique's slow-framing limit: as many cells as the framing preview draws (imageFraming's PREVIEW_MAX_CELLS),
 * since no profiling shows Techniques differ. A Technique found slower lowers its own. */
const SLOW_FRAMING_CELLS = 12_000

/** The single config map: one entry per Technique. A Technique on an existing geometry is an entry here (ADR 0078). */
const TECHNIQUE_RULES = {
  loom: {
    nameKey: 'loom',
    geometry: { kind: 'rows', shifted: false, shift: 0, rowPitch: 1, cellAspect: 1, roundness: 0, passes: 'one', block: ONE_ROW_BLOCK },
    settings: [],
    quarterTurn: true,
    rowDirection: true,
    wordChart: { marked: false },
    draftCost: 1,
    slowFramingCells: SLOW_FRAMING_CELLS,
    policy: { removeLine: true, footprint: 'covered', fewestTypedSide: 4, measure: 'bead', chart: 'cells' },
  },
  peyote: {
    nameKey: 'peyote',
    geometry: { kind: 'rows', shifted: true, shift: 0.5, rowPitch: 0.75, cellAspect: 1, roundness: ROUNDED_BEAD_CORNER, passes: 'twoAfterFirst', block: ONE_ROW_BLOCK },
    settings: [],
    quarterTurn: true,
    rowDirection: true,
    wordChart: { marked: true },
    draftCost: 3,
    slowFramingCells: SLOW_FRAMING_CELLS,
    policy: { removeLine: true, footprint: 'covered', fewestTypedSide: 4, measure: 'bead', chart: 'cells' },
  },
  brick: {
    nameKey: 'brick',
    geometry: { kind: 'rows', shifted: true, shift: 0.5, rowPitch: 1, cellAspect: 1, roundness: 0, passes: 'one', block: ONE_ROW_BLOCK },
    settings: [BRICK_BLOCK_SETTING],
    quarterTurn: true,
    rowDirection: true,
    wordChart: { marked: true },
    draftCost: 1,
    slowFramingCells: SLOW_FRAMING_CELLS,
    policy: { removeLine: true, footprint: 'covered', fewestTypedSide: 4, measure: 'bead', chart: 'cells' },
  },
  rightAngle: {
    nameKey: 'rightAngle',
    // A bead's diameter over its length as drawn (the Bead's real ratio is in mm).
    geometry: { kind: 'rightAngleUnits', aspect: 0.7, roundness: ROUNDED_BEAD_CORNER },
    settings: [],
    quarterTurn: true,
    rowDirection: true,
    draftCost: 3,
    slowFramingCells: SLOW_FRAMING_CELLS,
    policy: { removeLine: false, footprint: 'named', fewestTypedSide: 1, measure: 'drawn', chart: 'outlined' },
  },
  netting: {
    nameKey: 'netting',
    // A strand steps three quarters of a bead across and down, so a bead on a diagonal sits a little over a bead from the next.
    geometry: { kind: 'netDiamonds', step: 0.75, cellAspect: 1, roundness: 0.5, loopBeads: DEFAULT_NET_SIZE },
    settings: [NET_SIZE_SETTING],
    quarterTurn: false,
    rowDirection: false,
    draftCost: 3,
    slowFramingCells: SLOW_FRAMING_CELLS,
    policy: { removeLine: false, footprint: 'named', fewestTypedSide: 1, measure: 'drawn', chart: 'outlined' },
  },
} satisfies Record<string, CheckedRules>

const RULES: Record<Technique, TechniqueRules> = TECHNIQUE_RULES

/** The Bead shape setting (ADR 0068): Symmetric draws a Technique's own cell, Real the Bead's. */
export type BeadShape = 'symmetric' | 'real'

/** The shape a Project, an old file or a Starter without the setting has. */
export const DEFAULT_BEAD_SHAPE: BeadShape = 'symmetric'

/** Every Bead shape, in the order the choice lists them. */
export const BEAD_SHAPES: readonly BeadShape[] = ['symmetric', 'real']

/** The one geometry function for a Bead's cell (ADR 0068): Symmetric is the Technique's own cell (undefined, so every
 * rule below reads as before), Real the Bead's height over its pitch along the thread and its outline. */
export function beadCell(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm' | 'heightMm'> & { formFactor: Pick<Bead['formFactor'], 'roundness'> } | undefined, shape: BeadShape): BeadCell | undefined {
  if (shape !== 'real' || !bead) {
    return undefined
  }
  return { aspect: bead.heightMm / beadPitchMm(bead), roundness: bead.formFactor.roundness }
}

/** The Weave with the Bead's cell added (none, in Symmetric, leaves it as it is). */
export function withCell(weave: Weave, cell: BeadCell | undefined): Weave {
  return cell ? { ...weave, cell } : weave
}

/** Every Technique, in the order the choices are listed: the config map's own order, so a new entry is listed too. */
export const TECHNIQUES = Object.keys(TECHNIQUE_RULES) as readonly Technique[]

/** The Technique a new Project and an unframed Canvas start in: the first listed. */
export const DEFAULT_TECHNIQUE: Technique = TECHNIQUES[0]

/** Everything the app asks about how a Weave is laid out: its Technique's facts and its geometry's answers. */
export interface WeaveDescription extends Omit<TechniqueRules, 'geometry'>, WeaveGeometry {}

/** The Weave's settings, each its Technique describes, read within its range from its settings map, or else its
 * default. Another Technique's (a Brick block kept off brick stitch) is left out. */
export function weaveSettings(weave: Weave): TechniqueSettings {
  const { settings } = RULES[weave.technique]
  if (settings.length === 0) {
    return NO_SETTINGS
  }
  return Object.fromEntries(settings.map((setting) => [setting.id, settingValue(setting, weave.techniqueSettings?.[setting.id])]))
}

/** Every setting a Technique describes, each once: what a layer's settings map may hold. */
const EVERY_SETTING: readonly SettingSpec[] = [...new Map(Object.values(RULES).flatMap(({ settings }) => settings.map((setting) => [setting.id, setting] as const))).values()]

/** The settings a layer woven in `technique` holds of `values` (ticket 0625): each the Technique describes, within its
 * range or its default where none is given, and each kept off it that has a value (a Brick block for a switch back,
 * ticket 477); any other (a Net size off Netting, ticket 568) is dropped. */
export function heldSettings(technique: Technique, values: Readonly<Record<string, number | undefined>> = {}): TechniqueSettings {
  const described = RULES[technique].settings
  return Object.fromEntries(
    EVERY_SETTING.flatMap((setting) => {
      const value = values[setting.id]
      return described.includes(setting) || (setting.keptOffTechnique && value !== undefined) ? [[setting.id, settingValue(setting, value)]] : []
    }),
  )
}

/** A Technique's geometry kind and values, as its entry names them.
 * @internal The registry test checks every entry's values. */
export function techniqueGeometry(technique: Technique): GeometryRef {
  return RULES[technique].geometry
}

/** The one place a geometry is chosen (ADR 0078): by its kind, never by a Technique's name. A new geometry is one
 * module and one case here; the compiler names a kind left out. */
function geometryOf(geometry: GeometryRef, cell: BeadCell | undefined): WeaveGeometry {
  switch (geometry.kind) {
    case 'rows':
      return rowsGeometry(geometry, cell)
    case 'rightAngleUnits':
      return rightAngleGeometry(geometry, cell)
    case 'netDiamonds':
      return netGeometry(geometry, cell)
    default:
      return unknownGeometry(geometry)
  }
}

function unknownGeometry(geometry: never): never {
  throw new Error(`No geometry of kind ${(geometry as { kind: string }).kind}`)
}

/** Descriptions already built, by Weave: drawing asks for one per bead, and builds it only once (ticket 0621). */
const descriptions = new Map<string, WeaveDescription>()
/** Weaves differ by Technique, setting and Bead, so few are ever asked for; past this many the cache starts over. */
const MAX_DESCRIPTIONS = 256

/** The Weave's description (ticket 481): its Technique's facts, and its geometry's answers built once for its settings. */
export function describeWeave(weave: Weave): WeaveDescription {
  const rules = RULES[weave.technique]
  const values = weaveSettings(weave)
  // Everything a geometry reads from the Weave: a Real cell's roundness decides where a press misses a bead's corner.
  const key = `${weave.technique} ${Object.values(values).join(' ')} ${weave.cell?.aspect ?? ''} ${weave.cell?.roundness ?? ''}`
  const known = descriptions.get(key)
  if (known) {
    return known
  }
  const { geometry, ...facts } = rules
  // Each setting that sets a number of the geometry, in place of the entry's own (ADR 0078, ticket 0627).
  const set = Object.fromEntries(rules.settings.flatMap(({ id, sets }) => (sets ? [[sets, values[id]]] : [])))
  const built = geometryOf({ ...geometry, ...set } as GeometryRef, weave.cell)
  const description: WeaveDescription = {
    ...facts,
    ...built,
    turned: rules.quarterTurn ? built.turned : () => undefined,
  }
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

/** After how many rows the shift repeats: 1 for loom (it never shifts), 2 for peyote, 2N for brick stitch with a Brick
 * block of N. Frame starts, edges and moves go by multiples of it. */
export function rowCycle(weave: Weave): number {
  return describeWeave(weave).frameStep
}

/** A Technique's name key in the `techniques` translations. */
export function techniqueNameKey(technique: Technique): string {
  return RULES[technique].nameKey
}

/** What one of the Technique's beads costs to draw on every move of a drag, in square beads. */
export function draftCost(technique: Technique): number {
  return RULES[technique].draftCost
}

/** From how many cells of a Frame's own grid framing a picture in the Technique may be slow to update. */
export function slowFramingCells(technique: Technique): number {
  return RULES[technique].slowFramingCells
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

/** Horizontal offset for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by their
 * shift so beads interlock instead of stacking in a straight grid.
 * @internal Tests check a Technique's shift on its own. */
export function rowOffset(weave: Weave, rowIndex: number, cellSize: number): number {
  return describeWeave(weave).rowOffset(rowIndex, cellSize)
}

/** Total grid width, including the extra half-cell an offset technique's shifted rows take up.
 * @internal Tests check a Technique's width on its own. */
export function gridWidth(technique: Technique, columns: number, cellSize: number): number {
  const { shifted, shift } = describeTechnique(technique)
  return columns * cellSize + (shifted ? cellSize * shift : 0)
}

/** Vertical distance from one row's top to the next. Peyote rows interlock, packing tighter than a full cell (the
 * real stitch's rows nest into each other); brick stitch stacks rows at full height like coursed brickwork, same as
 * loom. */
export function rowPitch(technique: Technique, cellSize: number): number {
  return cellSize * describeTechnique(technique).rowPitch
}

/** Total grid height, accounting for peyote's tighter row packing.
 * @internal Tests check a Technique's height on its own. */
export function gridHeight(technique: Technique, rows: number, cellSize: number): number {
  if (rows === 0) {
    return 0
  }
  return cellSize + (rows - 1) * rowPitch(technique, cellSize)
}

/** How far one step across and one step down go in a Weave, in beads' widths: what converts a distance counted in one
 * Weave's positions into another's (a Frame in a Technique other than the Canvas's, ticket 492). */
export function positionStep(weave: Weave): { across: number; down: number } {
  const description = describeWeave(weave)
  // A Unit's step for a bead one wide and as tall as the cell, shared out among the positions it takes.
  const unit = description.stepMm({ widthMm: 1, widthCorrectionMm: 0, heightMm: description.cellAspect })
  return { across: unit.across / description.columnsPerUnit, down: unit.down / description.rowsPerUnit }
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

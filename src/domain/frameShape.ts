import { findBead, type Bead } from './beads'
import type { FrameSheet } from './canvas'
import { fringeLayout, kaleidocycleLayout, kiteLayout, layoutPosition, roundsLayout, starLayout, turnedLayout, type FrameLayout, type FringeSettings } from './frameLayout'
import type { GridDimensions, GridPosition } from './grid'
import { gridGeometry, layoutGeometry, turnedGridGeometry, turnedGridLayout, type LayerGeometry } from './layerGeometry'
import { layoutOrder, rowsOrder, type RowOrder, type RowWay } from './rowOrder'
import type { SettingSpec } from './settingSpec'
import { beadCell, DEFAULT_TECHNIQUE, describeWeave, TECHNIQUES, withCell, type Technique, type Weave } from './weave'

/** The Frame shapes (spec 0590, ADR 0077, ADR 0079): what specialises a Frame into a Custom frame. A Triangle and a
 * Warped Square in Rounds (ticket 0592), a Star and a Kaleidocycle of such parts, a Kite in Rows from its point (ticket
 * 0593), and a Fringe earring, a brick-stitch top with strands under it (ticket 0597). A Frame without one is a Frame. */
export type FrameShapeId = 'triangle' | 'warpedSquare' | 'star' | 'kaleidocycle' | 'kite' | 'fringeEarring'

/** A Custom frame's settings in numbers: Rounds from the centre (Triangle, Warped Square), Part size, the rounds of
 * each part (Star, Kaleidocycle), Rows from its point (Kite), or a Fringe earring's Top width, Top rows and Fringe
 * length. */
export type FrameSettingName = 'rounds' | 'partSize' | 'rows' | 'topWidth' | 'topRows' | 'fringeLength'

/** How a Fringe earring's strands hang (ticket 0597): all one length, or in a V; looped comes later. */
export type FringeStyle = FringeSettings['fringeStyle']

/** The Fringe styles, in the order they are offered. */
export const FRINGE_STYLES: readonly FringeStyle[] = ['straight', 'v']

/** A Custom frame's settings as the Frame holds them: what its panel builder lays it out from. */
export type FrameSettings = Partial<Record<FrameSettingName, number>> & { fringeStyle?: FringeStyle }

/** One setting of a Frame shape, in the shape a Technique's has (ticket 0624): its words are under its id in
 * `frame.sizeSettings`, a smaller one asks before it drops beads, and one bounded by another stays below it (a Fringe
 * earring's top has fewer rows than its base has beads, so it ends on a pair: StarterGallery card). */
type FrameSetting = SettingSpec<FrameSettingName>

/** How many quarter turns clockwise a Frame lies at on the Canvas (Rotate Frame, tickets 0594, 0667, ADR 0079): a Custom
 * frame's layout, or a Frame's own grid, turned. One setting for both. */
export type QuarterTurns = 1 | 2 | 3

/** What a Custom frame's layout is built from: its Frame shape, its settings, how far it is turned, and the cell of its
 * layer's Bead, whose depth a round shape packs its beads by (ticket 0723). */
type Laid = Pick<FrameSheet, 'shape' | 'settings' | 'quarterTurns' | 'cell'>

/** A Frame as its Frame shape reads it: its shape, its settings, its turn, its size and its Weave. */
export type ShapedSheet = Laid & Pick<FrameSheet, 'rows' | 'columns'> & Weave

/** What a Frame lets the weaver do to it beyond painting and moving it: change its rectangle (the resize handles, Width
 * and Height, Remove row/column, Frame from Selection), turn it, weave it in another Technique, or select on it. */
export type FrameAction = 'resize' | 'remove-line' | 'from-selection' | 'rotate' | 'technique' | 'select'

/** A Frame's rectangle as its Frame shape measures it. */
type Measured = Laid & Pick<FrameSheet, 'rows' | 'columns' | 'technique'>

/** What every Frame answers, a Frame's own way or its Frame shape's; code asks the Frame rather than testing its shape. */
interface FrameRules {
  /** Where its beads are (ADR 0078): its Weave's rows over its own rectangle, or its shape's layout laid in it. */
  geometry(sheet: ShapedSheet): LayerGeometry
  /** Its Estimated size in mm (CONTEXT.md) on a Bead, before the view turns it: the Bead laid on its Technique's thread
   * a column wide and a row tall, or a Custom frame as big as its shape, a bead's width to a bead width of its layout
   * (tickets 0592, 0734). */
  sizeMm(frame: Measured, bead: Bead): { widthMm: number; heightMm: number }
  /** The Techniques it may be woven in: any, or those its Frame shape supports (ADR 0079). */
  techniques: readonly Technique[]
  /** How Row progress steps through the Frame, worked one way. */
  rowOrder(sheet: ShapedSheet, way: RowWay): RowOrder
  /** What it offers: everything, or on a Custom frame all but Remove row/column, which needs plain rows (ADR 0079). */
  allows: ReadonlySet<FrameAction>
}

/** A Frame shape (ADR 0079): how it answers what every Frame does, the Techniques it supports (the first the one it is
 * made in), its settings (the first the one it is sized by), a Fringe earring's styles, and its panel builder. */
export interface FrameShape extends FrameRules {
  id: FrameShapeId
  techniques: readonly [Technique, ...Technique[]]
  settings: readonly [FrameSetting, ...FrameSetting[]]
  styles?: readonly FringeStyle[]
  /** Built from its settings as `settingsOf` reads them, every one the shape has, and its Bead's depth across the
   * thread over its pitch along it, which only a round shape's packing reads (ticket 0723). */
  layout(settings: FrameSettings, depth: number): FrameLayout
}

/** A Frame without a Frame shape: its beads in its Weave's rows over its own rectangle, every action open to it. */
const FRAME: FrameRules = {
  // Turned (ticket 0667), its own grid is drawn turned in the rectangle it covers.
  geometry: (sheet) => (sheet.quarterTurns ? turnedGridGeometry(sheet) : gridGeometry(sheet, { row: 0, column: 0, rows: sheet.rows, columns: sheet.columns })),
  sizeMm: ({ columns, rows, quarterTurns, technique }, bead) => {
    const laid = describeWeave({ technique }).beadMm(bead)
    const upright = { widthMm: columns * laid.widthMm, heightMm: rows * laid.heightMm }
    return (quarterTurns ?? 0) % 2 === 1 ? { widthMm: upright.heightMm, heightMm: upright.widthMm } : upright
  },
  techniques: TECHNIQUES,
  // Chosen by the Frame's Technique, through its Weave's passes.
  rowOrder: rowsOrder,
  allows: new Set(['resize', 'remove-line', 'from-selection', 'rotate', 'technique', 'select']),
}

/** Rounds as a Triangle and a Warped Square offer them: a Kaleidocycle's triangles are 9 a side (research). */
const ROUNDS: FrameSetting = { id: 'rounds', labelKey: 'rounds', min: 2, max: 40, step: 1, default: 9, presets: [6, 9, 12], lossOnChange: true }
/** A Star's arms in rounds: the MiniStar's squares are 10 rounds (research). */
const STAR_PART: FrameSetting = { id: 'partSize', labelKey: 'partSize', min: 2, max: 30, step: 1, default: 10, presets: [6, 8, 10], lossOnChange: true }
/** A Kaleidocycle's triangles, beads a side: 9 in the primer, which finds smaller ones fold badly (research). */
const KALEIDOCYCLE_PART: FrameSetting = { id: 'partSize', labelKey: 'partSize', min: 3, max: 30, step: 1, default: 9, presets: [7, 9, 12], lossOnChange: true }
/** A Kite's Rows from its point (inferred: the reference gives no size). */
const KITE_ROWS: FrameSetting = { id: 'rows', labelKey: 'rows', min: 4, max: 60, step: 1, default: 21, presets: [15, 21, 30], lossOnChange: true }
/** A Fringe earring's base row, its rows up to a pair at the top, and its longest strand (StarterGallery card). */
const TOP_WIDTH: FrameSetting = { id: 'topWidth', labelKey: 'topWidth', min: 2, max: 30, step: 1, default: 7, presets: [5, 7, 9], lossOnChange: true }
const TOP_ROWS: FrameSetting = { id: 'topRows', labelKey: 'topRows', min: 1, max: 29, step: 1, default: 6, presets: [4, 6, 8], lossOnChange: true, below: 'topWidth' }
const FRINGE_LENGTH: FrameSetting = { id: 'fringeLength', labelKey: 'fringeLength', min: 2, max: 80, step: 1, default: 12, presets: [8, 12, 16], lossOnChange: true }

/** What a Custom frame offers (ADR 0079, ticket 0669): every Frame action, each done through its shape, but Remove
 * row/column, which needs plain rows. */
const CUSTOM_ALLOWS: ReadonlySet<FrameAction> = new Set(['resize', 'from-selection', 'rotate', 'technique', 'select'])

/** A Frame shape's own: the Techniques it supports, its settings and styles, and its panel builder. */
type ShapeOwn = Pick<FrameShape, 'techniques' | 'settings' | 'styles' | 'layout'>

/** A Frame shape (ADR 0078): its panel builder and settings, and its Row order's passes worked in rounds from the centre
 * or rows from a point (ticket 0594). Its beads are where its layout puts them, laid in its rectangle. */
function frameShape(id: FrameShapeId, lines: 'round' | 'row', own: ShapeOwn): FrameShape {
  return {
    id,
    geometry: (sheet) => layoutGeometry(laidLayout(sheet), sheet),
    sizeMm: (frame, bead) => {
      const { width, height } = laidLayout({ ...frame, cell: beadCell(bead, frame.technique) })
      const { widthMm } = describeWeave({ technique: frame.technique }).beadMm(bead)
      return { widthMm: width * widthMm, heightMm: height * widthMm }
    },
    rowOrder: (sheet) => layoutOrder(laidLayout(sheet), lines),
    allows: CUSTOM_ALLOWS,
    ...own,
  }
}

/** The registry, one entry per Frame shape, like the Starters'. */
const FRAME_SHAPES: Readonly<Record<FrameShapeId, FrameShape>> = {
  triangle: frameShape('triangle', 'round', { techniques: ['peyote'], settings: [ROUNDS], layout: ({ rounds }, depth) => roundsLayout(3, rounds!, depth) }),
  warpedSquare: frameShape('warpedSquare', 'round', { techniques: ['peyote'], settings: [ROUNDS], layout: ({ rounds }, depth) => roundsLayout(4, rounds!, depth) }),
  star: frameShape('star', 'round', { techniques: ['peyote'], settings: [STAR_PART], layout: ({ partSize }, depth) => starLayout(partSize!, depth) }),
  kaleidocycle: frameShape('kaleidocycle', 'round', {
    techniques: ['peyote'],
    settings: [KALEIDOCYCLE_PART],
    layout: ({ partSize }, depth) => kaleidocycleLayout(partSize!, depth),
  }),
  kite: frameShape('kite', 'row', { techniques: ['peyote'], settings: [KITE_ROWS], layout: ({ rows }) => kiteLayout(rows!) }),
  fringeEarring: frameShape('fringeEarring', 'row', {
    techniques: ['brick'],
    settings: [TOP_WIDTH, TOP_ROWS, FRINGE_LENGTH],
    styles: FRINGE_STYLES,
    layout: (settings) => fringeLayout(settings as FringeSettings),
  }),
}

/** Every Frame shape, in the registry's order.
 * @internal The registry test checks every shape's settings (ticket 0624). */
export const FRAME_SHAPE_IDS = Object.keys(FRAME_SHAPES) as readonly FrameShapeId[]

/** Whether a stored value names a Frame shape this build knows. */
export function isFrameShape(value: unknown): value is FrameShapeId {
  return typeof value === 'string' && Object.hasOwn(FRAME_SHAPES, value)
}

/** A Frame's Frame shape, which makes it a Custom frame; none for a Frame without one. */
export function frameShapeOf(frame: Pick<FrameSheet, 'shape'>): FrameShape | undefined {
  return frame.shape && FRAME_SHAPES[frame.shape]
}

/** What a Frame answers by: its Frame shape, or a Frame's own rules when it has none. */
function rulesOf(frame: Pick<FrameSheet, 'shape'>): FrameRules {
  return frameShapeOf(frame) ?? FRAME
}

/** What a Frame without a shape lying turned does not offer (ticket 0667): what reshapes it as a rectangle of the
 * Canvas's positions, which its own rows and columns no longer are. Turned upright again, it offers them again. */
const UPRIGHT_ONLY: ReadonlySet<FrameAction> = new Set(['resize', 'remove-line', 'from-selection'])

/** Whether a Frame without a shape lies turned (ticket 0667): its own grid, not a layout, drawn a quarter turn or more
 * round. */
function turnedGrid(frame: Pick<FrameSheet, 'shape' | 'quarterTurns'>): boolean {
  return !!frame.quarterTurns && !frameShapeOf(frame)
}

/** Whether a Frame lets the weaver do this to it; with no Frame, what a Frame without a shape would. */
export function frameAllows(frame: Pick<FrameSheet, 'shape' | 'quarterTurns'> | undefined, action: FrameAction): boolean {
  return rulesOf(frame ?? {}).allows.has(action) && !(frame && turnedGrid(frame) && UPRIGHT_ONLY.has(action))
}

/** The Techniques a Frame may be woven in (ADR 0079): its Frame shape's, or any; with no Frame, any. */
export function techniquesOf(frame: Pick<FrameSheet, 'shape'> | undefined): readonly Technique[] {
  return rulesOf(frame ?? {}).techniques
}

/** The Frame's Row order worked one way: what Row progress's first row, current row, next row and pass count ask. */
export function rowOrderOf(sheet: ShapedSheet, way: RowWay): RowOrder {
  return rulesOf(sheet).rowOrder(sheet, way)
}

/** The setting a Custom frame is sized by, its first, its id and range; none for a Frame without a shape. */
export function sizeSettingOf(frame: Pick<FrameSheet, 'shape'>): Readonly<FrameSetting> | undefined {
  return frameShapeOf(frame)?.settings[0]
}

/** One of a Custom frame's numbered settings as the Frame panel offers it: its value and the range it may take now. */
export interface SettingValue {
  name: FrameSettingName
  value: number
  min: number
  max: number
}

/** A Custom frame's numbered settings, each read within its range (bounded by another where one is), its default where
 * missing; none for a Frame without a shape. */
export function settingValuesOf(frame: Pick<FrameSheet, 'shape' | 'settings'>): SettingValue[] {
  const read: Partial<Record<FrameSettingName, number>> = {}
  return (frameShapeOf(frame)?.settings ?? []).map((setting) => {
    const max = setting.below ? Math.min(setting.max, (read[setting.below] ?? setting.max + 1) - 1) : setting.max
    const stored = frame.settings?.[setting.id]
    const value = typeof stored === 'number' && Number.isFinite(stored) ? Math.min(max, Math.max(setting.min, Math.round(stored))) : Math.min(max, setting.default)
    read[setting.id] = value
    return { name: setting.id, value, min: setting.min, max }
  })
}

/** The one setting a Frame panel change names (it changes one at a time): a numbered setting or the Fringe style. */
export function changedSetting(change: FrameSettings): FrameSettingName | 'fringeStyle' {
  return Object.keys(change)[0] as FrameSettingName | 'fringeStyle'
}

/** A Fringe earring's Fringe style as it keeps it, straight where none or an unknown one is stored; none for a Frame
 * whose shape has no styles. */
export function fringeStyleOf(frame: Pick<FrameSheet, 'shape' | 'settings'>): FringeStyle | undefined {
  const styles = frameShapeOf(frame)?.styles
  if (!styles) return undefined
  return styles.find((style) => style === frame.settings?.fringeStyle) ?? styles[0]
}

/** A Custom frame's settings as it keeps them: each of its shape's read within its range, and nothing else; none for a
 * Frame without a shape. */
export function settingsOf(frame: Pick<FrameSheet, 'shape' | 'settings'>): FrameSettings | undefined {
  if (!frameShapeOf(frame)) return undefined
  const style = fringeStyleOf(frame)
  return { ...Object.fromEntries(settingValuesOf(frame).map(({ name, value }) => [name, value])), ...(style ? { fringeStyle: style } : {}) }
}

/** A Custom frame's layout, built from its settings and turned as Rotate Frame left it, or a turned Frame's own grid
 * as one (ticket 0667); none for an upright Frame without a shape. What a Selection over it lands beads by (ticket
 * 0594); finding, drawing or hitting a bead asks the Frame's geometry. */
export function frameLayoutOf(frame: Laid & Partial<ShapedSheet>): FrameLayout | undefined {
  if (turnedGrid(frame) && isSheet(frame)) return turnedGridLayout(frame)
  return frameShapeOf(frame) && laidLayout(frame)
}

/** Whether a Frame comes with its size and Weave, which a turned grid is laid out from. */
function isSheet(frame: Laid & Partial<ShapedSheet>): frame is ShapedSheet {
  return frame.technique !== undefined && frame.rows !== undefined && frame.columns !== undefined
}

/** How deep a bead of a round shape is drawn where its layer's Bead is unknown: a Delica 11/0's, as the MiniStar is
 * beaded (ticket 0723). */
const UNKNOWN_BEAD_DEPTH = beadCell(findBead('miyuki/delica/11-0'), DEFAULT_TECHNIQUE)!.aspect

/** The depth a Custom frame's beads pack by: its Bead's height across the thread over its pitch along it (ticket 0723). */
function depthOf(frame: Pick<Laid, 'cell'>): number {
  return frame.cell?.aspect ?? UNKNOWN_BEAD_DEPTH
}

/** The layout a Custom frame's Frame shape lays it out by: called only on a Frame that has one. */
function laidLayout(frame: Laid): FrameLayout {
  return turnedLayout(frameShapeOf(frame)!.layout(settingsOf(frame)!, depthOf(frame)), frame.quarterTurns ?? 0)
}

/** A Frame's Layer geometry (ADR 0078): what it lays its beads out by, its own rows or its shape's layout. `frame`
 * carries the Bead's cell, as the Frame is drawn. */
export function frameGeometry(frame: ShapedSheet): LayerGeometry {
  return rulesOf(frame).geometry(frame)
}

/** A Frame's Estimated size in mm on a Bead, as it or its shape measures it, before the view turns it. */
export function frameSizeMm(frame: Measured, bead: Bead): { widthMm: number; heightMm: number } {
  return rulesOf(frame).sizeMm(frame, bead)
}

/** The rows and columns of a Custom frame's Technique (the first its shape supports unless given) that cover its
 * layout: the bounding rectangle its footprint is made from (ADR 0077), counted in the cells of its layer's Bead
 * (ticket 0723), so a bead of the layout is a cell wide. */
export function customFrameSize(shape: FrameShapeId, settings: FrameSettings, quarterTurns?: QuarterTurns, technique: Technique = FRAME_SHAPES[shape].techniques[0], cell?: Laid['cell']): GridDimensions {
  const layout = laidLayout({ shape, settings, quarterTurns, cell })
  const description = describeWeave(withCell({ technique }, cell))
  const aspect = description.cellAspect
  let columns = 1
  while (description.blockExtent(columns, 2, 1, aspect).width < layout.width) columns += 1
  let rows = 1
  while (description.blockExtent(columns, rows, 1, aspect).height < layout.height) rows += 1
  return { rows, columns }
}

/** How a Custom frame's size setting meets a rectangle asked of it: a resize handle's, the step whose rectangle comes
 * nearest on the sides that changed; Frame from Selection's, the smallest that covers it (the largest if none does). */
export type SizeFit = 'nearest' | 'cover'

/** A Custom frame's settings with its size setting stepped to a rectangle asked of it (ADR 0079, ticket 0669), its
 * other settings kept; none for a Frame without a shape, whose rectangle is its size. */
export function sizedSettings(frame: Laid & Pick<FrameSheet, 'rows' | 'columns' | 'technique'>, asked: GridDimensions, fit: SizeFit): FrameSettings | undefined {
  const setting = sizeSettingOf(frame)
  if (!setting) return undefined
  const settings = settingsOf(frame)!
  const at = (value: number): FrameSettings => ({ ...settings, [setting.id]: value })
  const sizeAt = (value: number) => customFrameSize(frame.shape!, at(value), frame.quarterTurns, frame.technique, frame.cell)
  if (fit === 'cover') {
    for (let value = setting.min; value < setting.max; value += 1) {
      const size = sizeAt(value)
      if (size.rows >= asked.rows && size.columns >= asked.columns) return at(value)
    }
    return at(setting.max)
  }
  const miss = (value: number) => {
    const size = sizeAt(value)
    return (asked.rows === frame.rows ? 0 : Math.abs(size.rows - asked.rows)) + (asked.columns === frame.columns ? 0 : Math.abs(size.columns - asked.columns))
  }
  // The rectangle grows with the setting, so walking from where it is finds the nearest step.
  let value = settings[setting.id]!
  while (value < setting.max && miss(value + 1) < miss(value)) value += 1
  while (value > setting.min && miss(value - 1) < miss(value)) value -= 1
  return at(value)
}

/** A Custom frame's settings grown until its layout holds every one of these positions, or as far as they go: where
 * Remove Frame finds its Folded beads (ticket 0669), as growing it back would show them. Its numbered settings step up
 * together, in its own Fringe style first, then in each other. */
export function settingsHolding(frame: Pick<FrameSheet, 'shape' | 'settings' | 'cell'>, positions: readonly GridPosition[]): FrameSettings {
  const shape = frameShapeOf(frame)!
  const start = settingsOf(frame)!
  const styles = shape.styles ? [start.fringeStyle, ...shape.styles.filter((style) => style !== start.fringeStyle)] : [start.fringeStyle]
  let best: { settings: FrameSettings; held: number } | undefined
  for (const style of styles) {
    let settings: FrameSettings = { ...start, ...(style ? { fringeStyle: style } : {}) }
    for (;;) {
      const layout = shape.layout(settings, depthOf(frame))
      const held = positions.filter((position) => layoutPosition(layout, position)).length
      if (held === positions.length) return settings
      if (!best || held > best.held) best = { settings, held }
      const values = settingValuesOf({ shape: frame.shape, settings })
      if (values.every(({ value, max }) => value >= max)) break
      settings = settingsOf({ shape: frame.shape, settings: { ...settings, ...Object.fromEntries(values.map(({ name, value }) => [name, value + 1])) } })!
    }
  }
  return best!.settings
}

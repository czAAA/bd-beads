import { beadPitchMm, type Bead } from './beads'
import type { FrameSheet } from './canvas'
import { fringeLayout, kaleidocycleLayout, kiteLayout, roundsLayout, starLayout, turnedLayout, type FrameLayout, type FringeSettings } from './frameLayout'
import type { GridDimensions } from './grid'
import { gridGeometry, layoutGeometry, turnedGridGeometry, turnedGridLayout, type LayerGeometry } from './layerGeometry'
import { layoutOrder, rowsOrder, type RowOrder, type RowWay } from './rowOrder'
import type { SettingSpec } from './settingSpec'
import { describeWeave, type Technique, type Weave } from './weave'

/** The Frame kinds (spec 0590, ADR 0077). Rectangular is the Frame as it has always been; the Custom frames are a
 * Triangle and a Warped Square in Rounds (ticket 0592), a Star and a Kaleidocycle of such parts, a Kite in Rows from its
 * point (ticket 0593), and a Fringe earring, a brick-stitch top with strands under it (ticket 0597). */
export type FrameKindId = 'rectangular' | 'triangle' | 'warpedSquare' | 'star' | 'kaleidocycle' | 'kite' | 'fringeEarring'

/** The kind a Frame with none stored is: every Frame made before kinds, and every Rectangular one, as it is left
 * unsaved. */
export const DEFAULT_FRAME_KIND: FrameKindId = 'rectangular'

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

/** One setting of a kind, in the shape a Technique's has (ticket 0624): its words are under its id in `frame.sizeSettings`,
 * a smaller one asks before it drops beads, and one bounded by another stays below it (a Fringe earring's top has fewer
 * rows than its base has beads, so it ends on a pair: StarterGallery card). */
type FrameSetting = SettingSpec<FrameSettingName>

/** How many quarter turns clockwise a Frame lies at on the Canvas (Rotate Frame, tickets 0594, 0667, ADR 0079): a Custom
 * frame's layout, or a plain Frame's own grid, turned. One setting for both. */
export type QuarterTurns = 1 | 2 | 3

/** What a Custom frame's layout is built from: its kind, its settings and how far it is turned. */
type Laid = Pick<FrameSheet, 'kind' | 'settings' | 'quarterTurns'>

/** A Frame as its kind reads it: its kind, its settings, its turn, its size and its Weave. */
export type KindedSheet = Laid & Pick<FrameSheet, 'rows' | 'columns'> & Weave

/** What a Frame lets the weaver do to it beyond painting and moving it: change its rectangle (the resize handles, Width
 * and Height, Remove row/column, Frame from Selection), turn it, weave it in another Technique, or select on it. */
export type FrameAction = 'resize' | 'remove-line' | 'from-selection' | 'rotate' | 'technique' | 'select'

/** A Frame's rectangle as its kind measures it. */
type Measured = Laid & Pick<FrameSheet, 'rows' | 'columns'>

/** Everything that differs by Frame kind; code asks the Frame's kind rather than testing which it is. */
export interface FrameKind {
  id: FrameKindId
  /** Where its beads are (ADR 0078): its Weave's rows over its own rectangle, or its layout laid in it. */
  geometry(sheet: KindedSheet): LayerGeometry
  /** Its Estimated size in mm (CONTEXT.md) on a Bead, before the view turns it: a Bead's pitch a column and its height a
   * row, or a Custom frame as big as its shape, a bead's pitch to a bead width of its layout (ticket 0592). */
  sizeMm(frame: Measured, bead: Bead): { widthMm: number; heightMm: number }
  /** What Remove Frame does with the Frame's beads: drop them onto the Canvas where they stand (ticket 497), or
   * remove them with the Frame. */
  removedBeads: 'dropped' | 'removed'
  /** How Row progress steps through the Frame, worked one way. */
  rowOrder(sheet: KindedSheet, way: RowWay): RowOrder
  /** A Custom frame's shape comes from its settings, so it is turned and selected on but never reshaped as a rectangle. */
  allows: ReadonlySet<FrameAction>
  /** A Custom frame's own: the Technique its panels are woven in, its settings (the first the one it is sized by), a
   * Fringe earring's styles, and its panel builder. */
  custom?: {
    technique: Technique
    settings: readonly [FrameSetting, ...FrameSetting[]]
    styles?: readonly FringeStyle[]
    /** Built from its settings as `settingsOf` reads them: every one its kind has. */
    layout(settings: FrameSettings): FrameLayout
  }
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

/** What a Custom frame offers (ticket 0594): a Selection over it by a rectangle on screen, and Rotate Frame. */
const CUSTOM_ALLOWS: ReadonlySet<FrameAction> = new Set(['rotate', 'select'])

/** A Custom frame's kind (ADR 0078): its panel builder and settings, and its Row order's passes worked in rounds from
 * the centre or rows from a point (ticket 0594). Its beads are where its layout puts them, laid in its rectangle. */
function customKind(id: CustomFrameKindId, lines: 'round' | 'row', custom: NonNullable<FrameKind['custom']>): FrameKind {
  return {
    id,
    geometry: (sheet) => layoutGeometry(laidLayout(sheet), sheet),
    sizeMm: (frame, bead) => {
      const { width, height } = laidLayout(frame)
      return { widthMm: width * beadPitchMm(bead), heightMm: height * beadPitchMm(bead) }
    },
    removedBeads: 'removed',
    rowOrder: (sheet) => layoutOrder(laidLayout(sheet), lines),
    allows: CUSTOM_ALLOWS,
    custom,
  }
}

/** The registry, one entry per kind, like the Starters'. */
const FRAME_KINDS: Readonly<Record<FrameKindId, FrameKind>> = {
  rectangular: {
    id: 'rectangular',
    // Turned (ticket 0667), its own grid is drawn turned in the rectangle it covers.
    geometry: (sheet) => (sheet.quarterTurns ? turnedGridGeometry(sheet) : gridGeometry(sheet, { row: 0, column: 0, rows: sheet.rows, columns: sheet.columns })),
    sizeMm: ({ columns, rows, quarterTurns }, bead) => {
      const upright = { widthMm: columns * beadPitchMm(bead), heightMm: rows * bead.heightMm }
      return (quarterTurns ?? 0) % 2 === 1 ? { widthMm: upright.heightMm, heightMm: upright.widthMm } : upright
    },
    removedBeads: 'dropped',
    // Chosen by the Frame's Technique, through its Weave's passes.
    rowOrder: rowsOrder,
    allows: new Set(['resize', 'remove-line', 'from-selection', 'rotate', 'technique', 'select']),
  },
  triangle: customKind('triangle', 'round', { technique: 'peyote', settings: [ROUNDS], layout: ({ rounds }) => roundsLayout(3, rounds!) }),
  warpedSquare: customKind('warpedSquare', 'round', { technique: 'peyote', settings: [ROUNDS], layout: ({ rounds }) => roundsLayout(4, rounds!) }),
  star: customKind('star', 'round', { technique: 'peyote', settings: [STAR_PART], layout: ({ partSize }) => starLayout(partSize!) }),
  kaleidocycle: customKind('kaleidocycle', 'round', {
    technique: 'peyote',
    settings: [KALEIDOCYCLE_PART],
    layout: ({ partSize }) => kaleidocycleLayout(partSize!),
  }),
  kite: customKind('kite', 'row', { technique: 'peyote', settings: [KITE_ROWS], layout: ({ rows }) => kiteLayout(rows!) }),
  fringeEarring: customKind('fringeEarring', 'row', {
    technique: 'brick',
    settings: [TOP_WIDTH, TOP_ROWS, FRINGE_LENGTH],
    styles: FRINGE_STYLES,
    layout: (settings) => fringeLayout(settings as FringeSettings),
  }),
}

/** Every Frame kind, in the registry's order.
 * @internal The registry test checks every kind's settings (ticket 0624). */
export const FRAME_KIND_IDS = Object.keys(FRAME_KINDS) as readonly FrameKindId[]

/** A Custom frame's kind: every kind but Rectangular. */
export type CustomFrameKindId = Exclude<FrameKindId, 'rectangular'>

/** Whether a stored value names a Frame kind. */
export function isFrameKind(value: unknown): value is FrameKindId {
  return typeof value === 'string' && Object.hasOwn(FRAME_KINDS, value)
}

/** The kind of a Frame: its own, or Rectangular when it has none. */
export function frameKindOf(frame: Pick<FrameSheet, 'kind'>): FrameKind {
  return FRAME_KINDS[frame.kind ?? DEFAULT_FRAME_KIND]
}

/** What a plain Frame lying turned does not offer (ticket 0667): what reshapes it as a rectangle of the Canvas's
 * positions, which its own rows and columns no longer are. Turned upright again, it offers them again. */
const UPRIGHT_ONLY: ReadonlySet<FrameAction> = new Set(['resize', 'remove-line', 'from-selection'])

/** Whether a Frame lets the weaver do this to it; with no Frame, what a Rectangular one would. */
export function frameAllows(frame: Pick<FrameSheet, 'kind' | 'quarterTurns'> | undefined, action: FrameAction): boolean {
  return frameKindOf(frame ?? {}).allows.has(action) && !(frame && turnedGrid(frame) && UPRIGHT_ONLY.has(action))
}

/** Whether a Frame without a shape lies turned (ticket 0667): its own grid, not a layout, drawn a quarter turn or more
 * round. */
function turnedGrid(frame: Pick<FrameSheet, 'kind' | 'quarterTurns'>): boolean {
  return !!frame.quarterTurns && !frameKindOf(frame).custom
}

/** What Remove Frame does with a Frame's beads: its kind's way, but a turned Frame's beads no longer stand on Canvas
 * positions, so they go with it (ticket 0667), as a Custom frame's do. */
export function removedBeadsOf(frame: Pick<FrameSheet, 'kind' | 'quarterTurns'>): FrameKind['removedBeads'] {
  return turnedGrid(frame) ? 'removed' : frameKindOf(frame).removedBeads
}

/** The Frame's Row order worked one way: what Row progress's first row, current row, next row and pass count ask. */
export function rowOrderOf(sheet: KindedSheet, way: RowWay): RowOrder {
  return frameKindOf(sheet).rowOrder(sheet, way)
}

/** The setting a Custom frame is sized by, its first, its id and range; none for a Rectangular Frame. */
export function sizeSettingOf(frame: Pick<FrameSheet, 'kind'>): Readonly<FrameSetting> | undefined {
  return frameKindOf(frame).custom?.settings[0]
}

/** One of a Custom frame's numbered settings as the Frame panel offers it: its value and the range it may take now. */
export interface SettingValue {
  name: FrameSettingName
  value: number
  min: number
  max: number
}

/** A Custom frame's numbered settings, each read within its range (bounded by another where one is), its default where
 * missing; none for a Rectangular Frame. */
export function settingValuesOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): SettingValue[] {
  const read: Partial<Record<FrameSettingName, number>> = {}
  return (frameKindOf(frame).custom?.settings ?? []).map((setting) => {
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

/** A Fringe earring's Fringe style as it keeps it, straight where none or an unknown one is stored; none for a kind
 * without styles. */
export function fringeStyleOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): FringeStyle | undefined {
  const styles = frameKindOf(frame).custom?.styles
  if (!styles) return undefined
  return styles.find((style) => style === frame.settings?.fringeStyle) ?? styles[0]
}

/** A Custom frame's settings as it keeps them: each of its kind's read within its range, and nothing else; none for a
 * Rectangular Frame. */
export function settingsOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): FrameSettings | undefined {
  if (!frameKindOf(frame).custom) return undefined
  const style = fringeStyleOf(frame)
  return { ...Object.fromEntries(settingValuesOf(frame).map(({ name, value }) => [name, value])), ...(style ? { fringeStyle: style } : {}) }
}

/** A Custom frame's layout, built from its settings and turned as Rotate Frame left it, or a turned plain Frame's own
 * grid as one (ticket 0667); none for an upright Rectangular Frame. What a Selection over it lands beads by (ticket
 * 0594); finding, drawing or hitting a bead asks the Frame's geometry. */
export function frameLayoutOf(frame: Laid & Partial<KindedSheet>): FrameLayout | undefined {
  if (turnedGrid(frame) && isSheet(frame)) return turnedGridLayout(frame)
  return frameKindOf(frame).custom && laidLayout(frame)
}

/** Whether a Frame comes with its size and Weave, which a turned grid is laid out from. */
function isSheet(frame: Laid & Partial<KindedSheet>): frame is KindedSheet {
  return frame.technique !== undefined && frame.rows !== undefined && frame.columns !== undefined
}

/** The layout a Custom frame's own kind lays it out by: called only on a kind that has one. */
function laidLayout(frame: Laid): FrameLayout {
  return turnedLayout(frameKindOf(frame).custom!.layout(settingsOf(frame)!), frame.quarterTurns ?? 0)
}

/** A Frame's Layer geometry (ADR 0078): what its kind lays its beads out by. `frame` carries the Bead shape's cell, as
 * the Frame is drawn. */
export function frameGeometry(frame: KindedSheet): LayerGeometry {
  return frameKindOf(frame).geometry(frame)
}

/** A Frame's Estimated size in mm on a Bead, as its kind measures it, before the view turns it. */
export function frameSizeMm(frame: Measured, bead: Bead): { widthMm: number; heightMm: number } {
  return frameKindOf(frame).sizeMm(frame, bead)
}

/** The rows and columns of a Custom frame's Technique that cover its layout: the bounding rectangle its footprint is
 * made from (ADR 0077), counted in the Technique's own square cell. */
export function customFrameSize(kind: FrameKindId, settings: FrameSettings, quarterTurns?: QuarterTurns): GridDimensions {
  const layout = laidLayout({ kind, settings, quarterTurns })
  const description = describeWeave({ technique: FRAME_KINDS[kind].custom!.technique })
  let columns = 1
  while (description.blockExtent(columns, 2, 1, 1).width < layout.width) columns += 1
  let rows = 1
  while (description.blockExtent(columns, rows, 1, 1).height < layout.height) rows += 1
  return { rows, columns }
}

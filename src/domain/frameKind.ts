import type { FrameSheet } from './canvas'
import { kaleidocycleLayout, kiteLayout, layoutPosition, roundsLayout, starLayout, type FrameLayout } from './frameLayout'
import type { GridDimensions, GridPosition } from './grid'
import { rowsOrder, type RowOrder, type RowWay } from './rowOrder'
import { describeWeave, ROUNDS_TECHNIQUE, type Technique, type Weave } from './weave'

/** The Frame kinds (spec 0590, ADR 0077): what sort of Frame it is. Rectangular is the Frame as it has always been;
 * a Triangle and a Warped Square are Custom frames of peyote panels worked in Rounds from the centre (ticket 0592), a
 * Star and a Kaleidocycle are made of such parts, and a Kite is worked in Rows from its point (ticket 0593). */
export type FrameKindId = 'rectangular' | 'triangle' | 'warpedSquare' | 'star' | 'kaleidocycle' | 'kite'

/** The kind a Frame with none stored is: every Frame made before kinds, and every Rectangular one, as it is left
 * unsaved. */
export const DEFAULT_FRAME_KIND: FrameKindId = 'rectangular'

/** What a Custom frame is sized by: Rounds from the centre (Triangle, Warped Square), Part size, the rounds of each
 * part (Star, Kaleidocycle), or Rows from its point (Kite). */
export type FrameSettingName = 'rounds' | 'partSize' | 'rows'

/** A Custom frame's settings as the Frame holds them: what its panel builder lays it out from, its kind's one setting. */
export type FrameSettings = Partial<Record<FrameSettingName, number>>

/** One setting of a kind: its name, its default, its smallest and largest, and the sizes offered as presets. */
interface FrameSetting {
  name: FrameSettingName
  default: number
  min: number
  max: number
  presets: readonly number[]
}

/** A Frame as its kind reads it: its kind, its settings, its size and its Weave. */
export type KindedSheet = Pick<FrameSheet, 'kind' | 'settings' | 'rows' | 'columns'> & Weave

/** What a Frame lets the weaver do to it beyond painting and moving it: change its rectangle (the resize handles, Width
 * and Height, Remove row/column, Frame from Selection), turn it, weave it in another Technique, or select on it. */
export type FrameAction = 'resize' | 'remove-line' | 'from-selection' | 'rotate' | 'technique' | 'select'

/** Everything that differs by Frame kind; code asks the Frame's kind rather than testing which it is. */
export interface FrameKind {
  id: FrameKindId
  /** What Remove Frame does with the Frame's beads: drop them onto the Canvas where they stand (ticket 497), or
   * remove them with the Frame. */
  removedBeads: 'dropped' | 'removed'
  /** How Row progress steps through the Frame, worked one way; a kind without one does not turn Row progress on. */
  rowOrder?(sheet: KindedSheet, way: RowWay): RowOrder
  /** A Custom frame's shape comes from its settings, so it allows none of these until the tickets of spec 0590 add
   * them. */
  allows: ReadonlySet<FrameAction>
  /** A Custom frame's own: the Technique its panels are woven in, the setting it is sized by, and its panel builder. */
  custom?: {
    technique: Technique
    size: FrameSetting
    layout(size: number): FrameLayout
  }
}

/** Rounds as a Triangle and a Warped Square offer them: a Kaleidocycle's triangles are 9 a side (research). */
const ROUNDS: FrameSetting = { name: 'rounds', default: 9, min: 2, max: 40, presets: [6, 9, 12] }
/** A Star's arms in rounds: the MiniStar's squares are 10 rounds (research). */
const STAR_PART: FrameSetting = { name: 'partSize', default: 10, min: 2, max: 30, presets: [6, 8, 10] }
/** A Kaleidocycle's triangles, beads a side: 9 in the primer, which finds smaller ones fold badly (research). */
const KALEIDOCYCLE_PART: FrameSetting = { name: 'partSize', default: 9, min: 3, max: 30, presets: [7, 9, 12] }
/** A Kite's Rows from its point (inferred: the reference gives no size). */
const KITE_ROWS: FrameSetting = { name: 'rows', default: 21, min: 4, max: 60, presets: [15, 21, 30] }

/** The registry, one entry per kind, like the Starters'. */
const FRAME_KINDS: Readonly<Record<FrameKindId, FrameKind>> = {
  rectangular: {
    id: 'rectangular',
    removedBeads: 'dropped',
    // Chosen by the Frame's Technique, through its Weave's passes.
    rowOrder: rowsOrder,
    allows: new Set(['resize', 'remove-line', 'from-selection', 'rotate', 'technique', 'select']),
  },
  triangle: {
    id: 'triangle',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: ROUNDS_TECHNIQUE, size: ROUNDS, layout: (rounds) => roundsLayout(3, rounds) },
  },
  warpedSquare: {
    id: 'warpedSquare',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: ROUNDS_TECHNIQUE, size: ROUNDS, layout: (rounds) => roundsLayout(4, rounds) },
  },
  star: {
    id: 'star',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: ROUNDS_TECHNIQUE, size: STAR_PART, layout: starLayout },
  },
  kaleidocycle: {
    id: 'kaleidocycle',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: ROUNDS_TECHNIQUE, size: KALEIDOCYCLE_PART, layout: kaleidocycleLayout },
  },
  kite: {
    id: 'kite',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: ROUNDS_TECHNIQUE, size: KITE_ROWS, layout: kiteLayout },
  },
}

/** A Custom frame's kind: every kind but Rectangular. */
export type CustomFrameKindId = Exclude<FrameKindId, 'rectangular'>

/** The Custom frame kinds, in the order Add Custom frame offers them. */
export const CUSTOM_FRAME_KINDS: readonly CustomFrameKindId[] = ['triangle', 'warpedSquare', 'star', 'kaleidocycle', 'kite']

/** The order of a kind with none: no passes, and no bead in one, so nothing is ever finished or current. */
const NO_ROW_ORDER: RowOrder = {
  turns: false,
  count: 0,
  passAt: () => Number.POSITIVE_INFINITY,
  positionsOf: () => [],
  lineOf: () => undefined,
}

/** Whether a stored value names a Frame kind. */
export function isFrameKind(value: unknown): value is FrameKindId {
  return typeof value === 'string' && Object.hasOwn(FRAME_KINDS, value)
}

/** The kind of a Frame: its own, or Rectangular when it has none. */
export function frameKindOf(frame: Pick<FrameSheet, 'kind'>): FrameKind {
  return FRAME_KINDS[frame.kind ?? DEFAULT_FRAME_KIND]
}

/** Whether a Frame lets the weaver do this to it; with no Frame, what a Rectangular one would. */
export function frameAllows(frame: Pick<FrameSheet, 'kind'> | undefined, action: FrameAction): boolean {
  return frameKindOf(frame ?? {}).allows.has(action)
}

/** The Frame's Row order worked one way: what Row progress's first row, current row, next row and pass count ask. */
export function rowOrderOf(sheet: KindedSheet, way: RowWay): RowOrder {
  return frameKindOf(sheet).rowOrder?.(sheet, way) ?? NO_ROW_ORDER
}

/** Whether the Frame's kind steps Row progress through it: a Custom frame waits for its Row order (ticket 0594). */
export function hasRowOrder(frame: Pick<FrameSheet, 'kind'>): boolean {
  return frameKindOf(frame).rowOrder !== undefined
}

/** The setting a Custom frame is sized by, its name and range; none for a Rectangular Frame. */
export function sizeSettingOf(frame: Pick<FrameSheet, 'kind'>): Readonly<FrameSetting> | undefined {
  return frameKindOf(frame).custom?.size
}

/** A Custom frame's size, its kind's one setting read within its range, its default where missing; none for a
 * Rectangular Frame. */
export function frameSizeOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): number | undefined {
  const setting = sizeSettingOf(frame)
  if (!setting) return undefined
  const stored = frame.settings?.[setting.name]
  return typeof stored === 'number' && Number.isFinite(stored) ? Math.min(setting.max, Math.max(setting.min, Math.round(stored))) : setting.default
}

/** A Custom frame's settings as it keeps them: its size under its setting's name, and nothing else; none for a
 * Rectangular Frame. */
export function settingsOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): FrameSettings | undefined {
  const setting = sizeSettingOf(frame)
  return setting && { [setting.name]: frameSizeOf(frame) }
}

/** A Custom frame's layout, built from its size; none for a Rectangular Frame. */
export function frameLayoutOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): FrameLayout | undefined {
  const size = frameSizeOf(frame)
  return size === undefined ? undefined : frameKindOf(frame).custom!.layout(size)
}

/** Whether a Frame has a bead position here, counted from its own first row and column: a Custom frame's layout
 * position, or for a Rectangular Frame wherever its Weave has a bead (a Right-angle weave line's empty end has none). */
export function frameHasPosition(frame: KindedSheet, position: GridPosition): boolean {
  const layout = frameLayoutOf(frame)
  if (layout) return layoutPosition(layout, position) !== undefined
  return describeWeave(frame).hasPosition(position, { row: 0, column: 0, rows: frame.rows, columns: frame.columns })
}

/** The rows and columns of a Custom frame's Technique that cover its layout: the bounding rectangle its footprint is
 * made from (ADR 0077), counted in the Technique's own square cell. */
export function customFrameSize(kind: FrameKindId, settings: FrameSettings): GridDimensions {
  const custom = FRAME_KINDS[kind].custom!
  const layout = frameLayoutOf({ kind, settings })!
  const description = describeWeave({ technique: custom.technique })
  let columns = 1
  while (description.blockExtent(columns, 2, 1, 1).width < layout.width) columns += 1
  let rows = 1
  while (description.blockExtent(columns, rows, 1, 1).height < layout.height) rows += 1
  return { rows, columns }
}

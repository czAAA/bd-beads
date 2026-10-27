import type { FrameSheet } from './canvas'
import { layoutPosition, roundsLayout, type FrameLayout } from './frameLayout'
import type { GridDimensions, GridPosition } from './grid'
import { rowsOrder, type RowOrder, type RowWay } from './rowOrder'
import { describeWeave, type Technique, type Weave } from './weave'

/** The Frame kinds (spec 0590, ADR 0077): what sort of Frame it is. Rectangular is the Frame as it has always been;
 * a Triangle and a Warped Square are Custom frames of peyote panels worked in Rounds from the centre (ticket 0592). */
export type FrameKindId = 'rectangular' | 'triangle' | 'warpedSquare'

/** The kind a Frame with none stored is: every Frame made before kinds, and every Rectangular one, as it is left
 * unsaved. */
export const DEFAULT_FRAME_KIND: FrameKindId = 'rectangular'

/** A Custom frame's settings as the Frame holds them: what its panel builder lays it out from. */
export interface FrameSettings {
  /** Rounds from the centre (Triangle, Warped Square). */
  rounds?: number
}

/** One setting of a kind: its default, its smallest and largest, and the sizes offered as presets. */
export interface FrameSetting {
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
  /** A Custom frame's own: the Technique its panels are woven in, its Rounds, and its panel builder. */
  custom?: {
    technique: Technique
    rounds: FrameSetting
    layout(settings: Required<FrameSettings>): FrameLayout
  }
}

/** Rounds as a Triangle and a Warped Square offer them: a Kaleidocycle's triangles are 9 a side (research). */
const ROUNDS: FrameSetting = { default: 9, min: 2, max: 40, presets: [6, 9, 12] }

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
    custom: { technique: 'peyote', rounds: ROUNDS, layout: ({ rounds }) => roundsLayout(3, rounds) },
  },
  warpedSquare: {
    id: 'warpedSquare',
    removedBeads: 'removed',
    allows: new Set(),
    custom: { technique: 'peyote', rounds: ROUNDS, layout: ({ rounds }) => roundsLayout(4, rounds) },
  },
}

/** A Custom frame's kind: every kind but Rectangular. */
export type CustomFrameKindId = Exclude<FrameKindId, 'rectangular'>

/** The Custom frame kinds, in the order Add Custom frame offers them. */
export const CUSTOM_FRAME_KINDS: readonly CustomFrameKindId[] = ['triangle', 'warpedSquare']

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

/** A Custom frame's settings, each read within its kind's range, its default where missing; none for a Rectangular
 * Frame. */
export function settingsOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): Required<FrameSettings> | undefined {
  const custom = frameKindOf(frame).custom
  if (!custom) return undefined
  const { min, max } = custom.rounds
  const stored = frame.settings?.rounds
  return { rounds: typeof stored === 'number' && Number.isFinite(stored) ? Math.min(max, Math.max(min, Math.round(stored))) : custom.rounds.default }
}

/** A Custom frame's layout, built from its settings; none for a Rectangular Frame. */
export function frameLayoutOf(frame: Pick<FrameSheet, 'kind' | 'settings'>): FrameLayout | undefined {
  const settings = settingsOf(frame)
  return settings && frameKindOf(frame).custom!.layout(settings)
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

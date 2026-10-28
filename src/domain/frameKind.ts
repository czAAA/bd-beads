import type { FrameSheet } from './canvas'
import { fringeLayout, kaleidocycleLayout, kiteLayout, layoutPosition, roundsLayout, starLayout, turnedLayout, type FrameLayout, type FringeSettings } from './frameLayout'
import type { GridDimensions, GridPosition } from './grid'
import { layoutOrder, rowsOrder, type RowOrder, type RowWay } from './rowOrder'
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

/** One setting of a kind: its name, its default, its smallest and largest, and the sizes offered as presets; below
 * another setting's value where one bounds it (a Fringe earring's top has fewer rows than its base has beads, so it
 * ends on a pair: StarterGallery card). */
interface FrameSetting {
  name: FrameSettingName
  default: number
  min: number
  max: number
  presets: readonly number[]
  below?: FrameSettingName
}

/** How many quarter turns clockwise a Custom frame's layout lies at (Rotate Frame, ticket 0594). */
export type QuarterTurns = 1 | 2 | 3

/** What a Custom frame's layout is built from: its kind, its settings and how far it is turned. */
type Laid = Pick<FrameSheet, 'kind' | 'settings' | 'quarterTurns'>

/** A Frame as its kind reads it: its kind, its settings, its turn, its size and its Weave. */
export type KindedSheet = Laid & Pick<FrameSheet, 'rows' | 'columns'> & Weave

/** What a Frame lets the weaver do to it beyond painting and moving it: change its rectangle (the resize handles, Width
 * and Height, Remove row/column, Frame from Selection), turn it, weave it in another Technique, or select on it. */
export type FrameAction = 'resize' | 'remove-line' | 'from-selection' | 'rotate' | 'technique' | 'select'

/** Everything that differs by Frame kind; code asks the Frame's kind rather than testing which it is. */
export interface FrameKind {
  id: FrameKindId
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
const ROUNDS: FrameSetting = { name: 'rounds', default: 9, min: 2, max: 40, presets: [6, 9, 12] }
/** A Star's arms in rounds: the MiniStar's squares are 10 rounds (research). */
const STAR_PART: FrameSetting = { name: 'partSize', default: 10, min: 2, max: 30, presets: [6, 8, 10] }
/** A Kaleidocycle's triangles, beads a side: 9 in the primer, which finds smaller ones fold badly (research). */
const KALEIDOCYCLE_PART: FrameSetting = { name: 'partSize', default: 9, min: 3, max: 30, presets: [7, 9, 12] }
/** A Kite's Rows from its point (inferred: the reference gives no size). */
const KITE_ROWS: FrameSetting = { name: 'rows', default: 21, min: 4, max: 60, presets: [15, 21, 30] }
/** A Fringe earring's base row, its rows up to a pair at the top, and its longest strand (StarterGallery card). */
const TOP_WIDTH: FrameSetting = { name: 'topWidth', default: 7, min: 2, max: 30, presets: [5, 7, 9] }
const TOP_ROWS: FrameSetting = { name: 'topRows', default: 6, min: 1, max: 29, presets: [4, 6, 8], below: 'topWidth' }
const FRINGE_LENGTH: FrameSetting = { name: 'fringeLength', default: 12, min: 2, max: 80, presets: [8, 12, 16] }

/** A Custom frame's Row order (ticket 0594): its layout's passes, worked in rounds from the centre or rows from a point. */
function layoutRowOrder(lines: 'round' | 'row'): FrameKind['rowOrder'] {
  return (sheet) => layoutOrder(frameLayoutOf(sheet)!, lines)
}

/** What a Custom frame offers (ticket 0594): a Selection over it by a rectangle on screen, and Rotate Frame. */
const CUSTOM_ALLOWS: ReadonlySet<FrameAction> = new Set(['rotate', 'select'])

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
    rowOrder: layoutRowOrder('round'),
    allows: CUSTOM_ALLOWS,
    custom: { technique: 'peyote', settings: [ROUNDS], layout: ({ rounds }) => roundsLayout(3, rounds!) },
  },
  warpedSquare: {
    id: 'warpedSquare',
    removedBeads: 'removed',
    rowOrder: layoutRowOrder('round'),
    allows: CUSTOM_ALLOWS,
    custom: { technique: 'peyote', settings: [ROUNDS], layout: ({ rounds }) => roundsLayout(4, rounds!) },
  },
  star: {
    id: 'star',
    removedBeads: 'removed',
    rowOrder: layoutRowOrder('round'),
    allows: CUSTOM_ALLOWS,
    custom: { technique: 'peyote', settings: [STAR_PART], layout: ({ partSize }) => starLayout(partSize!) },
  },
  kaleidocycle: {
    id: 'kaleidocycle',
    removedBeads: 'removed',
    rowOrder: layoutRowOrder('round'),
    allows: CUSTOM_ALLOWS,
    custom: { technique: 'peyote', settings: [KALEIDOCYCLE_PART], layout: ({ partSize }) => kaleidocycleLayout(partSize!) },
  },
  kite: {
    id: 'kite',
    removedBeads: 'removed',
    rowOrder: layoutRowOrder('row'),
    allows: CUSTOM_ALLOWS,
    custom: { technique: 'peyote', settings: [KITE_ROWS], layout: ({ rows }) => kiteLayout(rows!) },
  },
  fringeEarring: {
    id: 'fringeEarring',
    removedBeads: 'removed',
    rowOrder: layoutRowOrder('row'),
    allows: CUSTOM_ALLOWS,
    custom: {
      technique: 'brick',
      settings: [TOP_WIDTH, TOP_ROWS, FRINGE_LENGTH],
      styles: FRINGE_STYLES,
      layout: (settings) => fringeLayout(settings as FringeSettings),
    },
  },
}

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

/** Whether a Frame lets the weaver do this to it; with no Frame, what a Rectangular one would. */
export function frameAllows(frame: Pick<FrameSheet, 'kind'> | undefined, action: FrameAction): boolean {
  return frameKindOf(frame ?? {}).allows.has(action)
}

/** The Frame's Row order worked one way: what Row progress's first row, current row, next row and pass count ask. */
export function rowOrderOf(sheet: KindedSheet, way: RowWay): RowOrder {
  return frameKindOf(sheet).rowOrder(sheet, way)
}

/** The setting a Custom frame is sized by, its first, its name and range; none for a Rectangular Frame. */
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
    const stored = frame.settings?.[setting.name]
    const value = typeof stored === 'number' && Number.isFinite(stored) ? Math.min(max, Math.max(setting.min, Math.round(stored))) : Math.min(max, setting.default)
    read[setting.name] = value
    return { name: setting.name, value, min: setting.min, max }
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

/** A Custom frame's layout, built from its settings and turned as Rotate Frame left it; none for a Rectangular Frame. */
export function frameLayoutOf(frame: Laid): FrameLayout | undefined {
  const settings = settingsOf(frame)
  return settings && turnedLayout(frameKindOf(frame).custom!.layout(settings), frame.quarterTurns ?? 0)
}

/** Where a Custom frame's layout lies in its rectangle, in cell widths from its first position's corner: a bead width to
 * a cell's width, smaller only where the Bead shape makes the rectangle shorter than the layout, and centred. The
 * renderer, the hit test and a Selection over it (ticket 0594) all place it here, so they agree where each bead is. */
export interface LayoutPlacement {
  layout: FrameLayout
  scale: number
  x: number
  y: number
}

/** A Frame's layout as placed in its rectangle, or none for a Rectangular Frame. */
export function layoutPlacement(frame: Laid & Pick<FrameSheet, 'rows' | 'columns'>, weave: Weave): LayoutPlacement | undefined {
  const layout = frameLayoutOf(frame)
  if (!layout) return undefined
  const description = describeWeave(weave)
  const extent = description.blockExtent(frame.columns, frame.rows, 1, description.cellAspect)
  const scale = Math.min(1, extent.width / layout.width, extent.height / layout.height)
  return { layout, scale, x: (extent.width - layout.width * scale) / 2, y: (extent.height - layout.height * scale) / 2 }
}

/** Whether a Frame has a bead position here, counted from its own first row and column: a Custom frame's layout
 * position, or for a Rectangular Frame wherever its Weave has a bead (a Right-angle weave line's empty end has none).
 * @internal Code asks the Layer geometry (ticket 0629); its test compares against this until ticket 0632 deletes it. */
export function frameHasPosition(frame: KindedSheet, position: GridPosition): boolean {
  const layout = frameLayoutOf(frame)
  if (layout) return layoutPosition(layout, position) !== undefined
  return describeWeave(frame).hasPosition(position, { row: 0, column: 0, rows: frame.rows, columns: frame.columns })
}

/** The rows and columns of a Custom frame's Technique that cover its layout: the bounding rectangle its footprint is
 * made from (ADR 0077), counted in the Technique's own square cell. */
export function customFrameSize(kind: FrameKindId, settings: FrameSettings, quarterTurns?: QuarterTurns): GridDimensions {
  const custom = FRAME_KINDS[kind].custom!
  const layout = frameLayoutOf({ kind, settings, quarterTurns })!
  const description = describeWeave({ technique: custom.technique })
  let columns = 1
  while (description.blockExtent(columns, 2, 1, 1).width < layout.width) columns += 1
  let rows = 1
  while (description.blockExtent(columns, rows, 1, 1).height < layout.height) rows += 1
  return { rows, columns }
}

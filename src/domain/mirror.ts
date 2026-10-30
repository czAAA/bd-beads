import { frameContains } from './canvas'
import type { GridPosition } from './grid'
import { layerAt, layerSheet, positionInLayer, positionOnCanvas, type LayerSheet } from './layers'
import { canvasOf, frameOf, type Layered } from './layerRecord'
import { mayPlace } from './margin'
import { touch, type Project } from './project'

// Mirror (ADR 0082, spec 0702; ticket 0703): the live mode that lands a drawing gesture at its counterparts. This
// module owns the setting and the counterpart maths, positions in and positions out, per layer; the callers of
// `paintCells` (the Paint stroke, Fill, Paste) and the hover preview all ask `counterparts`, so they never disagree.

/** How Mirror lays a counterpart (glossary: Mirror mode): a reflection, the same way round, or not at all. */
export type MirrorMode = 'off' | 'mirror' | 'repeat'
export const MIRROR_MODES: readonly MirrorMode[] = ['off', 'mirror', 'repeat']

/** A direction a straight Axis runs across (glossary: Axis): Left–right is a vertical line reflecting columns,
 * Top–bottom a horizontal one reflecting rows. */
export type MirrorDirection = 'leftRight' | 'topBottom'
export const MIRROR_DIRECTIONS: readonly MirrorDirection[] = ['leftRight', 'topBottom']

/** What Mirror maps across: the two straight Axes, or Radial (ticket 0705). */
export type MirrorAxis = MirrorDirection | 'radial'

/** Radial's image count (ticket 0705): a stepper from 2 to 8 on a grid. */
const MIN_FOLD = 2
const MAX_FOLD = 8

/** The Mirror setting, one per Project (spec 0702, Kept where): the mode, the Axes, Radial's Fold and the Frame's Axis
 * counts (N axes cut the Frame into N + 1 equal strips). Saved with the Project, off by default. */
export interface MirrorSetting {
  mode: MirrorMode
  axes: Record<MirrorAxis, boolean>
  fold: number
  counts: Record<MirrorDirection, number>
}

/** Mirror as a new Project has it, and as an older file reads: off, no Axis, one axis per direction. */
export const MIRROR_OFF: MirrorSetting = { mode: 'off', axes: { leftRight: false, topBottom: false, radial: false }, fold: MIN_FOLD, counts: { leftRight: 1, topBottom: 1 } }

/** The open Project's Mirror setting; off for one saved without. */
export function mirrorSettingOf(project: Pick<Project, 'mirror'>): MirrorSetting {
  return project.mirror ?? MIRROR_OFF
}

/** The Project with its Mirror setting replaced. Not an Undo step: a setting, like Letters (useExportFlow). */
export function withMirror(project: Project, mirror: MirrorSetting): Project {
  return { ...project, mirror }
}

/** Whether the mode is not Off: the tile is lit, the lines are drawn, a gesture is mirrored where an Axis is on. */
export function isMirrorOn(setting: MirrorSetting): boolean {
  return setting.mode !== 'off'
}

/** A stored Mirror setting read back (spec 0702): each field as a file may have left it, anything unreadable at its
 * default; none for a value that is not a setting at all, which reads as off. */
export function readMirrorSetting(stored: unknown): MirrorSetting | undefined {
  const value = stored as Partial<MirrorSetting> | null
  if (typeof value !== 'object' || value === null || !MIRROR_MODES.includes(value.mode as MirrorMode)) return undefined
  const axes = (value.axes ?? {}) as Partial<Record<MirrorAxis, unknown>>
  const counts = (value.counts ?? {}) as Partial<Record<MirrorDirection, unknown>>
  const count = (direction: MirrorDirection) => (Number.isInteger(counts[direction]) && (counts[direction] as number) >= 1 ? (counts[direction] as number) : 1)
  return {
    mode: value.mode as MirrorMode,
    axes: { leftRight: axes.leftRight === true, topBottom: axes.topBottom === true, radial: axes.radial === true },
    fold: Number.isInteger(value.fold) ? Math.min(MAX_FOLD, Math.max(MIN_FOLD, value.fold as number)) : MIN_FOLD,
    counts: { leftRight: count('leftRight'), topBottom: count('topBottom') },
  }
}

export function withMirrorMode(setting: MirrorSetting, mode: MirrorMode): MirrorSetting {
  return { ...setting, mode }
}

/** An Axis chip pressed (MirrorPopover card): turning one on while the mode is Off sets the mode to Mirror; Radial and
 * the straight Axes are not on together. */
export function withAxisToggled(setting: MirrorSetting, axis: MirrorAxis): MirrorSetting {
  const on = !setting.axes[axis]
  const others = axis === 'radial' ? { leftRight: false, topBottom: false } : { radial: false }
  return {
    ...setting,
    mode: on && setting.mode === 'off' ? 'mirror' : setting.mode,
    axes: { ...setting.axes, ...(on ? others : {}), [axis]: on },
  }
}

/** A direction's Axis count as the Stepper sets it, never under one; the Frame's own limit applies where it is used. */
export function withMirrorCount(setting: MirrorSetting, direction: MirrorDirection, count: number): MirrorSetting {
  return { ...setting, counts: { ...setting.counts, [direction]: Math.max(1, Math.round(count)) } }
}

/** Key `8` (spec 0702): the mode off, or back on as it last was (`lastMode`), with Left–right on if no Axis was. */
export function toggledMirror(setting: MirrorSetting, lastMode: Exclude<MirrorMode, 'off'>): MirrorSetting {
  if (isMirrorOn(setting)) return withMirrorMode(setting, 'off')
  const anyAxis = setting.axes.leftRight || setting.axes.topBottom || setting.axes.radial
  return { ...setting, mode: lastMode, axes: anyAxis ? setting.axes : { ...setting.axes, leftRight: true } }
}

/** Where the open Canvas's straight Axes lie (ticket 0704, spec 0702): a Left–right Axis as a column, a Top–bottom one
 * as a row, in the Canvas's own positions, a whole number through a position's centre and a half through its boundary
 * with the next; a direction with none has no Axis yet. On the Canvas layer's record; Radial's centre (0705) joins. */
export interface CanvasAxes {
  leftRight?: number
  topBottom?: number
}

/** A Canvas Axis snapped where a position's centre or a boundary is, the nearer. */
export function snapAxis(at: number): number {
  return Math.round(at * 2) / 2
}

/** The open Project's Canvas Axes; none placed for a Project saved without. */
export function canvasAxesOf(project: Layered): CanvasAxes {
  return canvasOf(project).mirrorAxes ?? {}
}

/** The Project with its Canvas Axes replaced, on the Canvas layer's record. */
export function withCanvasAxes(project: Project, mirrorAxes: CanvasAxes): Project {
  const [canvas, ...frames] = project.layers
  return touch(project, { layers: [{ ...canvas, mirrorAxes }, ...frames] })
}

/** The Canvas Axes once the setting is `setting`: a direction on with no Axis placed gets one through the view's centre
 * (the origin until the view is measured), snapped; one placed stays, on or off. The same record when nothing moved. */
export function withAxesPlaced(axes: CanvasAxes, setting: MirrorSetting, centre: Record<MirrorDirection, number> | undefined): CanvasAxes {
  const missing = MIRROR_DIRECTIONS.filter((direction) => setting.axes[direction] && axes[direction] === undefined)
  if (missing.length === 0) return axes
  return { ...axes, ...Object.fromEntries(missing.map((direction) => [direction, snapAxis(centre?.[direction] ?? 0)])) }
}

/** Whether the open Canvas mirrors a gesture (ticket 0704): Mirror mode with a straight Axis on and placed. */
export function canvasMirrors(project: Layered, setting: MirrorSetting): boolean {
  const axes = canvasAxesOf(project)
  return setting.mode === 'mirror' && MIRROR_DIRECTIONS.some((direction) => setting.axes[direction] && axes[direction] !== undefined)
}

/** Stored Canvas Axes read back: each direction's number snapped as the handle snaps, one that is no finite number left
 * out; none for a value that is no record. */
export function readCanvasAxes(stored: unknown): CanvasAxes | undefined {
  const value = stored as Partial<Record<MirrorDirection, unknown>> | null
  if (typeof value !== 'object' || value === null) return undefined
  const read = MIRROR_DIRECTIONS.filter((direction) => Number.isFinite(value[direction])).map((direction) => [direction, snapAxis(value[direction] as number)])
  return read.length > 0 ? Object.fromEntries(read) : undefined
}

/** The most axes a direction with this many beads across can take (ticket 0044): every axis has a bead on each side;
 * one for a direction of one bead. */
function maxAxisCount(cellsAcross: number): number {
  return Math.max(1, cellsAcross - 1)
}

/** Each direction's Axis count limit on the Frame (spec 0702: 1 to that direction's beads minus 1); none without a Frame
 * on a grid, where the counts do not apply (the open Canvas, ticket 0704; a Custom frame, ticket 0706). */
export function axisLimitsOf(project: Layered): Record<MirrorDirection, number> | undefined {
  const frame = frameOf(project)
  if (!frame || frame.shape) return undefined
  return { leftRight: maxAxisCount(frame.columns), topBottom: maxAxisCount(frame.rows) }
}

/** The axis positions along a direction of `cellsAcross` beads cut by `count` axes, in bead widths from its first
 * edge: where the overlay draws the lines (clamped to the direction's limit, as the counterparts are). */
export function axisOffsets(cellsAcross: number, count: number): number[] {
  const strips = Math.min(count, maxAxisCount(cellsAcross)) + 1
  return Array.from({ length: strips - 1 }, (_axis, index) => (cellsAcross * (index + 1)) / strips)
}

// The strip maths (ticket 0044): N axes cut a direction into N + 1 strips as equal as possible, read as mirror images
// (Mirror) or the same way round (Repeat). Worked in an integer space, cell centres doubled and scaled by the strip
// count, so no float drifts.
interface StripSpace {
  strips: number
  /** How much a cell index advances a position. */
  scale: number
  stripWidth: number
}

function stripSpace(dimension: number, strips: number): StripSpace {
  return { strips, scale: 2 * strips, stripWidth: 2 * dimension }
}

/** Which strip a position falls in: a position on a boundary counts toward the strip before it, so an odd direction's
 * middle bead belongs to the first half. */
function stripAt(position: number, space: StripSpace): number {
  return Math.min(space.strips - 1, Math.max(0, Math.ceil(position / space.stripWidth) - 1))
}

function reversed(strip: number, repeat: boolean): boolean {
  return !repeat && strip % 2 === 1
}

/** Every index of `dimension` that `index` mirrors onto under `count` axes, itself included, in strip order; an uneven
 * split rounds to the nearest cell. */
function stripCounterparts(index: number, dimension: number, count: number, repeat: boolean): number[] {
  const space = stripSpace(dimension, Math.min(count, maxAxisCount(dimension)) + 1)
  const position = index * space.scale + space.strips
  const source = stripAt(position, space)
  const local = reversed(source, repeat) ? (source + 1) * space.stripWidth - position : position - source * space.stripWidth
  const images: number[] = []
  for (let strip = 0; strip < space.strips; strip++) {
    const target = reversed(strip, repeat) ? (strip + 1) * space.stripWidth - local : strip * space.stripWidth + local
    const at = Math.min(dimension - 1, Math.max(0, Math.round((target - space.strips) / space.scale)))
    if (!images.includes(at)) images.push(at)
  }
  return images
}

/** Every index `index` maps to across one Axis at `at` in Mirror mode, itself included: its reflection, which is itself
 * when the Axis runs through its centre. */
function reflected(index: number, at: number): number[] {
  const image = 2 * at - index
  return image === index ? [index] : [index, image]
}

type IndexImages = (index: number) => number[]
const same: IndexImages = (index) => [index]

/** How a layer maps each direction's index under the setting, or nothing where the layer has no Axis to map by: the
 * Frame's strips from its edge and the counts (ticket 0703); the open Canvas's single Axes from its own record, in
 * Mirror mode only (ticket 0704: with no edge there is no strip to repeat, spec 0702's decision). */
function imagesBy(sheet: LayerSheet, setting: MirrorSetting): Record<MirrorDirection, IndexImages> | undefined {
  const { edge, geometry, axes } = sheet
  if (!isMirrorOn(setting) || !geometry.grid || !(setting.axes.leftRight || setting.axes.topBottom)) return undefined
  if (edge) {
    const repeat = setting.mode === 'repeat'
    return {
      leftRight: setting.axes.leftRight ? (column) => stripCounterparts(column, edge.columns, setting.counts.leftRight, repeat) : same,
      topBottom: setting.axes.topBottom ? (row) => stripCounterparts(row, edge.rows, setting.counts.topBottom, repeat) : same,
    }
  }
  if (setting.mode !== 'mirror' || !axes) return undefined
  const across = (direction: MirrorDirection): IndexImages => {
    const at = axes[direction]
    return setting.axes[direction] && at !== undefined ? (index) => reflected(index, at) : same
  }
  return { leftRight: across('leftRight'), topBottom: across('topBottom') }
}

/** The positions a gesture changes under Mirror, on one layer (spec 0702): the sources as given, then their counterparts
 * by index on the layer's grid (`imagesBy`), each once, a source keeping what rides on it (a Paste's color); `dropped`
 * counts those the layer has no position for. A Custom frame (ticket 0706) gives the sources alone, as yet. */
export function counterparts<T extends GridPosition>(sheet: LayerSheet, setting: MirrorSetting, positions: readonly T[]): { positions: T[]; dropped: number } {
  const { edge, geometry } = sheet
  const images = imagesBy(sheet, setting)
  if (!images) {
    return { positions: [...positions], dropped: 0 }
  }
  const columnsOf = images.leftRight
  const rowsOf = images.topBottom

  const taken = new Set(positions.map(({ row, column }) => `${row}:${column}`))
  const result = [...positions]
  let dropped = 0
  for (const source of positions) {
    if (edge && !frameContains(edge, source)) continue
    for (const row of rowsOf(source.row)) {
      for (const column of columnsOf(source.column)) {
        const key = `${row}:${column}`
        if (taken.has(key)) continue
        taken.add(key)
        if (!geometry.hasPosition({ row, column })) {
          dropped += 1
          continue
        }
        result.push({ ...source, row, column })
      }
    }
  }
  return { positions: result, dropped }
}

/** `counterparts` for Canvas positions (the hover preview, ticket 0703): those on the Frame are mapped through the
 * Frame's own positions and come back as Canvas positions naming their layer; the Canvas's own across the Canvas's
 * Axes (ticket 0704), a counterpart the keep-out margin or a finished row refuses left out, as the Edit drops it. */
export function mirroredOnCanvas<T extends GridPosition>(project: Project, setting: MirrorSetting, cells: readonly T[]): T[] {
  if (!isMirrorOn(setting)) return [...cells]
  const onFrame = frameOf(project) ? cells.filter((cell) => layerAt(project, cell) === 'frame') : []
  const onCanvas = cells.filter((cell) => !onFrame.includes(cell))
  const placeable = (cell: T) => onCanvas.includes(cell) || mayPlace(project, cell)
  const mirroredCanvas = onCanvas.length > 0 ? counterparts(layerSheet(project, 'canvas'), setting, onCanvas).positions.filter(placeable) : []
  if (onFrame.length === 0) return mirroredCanvas
  const sheet = layerSheet(project, 'frame')
  const local = onFrame.map((cell) => ({ ...cell, ...positionInLayer(project, 'frame', cell) }))
  const mirrored = counterparts(sheet, setting, local).positions.map((cell) => ({ ...cell, ...positionOnCanvas(project, 'frame', cell), layer: 'frame' as const }))
  return [...mirroredCanvas, ...mirrored]
}

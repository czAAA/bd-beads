import { frameContains, type Rect } from './canvas'
import type { GridPosition } from './grid'
import { layerAt, layerSheet, positionInLayer, positionOnCanvas, type LayerSheet } from './layers'
import { canvasOf, frameOf, type Layered } from './layerRecord'
import { mayPlace } from './margin'
import { touch, type Project } from './project'
import { describeWeave } from './weave'

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
export const MIRROR_AXES: readonly MirrorAxis[] = [...MIRROR_DIRECTIONS, 'radial']

/** Radial's image count (ticket 0705): a stepper from 2 to 8 on a grid. Past 8 the sectors are narrower than a bead a
 * few beads out and the images merge (MirrorPopover card). */
export const MIN_FOLD = 2
export const MAX_FOLD = 8

/** The Mirror setting, one per Project (spec 0702, Kept where): the mode, the Axes, Radial's Fold and the Frame's Axis
 * counts (N axes cut the Frame into N + 1 equal strips). Saved with the Project, off by default. */
export interface MirrorSetting {
  mode: MirrorMode
  axes: Record<MirrorAxis, boolean>
  fold: number
  counts: Record<MirrorDirection, number>
  /** The straight Axes as they were when Radial went on (ticket 0705, MirrorPopover card): Radial on turns them off
   * and remembers them here, Radial off brings them back. Absent while Radial has not been on. */
  beforeRadial?: Record<MirrorDirection, boolean>
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
  const before = value.beforeRadial as Partial<Record<MirrorDirection, unknown>> | undefined
  return {
    mode: value.mode as MirrorMode,
    axes: { leftRight: axes.leftRight === true, topBottom: axes.topBottom === true, radial: axes.radial === true },
    fold: clampFold(value.fold),
    counts: { leftRight: count('leftRight'), topBottom: count('topBottom') },
    ...(typeof before === 'object' && before !== null ? { beforeRadial: { leftRight: before.leftRight === true, topBottom: before.topBottom === true } } : {}),
  }
}

/** A Fold within the Stepper's range, 2 to 8; the least for anything that is no whole number. */
function clampFold(fold: unknown): number {
  return Number.isInteger(fold) ? Math.min(MAX_FOLD, Math.max(MIN_FOLD, fold as number)) : MIN_FOLD
}

export function withMirrorMode(setting: MirrorSetting, mode: MirrorMode): MirrorSetting {
  return { ...setting, mode }
}

/** An Axis chip pressed (MirrorPopover card): turning one on while the mode is Off sets the mode to Mirror. Radial on
 * turns the straight Axes off and remembers them; Radial off brings them back; a straight Axis on turns Radial off. */
export function withAxisToggled(setting: MirrorSetting, axis: MirrorAxis): MirrorSetting {
  const on = !setting.axes[axis]
  const mode = on && setting.mode === 'off' ? 'mirror' : setting.mode
  if (axis === 'radial') {
    const { leftRight, topBottom } = setting.axes
    const { beforeRadial: before, ...rest } = setting
    const axes = on ? { leftRight: false, topBottom: false, radial: true } : { ...(before ?? { leftRight, topBottom }), radial: false }
    return { ...rest, mode, axes, ...(on ? { beforeRadial: { leftRight, topBottom } } : {}) }
  }
  return { ...setting, mode, axes: { ...setting.axes, ...(on ? { radial: false } : {}), [axis]: on } }
}

/** A direction's Axis count as the Stepper sets it, never under one; the Frame's own limit applies where it is used. */
export function withMirrorCount(setting: MirrorSetting, direction: MirrorDirection, count: number): MirrorSetting {
  return { ...setting, counts: { ...setting.counts, [direction]: Math.max(1, Math.round(count)) } }
}

/** Radial's Fold as the Stepper sets it, 2 to 8. */
export function withMirrorFold(setting: MirrorSetting, fold: number): MirrorSetting {
  return { ...setting, fold: clampFold(Math.round(fold)) }
}

/** Whether a Fold maps by index (2 and 4: a half or quarter turn of the grid, exact) or geometrically (3 and 5 to 8:
 * each bead's centre turned and the nearest bead taking it). The popover's Note says which (MirrorPopover card). */
export function foldByIndex(fold: number): boolean {
  return fold === 2 || fold === 4
}

/** The turn between a Fold's images in degrees, rounded, for the popover's Note. */
export function foldAngle(fold: number): number {
  return Math.round(360 / fold)
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
  /** Radial's centre on the open Canvas (ticket 0705): the handle's place; none until Radial is turned on. */
  centre?: RadialCentre
}

/** Where Radial turns about (ticket 0705): a row and column of the layer, both whole (on a position's centre) or both
 * halves (a corner between four). The index rule turns about it, the geometric rule about its point; a Frame's is its
 * own centre, the Canvas's its handle, and an Area (ticket 0710) or a layout (0706) passes its own. */
export interface RadialCentre {
  row: number
  column: number
}

/** A Canvas Axis snapped where a position's centre or a boundary is, the nearer. */
export function snapAxis(at: number): number {
  return Math.round(at * 2) / 2
}

/** A Radial centre snapped to the nearer of a position's centre and a corner between four; a tie takes the position. */
export function snapCentre({ row, column }: RadialCentre): RadialCentre {
  const whole = { row: Math.round(row), column: Math.round(column) }
  const corner = { row: Math.round(row - 0.5) + 0.5, column: Math.round(column - 0.5) + 0.5 }
  const apart = (to: RadialCentre) => (to.row - row) ** 2 + (to.column - column) ** 2
  return apart(corner) < apart(whole) ? corner : whole
}

/** The Frame's own centre (spec 0702): on its middle position for an odd size, between four for an even one. */
function frameCentre(edge: Rect): RadialCentre {
  return { row: edge.row + (edge.rows - 1) / 2, column: edge.column + (edge.columns - 1) / 2 }
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

/** The Canvas Axes as the setting goes from `before` to `next` (spec 0702): a direction that goes on is placed through
 * the view's centre, snapped, as is one that is on with no Axis placed yet (an older file), at its last place, or the
 * origin, until the view is measured; the rest stay, on or off. The same record when nothing moved. */
export function withAxesPlaced(axes: CanvasAxes, before: MirrorSetting, next: MirrorSetting, centre: Record<MirrorDirection, number> | undefined): CanvasAxes {
  const placing = MIRROR_DIRECTIONS.filter((direction) => next.axes[direction] && (!before.axes[direction] || axes[direction] === undefined))
  const placed = placing.map((direction): [MirrorDirection, number] => [direction, snapAxis(centre?.[direction] ?? axes[direction] ?? 0)])
  const straight = placed.every(([direction, at]) => axes[direction] === at) ? axes : { ...axes, ...Object.fromEntries(placed) }
  // Radial's centre (ticket 0705) is placed the same way, at the view's middle in both directions.
  if (!next.axes.radial || (before.axes.radial && axes.centre !== undefined)) return straight
  const at = snapCentre(centre ? { row: centre.topBottom, column: centre.leftRight } : (axes.centre ?? { row: 0, column: 0 }))
  return axes.centre?.row === at.row && axes.centre?.column === at.column ? straight : { ...straight, centre: at }
}

/** Whether the open Canvas mirrors a gesture (ticket 0704): Mirror mode with a straight Axis on and placed, or Radial
 * on with its centre placed in either mode (ticket 0705: a turn needs no edge, as a Repeat's strip does). */
export function canvasMirrors(project: Layered, setting: MirrorSetting): boolean {
  const axes = canvasAxesOf(project)
  if (!isMirrorOn(setting)) return false
  if (setting.axes.radial) return axes.centre !== undefined
  return setting.mode === 'mirror' && MIRROR_DIRECTIONS.some((direction) => setting.axes[direction] && axes[direction] !== undefined)
}

/** Stored Canvas Axes read back: each direction's number snapped as the handle snaps, one that is no finite number left
 * out, the centre likewise; none for a value that holds nothing readable. */
export function readCanvasAxes(stored: unknown): CanvasAxes | undefined {
  const value = stored as Partial<Record<MirrorDirection, unknown>> & { centre?: Partial<RadialCentre> | null } | null
  if (typeof value !== 'object' || value === null) return undefined
  const read = MIRROR_DIRECTIONS.filter((direction) => Number.isFinite(value[direction])).map((direction) => [direction, snapAxis(value[direction] as number)])
  const centre = value.centre
  const placed = typeof centre === 'object' && centre !== null && Number.isFinite(centre.row) && Number.isFinite(centre.column) ? snapCentre({ row: centre.row!, column: centre.column! }) : undefined
  return read.length > 0 || placed ? { ...Object.fromEntries(read), ...(placed ? { centre: placed } : {}) } : undefined
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

/** Every position a position maps to under the setting, itself first. */
type PositionImages = (position: GridPosition) => GridPosition[]

/** The straight Axes' images as one map: each row image with each column image. */
function straightImages(by: Record<MirrorDirection, IndexImages>): PositionImages {
  return (position) => by.topBottom(position.row).flatMap((row) => by.leftRight(position.column).map((column) => ({ row, column })))
}

// Radial (ticket 0705, spec 0702): a turn about a centre, Fold images in all. At Fold 2 and 4 by index, as Rotate
// turns a fragment (ADR 0052), so peyote and brick keep their index and take the grid's shift; at 3 and 5 to 8
// geometric, each image taken in one shot from the source bead's centre and the nearest bead taking it.

/** The position a quarter turn clockwise about the centre sends a position to, by index: rows and columns swap about
 * the centre. Where it sits on a position one way and between two the other (rows and columns of different parity)
 * the turn lands between positions and rounds as Rotate rounds a fragment, so four turns still come back. */
function quarterTurned({ row, column }: GridPosition, centre: RadialCentre): GridPosition {
  const skew = centre.row - centre.column
  const turned = { row: column + skew, column: centre.row + centre.column - row }
  if (Number.isInteger(skew)) return turned
  return skew > 0 ? { row: Math.floor(turned.row), column: Math.floor(turned.column) } : { row: Math.ceil(turned.row), column: Math.ceil(turned.column) }
}

/** The position's reflection across the vertical through the centre, by index. */
function reflectedAbout({ row, column }: GridPosition, centre: RadialCentre): GridPosition {
  return { row, column: 2 * centre.column - column }
}

/** Fold 2 and 4 by index: the source, its turns (a half turn is two quarters), and in Mirror mode the turns of its
 * reflection too (Fold 4 on a loom grid: the eightfold kaleidoscope, the diagonals as index swaps). */
function indexTurns(setting: MirrorSetting, centre: RadialCentre): PositionImages {
  const quarters = 4 / setting.fold
  const turns = (from: GridPosition): GridPosition[] => {
    const images = [from]
    for (let turn = 1; turn < setting.fold; turn++) {
      let next = images[images.length - 1]!
      for (let quarter = 0; quarter < quarters; quarter++) next = quarterTurned(next, centre)
      images.push(next)
    }
    return images
  }
  return (position) => [...turns(position), ...(setting.mode === 'mirror' ? turns(reflectedAbout(position, centre)) : [])]
}

/** A centre's point in the layer's bead widths from its first position's corner: a Frame's is the box round its beads'
 * middle; the Canvas's is its handle's, on the lattice the straight Axes lie on (a position's centre at a whole row or
 * column, a boundary at a half). */
function centrePoint(sheet: LayerSheet, centre: RadialCentre): { x: number; y: number } {
  const description = describeWeave(sheet.weave)
  const height = description.cellAspect
  if (sheet.edge) {
    const box = description.blockBox(sheet.edge, 1, height)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const origin = description.center({ row: 0, column: 0 }, 1, height)
  return { x: origin.x + centre.column, y: origin.y + centre.row * description.rowPitch * height }
}

/** The other Folds, geometric: the source bead's centre turned about the centre's point by 360° over the Fold, each
 * image from the source itself (never chained, so snapping cannot drift), and in Mirror mode every turn of its
 * reflection across the vertical through the centre too; the nearest bead takes each, so near the centre images merge. */
function geometricTurns(sheet: LayerSheet, setting: MirrorSetting, centre: RadialCentre): PositionImages {
  const description = describeWeave(sheet.weave)
  const height = description.cellAspect
  const about = centrePoint(sheet, centre)
  const step = (2 * Math.PI) / setting.fold
  const turnsOf = (point: { x: number; y: number }, from: number): GridPosition[] => {
    const dx = point.x - about.x
    const dy = point.y - about.y
    const images: GridPosition[] = []
    for (let turn = from; turn < setting.fold; turn++) {
      const angle = turn * step
      const x = about.x + dx * Math.cos(angle) - dy * Math.sin(angle)
      const y = about.y + dx * Math.sin(angle) + dy * Math.cos(angle)
      images.push(description.nearestPosition(x, y, 1, height))
    }
    return images
  }
  return (position) => {
    const point = description.center(position, 1, height)
    const own = [position, ...turnsOf(point, 1)]
    return setting.mode === 'mirror' ? [...own, ...turnsOf({ x: 2 * about.x - point.x, y: point.y }, 0)] : own
  }
}

/** Radial's images on a layer laid on a grid about a centre (the seam an Area, ticket 0710, or a layout, 0706, passes
 * its own centre through): by index at Fold 2 and 4, geometric otherwise. */
function radialImages(sheet: LayerSheet, setting: MirrorSetting, centre: RadialCentre): PositionImages {
  return foldByIndex(setting.fold) ? indexTurns(setting, centre) : geometricTurns(sheet, setting, centre)
}

/** Where Radial turns about on the layer: a Frame's own centre, or the Canvas's placed handle; none without. */
function radialCentreOf(sheet: LayerSheet): RadialCentre | undefined {
  return sheet.edge ? frameCentre(sheet.edge) : sheet.axes?.centre
}

/** How the layer maps a position under the setting, or nothing where it has no Axis to map by: Radial about its centre
 * when that is on, else the straight Axes by index. */
function imagesOf(sheet: LayerSheet, setting: MirrorSetting): PositionImages | undefined {
  if (!isMirrorOn(setting) || !sheet.geometry.grid) return undefined
  if (setting.axes.radial) {
    const centre = radialCentreOf(sheet)
    return centre && radialImages(sheet, setting, centre)
  }
  const by = imagesBy(sheet, setting)
  return by && straightImages(by)
}

/** The positions a gesture changes under Mirror, on one layer (spec 0702): the sources as given, then their counterparts
 * on the layer's grid (`imagesOf`), each once, a source keeping what rides on it (a Paste's color); `dropped` counts
 * those the layer has no position for. A Custom frame (ticket 0706) gives the sources alone, as yet. */
export function counterparts<T extends GridPosition>(sheet: LayerSheet, setting: MirrorSetting, positions: readonly T[]): { positions: T[]; dropped: number } {
  const { edge, geometry } = sheet
  const images = imagesOf(sheet, setting)
  if (!images) {
    return { positions: [...positions], dropped: 0 }
  }

  const taken = new Set(positions.map(({ row, column }) => `${row}:${column}`))
  const result = [...positions]
  let dropped = 0
  for (const source of positions) {
    if (edge && !frameContains(edge, source)) continue
    for (const { row, column } of images(source)) {
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
  return { positions: result, dropped }
}

/** `counterparts` for Canvas positions (the hover preview, ticket 0703): those on the Frame are mapped through the
 * Frame's own positions and come back as Canvas positions naming their layer; the Canvas's own across the Canvas's
 * Axes (ticket 0704), a counterpart the keep-out margin or a finished row refuses left out, as the Edit drops it. */
export function mirroredOnCanvas<T extends GridPosition>(project: Project, setting: MirrorSetting, cells: readonly T[]): T[] {
  if (!isMirrorOn(setting)) return [...cells]
  const framed = frameOf(project) !== undefined
  const onFrame = cells.filter((cell) => framed && layerAt(project, cell) === 'frame')
  const onCanvas = new Set(cells.filter((cell) => !framed || layerAt(project, cell) !== 'frame'))
  const placeable = (cell: T) => onCanvas.has(cell) || mayPlace(project, cell)
  const mirroredCanvas = onCanvas.size > 0 ? counterparts(layerSheet(project, 'canvas'), setting, [...onCanvas]).positions.filter(placeable) : []
  if (onFrame.length === 0) return mirroredCanvas
  const sheet = layerSheet(project, 'frame')
  const local = onFrame.map((cell) => ({ ...cell, ...positionInLayer(project, 'frame', cell) }))
  const mirrored = counterparts(sheet, setting, local).positions.map((cell) => ({ ...cell, ...positionOnCanvas(project, 'frame', cell), layer: 'frame' as const }))
  return [...mirroredCanvas, ...mirrored]
}

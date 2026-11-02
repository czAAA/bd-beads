import { frameContains, type Rect } from './canvas'
import { beadUnder, layoutPosition, type FrameLayout, type LayoutPoint, type LayoutSymmetry } from './frameLayout'
import { frameLayoutOf } from './frameShape'
import type { GridPosition } from './grid'
import { layerAt, layerSheet, positionInLayer, positionOnCanvas, type LayerSheet } from './layers'
import { frameOf, type Layered } from './layerRecord'
import { mayPlace } from './margin'
import { touch, type Project } from './project'
import { describeWeave, type Weave } from './weave'

// Mirror (ADR 0082, spec 0702; tickets 0703, 0750): the live mode that lands a drawing gesture at its counterparts,
// one per Project, inside its Area. This module owns the record and the counterpart maths, positions in and positions
// out; the callers of `paintCells` (the Paint stroke, Fill, Paste) and the hover preview all ask `counterparts`.

/** How Mirror lays a counterpart (glossary: Mirror mode): a reflection, or the same way round. No Off: Close mirror is
 * the way out (ADR 0082). */
export type MirrorMode = 'mirror' | 'repeat'
export const MIRROR_MODES: readonly MirrorMode[] = ['mirror', 'repeat']

/** A direction a straight Axis runs across (glossary: Axis): Left–right is a vertical line reflecting columns,
 * Top–bottom a horizontal one reflecting rows. */
export type MirrorDirection = 'leftRight' | 'topBottom'
const MIRROR_DIRECTIONS: readonly MirrorDirection[] = ['leftRight', 'topBottom']

/** What Mirror maps across: the two straight Axes, or Radial (ticket 0705). */
export type MirrorAxis = MirrorDirection | 'radial'
export const MIRROR_AXES: readonly MirrorAxis[] = [...MIRROR_DIRECTIONS, 'radial']

/** Radial's image count (ticket 0705): 2 to 8, of which a grid takes 2 and 4 (ticket 0751) and a round Custom frame its
 * side count. */
export const MIN_FOLD = 2
const MAX_FOLD = 8
/** The most a grid takes: the quarter turn (ticket 0751). */
export const MAX_GRID_FOLD = 4

/** Where the Mirror is (glossary: Area): a rectangle of the Canvas, in its positions, or the whole Frame, never a
 * smaller part of it (ADR 0082). */
export type MirrorPlace = { layer: 'canvas'; area: Rect } | { layer: 'frame' }

/** The Mirror, one per Project (ADR 0082): the Mode, the Axes, Radial's Fold, the Axis counts (N axes cut the Area into
 * N + 1 equal strips) and its place. Saved with the Project, off by default. */
export interface MirrorSetting {
  mode: MirrorMode
  axes: Record<MirrorAxis, boolean>
  fold: number
  counts: Record<MirrorDirection, number>
  /** The straight Axes as they were when Radial went on (ticket 0705): Radial on turns them off and remembers them
   * here, Radial off brings them back. Absent while Radial has not been on. */
  beforeRadial?: Record<MirrorDirection, boolean>
  /** Where the Mirror is while it is on; null once closed, so a file tells it apart from the first form's record,
   * which never had one (`readMirrorSetting`). Absent on a Project that never had a Mirror. */
  place?: MirrorPlace | null
}

/** The Mirror as a new Project has it: off, Mirror mode, one axis per direction, no Axis yet (the first Mirror takes
 * Left–right, `withMirrorPlace`). */
export const MIRROR_OFF: MirrorSetting = { mode: 'mirror', axes: { leftRight: false, topBottom: false, radial: false }, fold: MIN_FOLD, counts: { leftRight: 1, topBottom: 1 } }

/** The open Project's Mirror; off for one saved without, and for a whole-Frame one whose Frame is gone. */
export function mirrorSettingOf(project: Layered & Pick<Project, 'mirror'>): MirrorSetting {
  const setting = project.mirror ?? MIRROR_OFF
  if (setting.place?.layer !== 'frame') return setting
  const frame = frameOf(project)
  if (!frame) return { ...setting, place: null }
  // A whole Frame that is a grid takes only the turns a grid does (ticket 0751); a Custom frame keeps its side count.
  return shapeAxesOf(project) ? setting : { ...setting, fold: gridFold(setting.fold, { row: 0, column: 0, rows: frame.rows, columns: frame.columns }) }
}

/** The Project with the Mirror bar's settings (Mode, Axes, counts) taken, its place as it is. Not an Undo step: a
 * setting, like Letters (useExportFlow). */
export function withMirror(project: Project, mirror: MirrorSetting): Project {
  return { ...project, mirror: { ...mirror, place: mirrorSettingOf(project).place ?? null } }
}

/** Whether the Mirror is on: it has a place, so the tile is lit, the bar shows and a gesture inside it is mirrored. */
export function isMirrorOn(setting: MirrorSetting): boolean {
  return !!setting.place
}

/** What the Mirror's place offers the bar (ticket 0775): its grid Area's `mirrorFit`; none while it is off, or on a Frame
 * that is no grid (a Custom frame takes its shape's own Axes). */
export function mirrorFitOf(project: Project, setting: MirrorSetting): MirrorFit | undefined {
  const place = setting.place
  const rect = place ? placeRect(project, place) : undefined
  if (!place || !rect) return undefined
  const sheet = layerSheet(project, place.layer)
  return sheet.geometry.grid ? mirrorFit(sheet.weave, rect, setting.mode) : undefined
}

/** The Rect a Mirror place covers in its layer's own positions: the Canvas Area, or the Frame's rectangle from its first
 * row and column; none for a Frame the Project does not have. */
export function placeRect(project: Layered, place: MirrorPlace): Rect | undefined {
  if (place.layer === 'canvas') return place.area
  const frame = frameOf(project)
  return frame && { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
}

/** The Project with the Mirror made, moved or resized to a place, or closed with none (ADR 0082): one Undo step, which
 * the caller's `edit` makes. A new place keeps the Mode and Axes, its counts clamped to it; onto a Custom frame the Axes
 * become the shape's own, off one Left–right; a Mirror with no Axis takes Left–right. Closed, the rest is kept. */
export function withMirrorPlace(project: Project, place: MirrorPlace | undefined): Project {
  const before = mirrorSettingOf(project)
  if (!place) return touch(project, { mirror: { ...before, place: null } })
  const shape = place.layer === 'frame' ? shapeAxesOf(project) : undefined
  // Leaving a Custom frame, straight off it or after Close mirror there, its fixed Axes stay behind (Left–right).
  const left = !shape ? shapeAxesOf(project) : undefined
  const offShape = !!left && (before.place?.layer === 'frame' || (!before.place && MIRROR_AXES.every((axis) => before.axes[axis] === left.axes[axis]) && before.fold === (left.sides ?? before.fold)))
  const anyAxis = MIRROR_AXES.some((axis) => before.axes[axis])
  const { beforeRadial, ...rest } = before
  const axes = shape ? shape.axes : offShape || !anyAxis ? { leftRight: true, topBottom: false, radial: false } : before.axes
  const rect = placeRect(project, place)
  const limit = (direction: MirrorDirection) => (rect ? maxAxisCount(direction === 'leftRight' ? rect.columns : rect.rows) : Infinity)
  const counts = { leftRight: Math.min(before.counts.leftRight, limit('leftRight')), topBottom: Math.min(before.counts.topBottom, limit('topBottom')) }
  const gridPlace = shape ? undefined : rect
  const fold = shape ? (shape.sides ?? before.fold) : gridFold(before.fold, gridPlace)
  const kept = shape || offShape ? {} : beforeRadial ? { beforeRadial } : {}
  return touch(project, { mirror: { ...rest, ...kept, axes, counts, fold, place } })
}

/** A stored Mirror read back (ADR 0082): each field as a file may have left it, anything unreadable at its default; none
 * for a value that is no Mirror at all, which reads as off. The first form's record (tickets 0703–0710, no `place`) is
 * placed as it acted: its Canvas Area as the Mirror, else on a Frame the whole Frame, else off; its Off stays off. */
export function readMirrorSetting(stored: unknown, firstForm: { canvasArea?: Rect; framed: boolean }): MirrorSetting | undefined {
  const value = stored as (Partial<Omit<MirrorSetting, 'mode'>> & { mode?: unknown }) | null
  if (typeof value !== 'object' || value === null || !['off', ...MIRROR_MODES].includes(value.mode as string)) return undefined
  const axes = (value.axes ?? {}) as Partial<Record<MirrorAxis, unknown>>
  const counts = (value.counts ?? {}) as Partial<Record<MirrorDirection, unknown>>
  const count = (direction: MirrorDirection) => (Number.isInteger(counts[direction]) && (counts[direction] as number) >= 1 ? (counts[direction] as number) : 1)
  const before = value.beforeRadial as Partial<Record<MirrorDirection, unknown>> | undefined
  const place = 'place' in value ? readMirrorPlace(value.place) : firstFormPlace(value.mode === 'off', firstForm)
  // On a Canvas Area the Fold is a grid's (ticket 0751); a whole-Frame one is narrowed by `mirrorSettingOf`, which knows
  // whether the Frame is a Custom frame (its side count is the Fold).
  const fold = place?.layer === 'canvas' ? gridFold(clampFold(value.fold), place.area) : clampFold(value.fold)
  return {
    mode: value.mode === 'repeat' ? 'repeat' : 'mirror',
    axes: { leftRight: axes.leftRight === true, topBottom: axes.topBottom === true, radial: axes.radial === true },
    fold,
    counts: { leftRight: count('leftRight'), topBottom: count('topBottom') },
    ...(typeof before === 'object' && before !== null ? { beforeRadial: { leftRight: before.leftRight === true, topBottom: before.topBottom === true } } : {}),
    place,
  }
}

/** A stored place read back: the whole Frame, or a Canvas Area of whole beads; anything else is closed. */
function readMirrorPlace(stored: unknown): MirrorPlace | null {
  const value = stored as { layer?: unknown; area?: unknown } | null
  if (value?.layer === 'frame') return { layer: 'frame' }
  const area = value?.layer === 'canvas' ? readMirrorArea(value.area) : undefined
  return area ? { layer: 'canvas', area } : null
}

/** Where the first form's Mirror acted (ADR 0082): nowhere while Off; its Canvas Area; else a Frame's whole Frame. */
function firstFormPlace(off: boolean, { canvasArea, framed }: { canvasArea?: Rect; framed: boolean }): MirrorPlace | null {
  if (off) return null
  if (canvasArea) return { layer: 'canvas', area: canvasArea }
  return framed ? { layer: 'frame' } : null
}

/** A stored Area read back: a whole rectangle of at least one bead, else none. */
export function readMirrorArea(stored: unknown): Rect | undefined {
  const value = stored as Partial<Rect> | null
  if (typeof value !== 'object' || value === null) return undefined
  const { row, column, rows, columns } = value
  const whole = [row, column, rows, columns].every((field) => Number.isInteger(field))
  return whole && (rows as number) >= 1 && (columns as number) >= 1 ? { row: row!, column: column!, rows: rows!, columns: columns! } : undefined
}

/** A Fold within the Stepper's range, 2 to 8; the least for anything that is no whole number. */
function clampFold(fold: unknown): number {
  return Number.isInteger(fold) ? Math.min(MAX_FOLD, Math.max(MIN_FOLD, fold as number)) : MIN_FOLD
}

export function withMirrorMode(setting: MirrorSetting, mode: MirrorMode): MirrorSetting {
  return { ...setting, mode }
}

/** An Axis chip pressed (ContextBar card, Mirror bar): Radial on turns the straight Axes off and remembers them; Radial
 * off brings them back (Left–right if none were); a straight Axis on turns Radial off. At least one Axis stays on, so
 * pressing the last one on changes nothing. */
export function withAxisToggled(setting: MirrorSetting, axis: MirrorAxis): MirrorSetting {
  const on = !setting.axes[axis]
  if (axis === 'radial') {
    const { leftRight, topBottom } = setting.axes
    const { beforeRadial: before, ...rest } = setting
    if (on) return { ...rest, axes: { leftRight: false, topBottom: false, radial: true }, beforeRadial: { leftRight, topBottom } }
    const back = before && (before.leftRight || before.topBottom) ? before : { leftRight: true, topBottom: false }
    return { ...rest, axes: { ...back, radial: false } }
  }
  const axes = { ...setting.axes, ...(on ? { radial: false } : {}), [axis]: on }
  return MIRROR_AXES.some((each) => axes[each]) ? { ...setting, axes } : setting
}

/** A direction's Axis count as the Stepper sets it, never under one; the Area's own limit applies where it is used. */
export function withMirrorCount(setting: MirrorSetting, direction: MirrorDirection, count: number): MirrorSetting {
  return { ...setting, counts: { ...setting.counts, [direction]: Math.max(1, Math.round(count)) } }
}

/** Whether a rectangle is as many beads across as down: what a quarter turn needs. */
function isSquare(rect: Rect): boolean {
  return rect.rows === rect.columns
}

/** A Fold as a grid takes it (ticket 0751): a half turn or a quarter turn, the two a grid maps exactly. Fold 2 stays; any
 * other reads as 4, which a rectangle that is not square clamps to 2. With no rectangle known, 4 stands. */
function gridFold(fold: number, rect?: Rect): number {
  if (fold === MIN_FOLD) return MIN_FOLD
  return rect && !isSquare(rect) ? MIN_FOLD : MAX_GRID_FOLD
}

/** Radial's Fold as the Stepper sets it on a grid: 2 or 4 (a press from 2 goes to 4). */
export function withMirrorFold(setting: MirrorSetting, fold: number): MirrorSetting {
  return { ...setting, fold: gridFold(clampFold(Math.round(fold))) }
}

/** A rectangle's own centre (spec 0702), the Area's: on its middle position for an odd size, between four for an even
 * one. */
function rectCentre(rect: Rect): GridPosition {
  return { row: rect.row + (rect.rows - 1) / 2, column: rect.column + (rect.columns - 1) / 2 }
}

/** The region the Mirror rules run inside on a layer: a Custom frame's layout (ticket 0706, geometric about its own
 * centre) or the Area's rectangle (the Frame's own for the whole Frame); none on a layer the Mirror is not on. */
type MirrorRegion = { kind: 'layout'; layout: FrameLayout } | { kind: 'rect'; rect: Rect }

function mirrorRegionOf(sheet: LayerSheet, setting: MirrorSetting): MirrorRegion | undefined {
  const place = setting.place
  if (!place) return undefined
  if (place.layer === 'canvas') return sheet.edge ? undefined : { kind: 'rect', rect: place.area }
  if (!sheet.edge) return undefined
  const layout = sheet.frame?.shape ? frameLayoutOf(sheet.frame) : undefined
  return layout ? { kind: 'layout', layout } : { kind: 'rect', rect: sheet.edge }
}

/** Whether the Mirror is on the Canvas (ticket 0750): a Canvas command then paints its counterparts, hidden, where the
 * Frame covers them (spec 0702's Edges). */
export function canvasMirrors(setting: MirrorSetting): boolean {
  return setting.place?.layer === 'canvas'
}

/** The most axes a direction with this many beads across can take (ticket 0044): every axis has a bead on each side;
 * one for a direction of one bead. */
function maxAxisCount(cellsAcross: number): number {
  return Math.max(1, cellsAcross - 1)
}

/** The axis positions along a direction of `cellsAcross` beads cut by `count` axes, in bead widths from its first
 * edge: where the overlay draws the lines. */
function axisOffsets(cellsAcross: number, count: number): number[] {
  const strips = Math.min(count, maxAxisCount(cellsAcross)) + 1
  return Array.from({ length: strips - 1 }, (_axis, index) => (cellsAcross * (index + 1)) / strips)
}

// Peyote and brick (ticket 0775, spec 0702): every other line, or block of lines, sits half a bead along, peyote's
// columns down and brick's rows across. A counterpart is found by the bead's centre, so a shifted line's bead keeps its
// offset, and what the shift has no exact image for is off (`mirrorFit`). On loom this is the index rule.

/** A grid's half-bead shift as Mirror reads it: the direction whose Axis moves a bead into another line (`along`:
 * Left–right on peyote, whose columns shift; Top–bottom on brick), how far a line sits along, in beads, and after how
 * many lines that repeats. None on loom. */
interface Stagger {
  along: MirrorDirection
  offset: (line: number) => number
  cycle: number
}

function staggerOf(weave: Weave): Stagger | undefined {
  const description = describeWeave(weave)
  if (!description.shifted) return undefined
  return description.staggers === 'columns'
    ? { along: 'leftRight', offset: (column) => description.columnOffset(column, 1), cycle: description.columnCycle }
    : { along: 'topBottom', offset: (row) => description.rowOffset(row, 1), cycle: description.rowCycle }
}

/** A rectangle's lines across a direction (Left–right reflects columns): the first, and how many. */
interface Lines {
  first: number
  count: number
}

function linesOf(rect: Rect, direction: MirrorDirection): Lines {
  return direction === 'leftRight' ? { first: rect.column, count: rect.columns } : { first: rect.row, count: rect.rows }
}

/** Whether the shift mirrors onto itself across the line at `doubled` / 2 lines from line 0's leading edge, line `l`
 * landing on `doubled - 1 - l`. One cycle tells, the shift repeating. */
function shiftMirrors(stagger: Stagger, doubled: number): boolean {
  for (let line = 0; line < stagger.cycle; line++) if (stagger.offset(line) !== stagger.offset(doubled - 1 - line)) return false
  return true
}

/** Whether `count` Axes along the shift keep every line's offset: in Mirror mode each Axis on a line the shift mirrors
 * onto itself (through the middle of a column on 1-drop peyote), in Repeat each strip a whole number of the shift's
 * cycles. Either way the strips are whole, so nothing rounds. */
function countKeepsShift(stagger: Stagger, lines: Lines, count: number, mode: MirrorMode): boolean {
  const strips = count + 1
  if (mode === 'repeat') return lines.count % strips === 0 && (lines.count / strips) % stagger.cycle === 0
  if ((2 * lines.count) % strips !== 0) return false
  for (let axis = 1; axis < strips; axis++) if (!shiftMirrors(stagger, 2 * lines.first + (2 * lines.count * axis) / strips)) return false
  return true
}

/** Whether a half turn keeps every line's offset: every line and the one it turns onto sit alike, or every pair
 * differently (the centre then a quarter bead along, `halfTurned`); in Mirror mode the reflection along the shift too. */
function halfTurnKeepsShift(stagger: Stagger, lines: Lines, mode: MirrorMode): boolean {
  if (mode === 'mirror' && !countKeepsShift(stagger, lines, 1, 'mirror')) return false
  const pairs = new Set<number>()
  for (let line = lines.first; line < lines.first + lines.count; line++) pairs.add((stagger.offset(line) + stagger.offset(2 * lines.first + lines.count - 1 - line)) % 1)
  return pairs.size <= 1
}

/** Why an Axis chip is off on a grid: the Area is one bead across its direction, or the half-bead shift has no exact
 * image there (ticket 0775). */
type MirrorOffReason = 'oneBead' | 'shift'

/** What a grid Area offers the Mirror (spec 0702, ticket 0775): each straight direction's Axis counts, ascending, and
 * Radial's Folds; none, with the reason in `off`, for an Axis whose chip is off. */
export interface MirrorFit {
  counts: Record<MirrorDirection, readonly number[]>
  off: Partial<Record<MirrorAxis, MirrorOffReason>>
  folds: readonly number[]
  /** Why Radial offers no quarter turn: an Area that is not square, or the half-bead shift, which a quarter turn would
   * turn from columns to rows. */
  quarterOff?: 'square' | 'shift'
}

/** What a rectangle of a Weave's grid offers the Mirror in a Mode: on loom every count to its beads across minus one,
 * Fold 4 in a square; on peyote and brick only what lands every counterpart on a bead (ticket 0775).
 * @internal The app asks `mirrorFitOf`; tests ask this with a bare Weave and rectangle. */
export function mirrorFit(weave: Weave, rect: Rect, mode: MirrorMode): MirrorFit {
  const stagger = staggerOf(weave)
  const off: MirrorFit['off'] = {}
  const countsOf = (direction: MirrorDirection): number[] => {
    const lines = linesOf(rect, direction)
    if (lines.count <= 1) {
      off[direction] = 'oneBead'
      return []
    }
    const all = Array.from({ length: maxAxisCount(lines.count) }, (_count, index) => index + 1)
    if (stagger?.along !== direction) return all
    const kept = all.filter((count) => countKeepsShift(stagger, lines, count, mode))
    if (kept.length === 0) off[direction] = 'shift'
    return kept
  }
  const counts = { leftRight: countsOf('leftRight'), topBottom: countsOf('topBottom') }
  const halfTurn = !stagger || halfTurnKeepsShift(stagger, linesOf(rect, stagger.along), mode)
  if (!halfTurn) off.radial = 'shift'
  const quarterOff = stagger ? 'shift' : isSquare(rect) ? undefined : 'square'
  const folds = !halfTurn ? [] : quarterOff ? [MIN_FOLD] : [MIN_FOLD, MAX_GRID_FOLD]
  return { counts, off, folds, ...(quarterOff ? { quarterOff } : {}) }
}

/** The Axis count a direction uses: the setting's where the Area takes it, else the nearest below it that it takes,
 * else the least; none where its chip is off. */
export function fittedCount(fit: MirrorFit, direction: MirrorDirection, count: number): number | undefined {
  const counts = fit.counts[direction]
  return [...counts].reverse().find((each) => each <= count) ?? counts[0]
}

/** The Fold Radial uses: the setting's as a grid takes it, no more than the Area offers; none where Radial is off. */
function fittedFold(fit: MirrorFit, fold: number, rect: Rect): number | undefined {
  return fit.folds.length === 0 ? undefined : Math.min(gridFold(fold, rect), Math.max(...fit.folds))
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
 * split rounds. `offset`: how far the bead's line sits along, so its centre is reflected (ticket 0775); a shifted line's
 * last bead hangs half past the edge, its image maybe past the other one, which the caller drops. */
function stripCounterparts(index: number, dimension: number, count: number, repeat: boolean, offset = 0): number[] {
  const space = stripSpace(dimension, Math.min(count, maxAxisCount(dimension)) + 1)
  const position = (index + offset) * space.scale + space.strips
  const source = stripAt(position, space)
  const local = reversed(source, repeat) ? (source + 1) * space.stripWidth - position : position - source * space.stripWidth
  const images: number[] = []
  for (let strip = 0; strip < space.strips; strip++) {
    const target = reversed(strip, repeat) ? (strip + 1) * space.stripWidth - local : strip * space.stripWidth + local
    const along = Math.round((target - space.strips) / space.scale - offset)
    const at = offset === 0 ? Math.min(dimension - 1, Math.max(0, along)) : along
    if (!images.includes(at)) images.push(at)
  }
  return images
}

/** Every position a position maps to under the setting, itself first; none for an image that lands on no position (a
 * layout's Seam or Off-shape), which is dropped. */
type PositionImages = (position: GridPosition) => (GridPosition | undefined)[]

/** The straight Axes' images inside a rectangle: its strips from its edges and the fitted counts, each row image with
 * each column image. A direction whose chip is off (`mirrorFit`), or turned off, maps nothing. Across the shift a bead
 * keeps its own line, so its strip maths takes that line's offset (a peyote column's for Top–bottom). */
function straightImages(rect: Rect, setting: MirrorSetting, fit: MirrorFit, stagger: Stagger | undefined): PositionImages | undefined {
  const countOf = (direction: MirrorDirection) => (setting.axes[direction] ? fittedCount(fit, direction, setting.counts[direction]) : undefined)
  const leftRight = countOf('leftRight')
  const topBottom = countOf('topBottom')
  if (leftRight === undefined && topBottom === undefined) return undefined
  const repeat = setting.mode === 'repeat'
  const indexOf = (direction: MirrorDirection, position: GridPosition) => (direction === 'leftRight' ? position.column : position.row)
  const offsetOf = (direction: MirrorDirection, position: GridPosition) => (!stagger || stagger.along === direction ? 0 : stagger.offset(indexOf(stagger.along, position)))
  const strips = (direction: MirrorDirection, count: number | undefined) => (position: GridPosition) => {
    if (count === undefined) return [indexOf(direction, position)]
    const { first, count: across } = linesOf(rect, direction)
    return stripCounterparts(indexOf(direction, position) - first, across, count, repeat, offsetOf(direction, position)).map((image) => image + first)
  }
  const byColumn = strips('leftRight', leftRight)
  const byRow = strips('topBottom', topBottom)
  return (position) => byRow(position).flatMap((row) => byColumn(position).map((column) => ({ row, column })))
}

// Radial on a grid (tickets 0705, 0751, 0775, spec 0702): a turn about the Area's centre, Fold 2 or 4, as Rotate turns
// a fragment (ADR 0052) on loom. On peyote and brick only the half turn, of the bead's centre. No other count maps back.

/** The position a quarter turn clockwise about the centre sends a position to, by index: rows and columns swap about
 * the centre. Where it sits on a position one way and between two the other (rows and columns of different parity)
 * the turn lands between positions and rounds as Rotate rounds a fragment, so four turns still come back. */
function quarterTurned({ row, column }: GridPosition, centre: GridPosition): GridPosition {
  const skew = centre.row - centre.column
  const turned = { row: column + skew, column: centre.row + centre.column - row }
  if (Number.isInteger(skew)) return turned
  return skew > 0 ? { row: Math.floor(turned.row), column: Math.floor(turned.column) } : { row: Math.ceil(turned.row), column: Math.ceil(turned.column) }
}

/** The position's reflection across the vertical through the centre: by index, but a shifted brick row's bead is
 * reflected by its centre, a bead further along (ticket 0775). */
function reflectedAbout({ row, column }: GridPosition, centre: GridPosition, stagger?: Stagger): GridPosition {
  const shift = stagger?.along === 'topBottom' ? 2 * stagger.offset(row) : 0
  return { row, column: 2 * centre.column - column - shift }
}

/** The position a half turn about the centre sends a position to: by index on loom. On peyote and brick the bead's
 * centre is turned (ticket 0775): a line and the one it lands on both shifted sit a bead further back, and where they
 * sit differently the centre is a quarter bead along, so the index stands. */
function halfTurned({ row, column }: GridPosition, centre: GridPosition, stagger?: Stagger): GridPosition {
  const turned = { row: 2 * centre.row - row, column: 2 * centre.column - column }
  if (!stagger) return turned
  const columns = stagger.along === 'leftRight'
  const shift = Math.floor(stagger.offset(columns ? column : row) + stagger.offset(columns ? turned.column : turned.row))
  return columns ? { row: turned.row - shift, column: turned.column } : { row: turned.row, column: turned.column - shift }
}

/** The turns: the source and its turns (Fold 2 the exact half turn; Fold 4 three quarter turns, each from the last, so
 * a rectangle of mixed parity keeps one closed orbit), and in Mirror mode the turns of its reflection too (Fold 4 on a
 * loom grid: the eightfold kaleidoscope, the diagonals as index swaps). */
function gridTurns(setting: MirrorSetting, centre: GridPosition, stagger: Stagger | undefined): PositionImages {
  const turn = setting.fold === 2 ? (position: GridPosition) => halfTurned(position, centre, stagger) : (position: GridPosition) => quarterTurned(position, centre)
  const turns = (from: GridPosition): GridPosition[] => {
    const images = [from]
    for (let image = 1; image < setting.fold; image++) images.push(turn(images[images.length - 1]!))
    return images
  }
  return (position) => [...turns(position), ...(setting.mode === 'mirror' ? turns(reflectedAbout(position, centre, stagger)) : [])]
}

/** Where the overlay draws a grid Area's Mirror (spec 0702, ticket 0775), in beads from the corner of its unshifted
 * lines: each straight Axis at its fitted count, or Radial's centre (a bead's and its half-turn image's middle) and
 * Fold; none for what is off. */
export function mirrorLines(weave: Weave, rect: Rect, setting: MirrorSetting): { leftRight: number[]; topBottom: number[]; radial?: { centre: LayoutPoint; fold: number } } {
  const fit = mirrorFit(weave, rect, setting.mode)
  if (setting.axes.radial) {
    const fold = fittedFold(fit, setting.fold, rect)
    if (fold === undefined) return { leftRight: [], topBottom: [] }
    const stagger = staggerOf(weave)
    const first = { row: rect.row, column: rect.column }
    const centreOf = ({ row, column }: GridPosition): LayoutPoint => ({
      x: column - rect.column + 0.5 + (stagger?.along === 'topBottom' ? stagger.offset(row) : 0),
      y: row - rect.row + 0.5 + (stagger?.along === 'leftRight' ? stagger.offset(column) : 0),
    })
    const [from, to] = [centreOf(first), centreOf(halfTurned(first, rectCentre(rect), stagger))]
    return { leftRight: [], topBottom: [], radial: { centre: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, fold } }
  }
  const offsets = (direction: MirrorDirection) => {
    const count = setting.axes[direction] ? fittedCount(fit, direction, setting.counts[direction]) : undefined
    return count === undefined ? [] : axisOffsets(linesOf(rect, direction).count, count)
  }
  return { leftRight: offsets('leftRight'), topBottom: offsets('topBottom') }
}

// A Custom frame (ticket 0706, spec 0702): every counterpart is geometric, through the shape's layout. Its symmetry
// (`LayoutSymmetry`) is the whole-Frame Mirror's Axes, fixed (ADR 0082), and Radial's Fold, its side count, exact by
// construction.

/** Whether a layout has a mirror line at an angle (clockwise from up): one of its fold's lines, read modulo a half turn. */
function hasLine({ fold, line }: LayoutSymmetry, angle: number): boolean {
  const steps = (angle - line) / (Math.PI / fold)
  return Math.abs(steps - Math.round(steps)) < 1e-6
}

/** The least fold of a round shape (a Triangle's three sides): what Radial needs; a Kite or Fringe earring has one. */
const ROUND_FOLD = 3

/** A shape's own Axes (ADR 0082): Radial on a round shape, else its straight mirror lines (a Kite's Left–right, or
 * Top–bottom once turned a quarter). */
export function shapeOwnAxes(symmetry: LayoutSymmetry): Record<MirrorAxis, boolean> {
  if (symmetry.fold >= ROUND_FOLD) return { leftRight: false, topBottom: false, radial: true }
  return { leftRight: hasLine(symmetry, 0), topBottom: hasLine(symmetry, Math.PI / 2), radial: false }
}

/** A Custom frame's fixed Axes as the Mirror bar notes them (ContextBar card): the shape's own, and on a round shape
 * `sides`, Radial's Fold. */
export interface ShapeAxes {
  axes: Record<MirrorAxis, boolean>
  sides?: number
}

/** The open Project's Frame shape's Axes; none without a Custom frame. */
export function shapeAxesOf(project: Layered): ShapeAxes | undefined {
  const frame = frameOf(project)
  const symmetry = frame?.shape ? frameLayoutOf(frame)?.symmetry : undefined
  if (!symmetry) return undefined
  return { axes: shapeOwnAxes(symmetry), ...(symmetry.fold >= ROUND_FOLD ? { sides: symmetry.fold } : {}) }
}

/** A point turned about a centre by an angle, clockwise on screen. */
function turnedAbout({ x, y }: LayoutPoint, centre: LayoutPoint, angle: number): LayoutPoint {
  const [dx, dy] = [x - centre.x, y - centre.y]
  return { x: centre.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: centre.y + dx * Math.sin(angle) + dy * Math.cos(angle) }
}

/** A point reflected across the line through a centre at an angle clockwise from up. */
function reflectedAcross({ x, y }: LayoutPoint, centre: LayoutPoint, angle: number): LayoutPoint {
  const [dx, dy] = [x - centre.x, y - centre.y]
  const along = dx * Math.sin(angle) - dy * Math.cos(angle)
  return { x: centre.x + 2 * along * Math.sin(angle) - dx, y: centre.y - 2 * along * Math.cos(angle) - dy }
}

/** A Custom frame's images (ticket 0706) under its own Axes: the bead's centre reflected across a straight line through
 * the layout's centre or turned about it by the fold (in Mirror mode its reflection across the first mirror line turned
 * too), the bead under each point taking it as Paste lands one, none on a Seam. A straight line in Repeat maps nothing. */
function layoutImages(layout: FrameLayout, setting: MirrorSetting): PositionImages | undefined {
  const { symmetry, centre } = layout
  if (!symmetry) return undefined
  const axes = shapeOwnAxes(symmetry)
  const mirror = setting.mode === 'mirror'
  let pointsOf: (point: LayoutPoint) => LayoutPoint[]
  if (axes.radial) {
    const step = (2 * Math.PI) / symmetry.fold
    const turns = Array.from({ length: symmetry.fold }, (_turn, turn) => turn * step)
    pointsOf = (point) => [point, ...(mirror ? [reflectedAcross(point, centre, symmetry.line)] : [])].flatMap((from) => turns.map((angle) => turnedAbout(from, centre, angle)))
  } else {
    if (!mirror || !(axes.leftRight || axes.topBottom)) return undefined
    pointsOf = ({ x, y }) => (axes.topBottom ? [y, 2 * centre.y - y] : [y]).flatMap((imageY) => (axes.leftRight ? [x, 2 * centre.x - x] : [x]).map((imageX) => ({ x: imageX, y: imageY })))
  }
  return (position) => {
    const from = layoutPosition(layout, position)
    if (!from) return []
    return pointsOf(from).map(({ x, y }) => {
      const under = beadUnder(layout, x, y)
      return under && { row: under.row, column: under.column }
    })
  }
}

/** How the layer maps a position inside its region, or nothing where it has no Axis to map by: a layout's geometry on a
 * Custom frame; else Radial about the Area's centre when that is on, else the straight Axes, each as the Area offers it
 * (`mirrorFit`). */
function imagesOf(sheet: LayerSheet, region: MirrorRegion, setting: MirrorSetting): PositionImages | undefined {
  if (region.kind === 'layout') return layoutImages(region.layout, setting)
  if (!sheet.geometry.grid) return undefined
  const fit = mirrorFit(sheet.weave, region.rect, setting.mode)
  const stagger = staggerOf(sheet.weave)
  if (!setting.axes.radial) return straightImages(region.rect, setting, fit, stagger)
  const fold = fittedFold(fit, setting.fold, region.rect)
  return fold === undefined ? undefined : gridTurns({ ...setting, fold }, rectCentre(region.rect), stagger)
}

/** The positions a gesture changes under Mirror, on one layer (spec 0702): the sources as given, then their counterparts
 * inside the Area (`imagesOf`), each once, a source keeping what rides on it (a Paste's color); a source outside the Area
 * is not mirrored, `dropped` counts counterparts off the layer or outside the Area, or on a Seam or Off-shape (0706). */
export function counterparts<T extends GridPosition>(sheet: LayerSheet, setting: MirrorSetting, positions: readonly T[]): { positions: T[]; dropped: number } {
  const { geometry } = sheet
  const region = mirrorRegionOf(sheet, setting)
  const images = region && imagesOf(sheet, region, setting)
  if (!images) {
    return { positions: [...positions], dropped: 0 }
  }

  const bounds = region.kind === 'rect' ? region.rect : undefined
  const taken = new Set(positions.map(({ row, column }) => `${row}:${column}`))
  const result = [...positions]
  let dropped = 0
  for (const source of positions) {
    if (bounds && !frameContains(bounds, source)) continue
    for (const image of images(source)) {
      if (!image) {
        dropped += 1
        continue
      }
      const { row, column } = image
      const key = `${row}:${column}`
      if (taken.has(key)) continue
      taken.add(key)
      if (!geometry.hasPosition({ row, column }) || (bounds && !frameContains(bounds, { row, column }))) {
        dropped += 1
        continue
      }
      result.push({ ...source, row, column })
    }
  }
  return { positions: result, dropped }
}

/** `counterparts` for Canvas positions (the hover preview, ticket 0703): those on the Frame are mapped through the
 * Frame's own positions and come back as Canvas positions naming their layer; the Canvas's own inside a Canvas Area, a
 * counterpart the keep-out margin or a finished row refuses left out, as the Edit drops it. */
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

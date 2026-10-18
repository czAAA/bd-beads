/** The strip-splitting math behind rich Mirror (ticket 44, ADR 0006 amendment): N axes split a dimension into N+1
 * strips "as equal as possible", neighbours reading as mirror images. Grid-space only: which screen direction
 * `columns`/`rows` map to is a view concern (Toolbox.vue), swapped on rotation (see Project.rotation). */

/** Per-direction Mirror axis counts, in grid space. `columns` splits the grid across its columns ("horizontal"/
 * left-right-when-unrotated mirror); `rows` splits it across its rows ("vertical"/top-bottom-when-unrotated
 * mirror). */
export interface MirrorAxisCounts {
  columns: number
  rows: number
}

/** A direction as seen on screen. */
export type ScreenDirection = 'leftRight' | 'topBottom'

/** The grid-space axis a screen direction drives: a quarter turn (`swapped`) swaps the two, never the counts
 * themselves. */
export function gridAxisOfDirection(direction: ScreenDirection, swapped: boolean): 'columns' | 'rows' {
  return (direction === 'leftRight') !== swapped ? 'columns' : 'rows'
}

export const NO_MIRROR_AXES: MirrorAxisCounts = { columns: 0, rows: 0 }

/** The largest axis count a direction with this many cells across it can take: every axis needs at least one cell on
 * each side (ticket 44 decision). */
export function maxAxisCount(cellsAcross: number): number {
  return Math.max(0, cellsAcross - 1)
}

/** Keeps an axis count inside [0, maxAxisCount(cellsAcross)], e.g. after the Project's size changes. */
export function clampAxisCount(count: number, cellsAcross: number): number {
  return Math.min(maxAxisCount(cellsAcross), Math.max(0, count))
}

/** Shared coordinate space for the strip computations: integer units doubled (half-integer cell centers) and scaled
 * by the strip count (strip-width fraction), so every intermediate is an exact integer, with no float drift. */
interface StripSpace {
  strips: number
  /** A cell index's position, once encoded via toPosition, advances by this much per index. */
  scale: number
  /** How much position one strip spans. */
  stripWidth: number
}

function stripSpace(dimension: number, axisCount: number): StripSpace {
  const strips = axisCount + 1
  return { strips, scale: 2 * strips, stripWidth: 2 * dimension }
}

/** Encodes a cell index as its half-integer center's position in the doubled/scaled space above. */
function toPosition(index: number, space: StripSpace): number {
  return index * space.scale + space.strips
}

/** Decodes a position back to a cell index, clamped into the grid. */
function toIndex(position: number, dimension: number, space: StripSpace): number {
  return Math.min(dimension - 1, Math.max(0, Math.round((position - space.strips) / space.scale)))
}

/** Which strip (0..axisCount) a position falls in. `Math.ceil(x / w) - 1`, not `Math.floor(x / w)`: they differ only
 * on a strip boundary, where this rounds down, so an odd dimension's middle cell counts toward the first half
 * (see stripOf's tests). */
function stripAtPosition(position: number, space: StripSpace): number {
  return Math.min(space.strips - 1, Math.max(0, Math.ceil(position / space.stripWidth) - 1))
}

/** A strip reads reversed (mirror-image) when it's an odd strip and we're not in copy mode; every strip reads
 * forward (plain, A | A | A) in copy mode (ticket 45). */
function isReversedStrip(strip: number, copyMode: boolean): boolean {
  return !copyMode && strip % 2 === 1
}

/** A position's offset from `strip`'s own start, always read as if that strip were strip 0 (i.e. un-reversed) -- the
 * common coordinate every strip's counterpart is found at the same offset in (see targetPositionIn). */
function forwardLocal(position: number, strip: number, space: StripSpace, copyMode: boolean): number {
  return isReversedStrip(strip, copyMode)
    ? (strip + 1) * space.stripWidth - position
    : position - strip * space.stripWidth
}

/** The inverse of forwardLocal: where a forward-local offset sits once read into `strip`. */
function targetPositionIn(local: number, strip: number, space: StripSpace, copyMode: boolean): number {
  return isReversedStrip(strip, copyMode) ? (strip + 1) * space.stripWidth - local : strip * space.stripWidth + local
}

/** toIndex without the clamp into [0, dimension - 1] -- lets a mirrored point land off-grid, which
 * mirrorBlockPlacements needs so a block anchored near one edge can clip on the *other* edge once mirrored, instead
 * of being pinned to the boundary cell. */
function toIndexUnclamped(position: number, space: StripSpace): number {
  return Math.round((position - space.strips) / space.scale)
}

/** Which strip (0..axisCount) a cell belongs to, per the same split mirrorCounterparts uses. */
export function stripOf(index: number, dimension: number, axisCount: number): number {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return 0
  }

  const space = stripSpace(dimension, axisCount)
  return stripAtPosition(toPosition(index, space), space)
}

/** Every index (its own strip included) that `index` mirrors onto when `axisCount` axes split `dimension` into
 * axisCount + 1 strips, deduped, in strip order. `copyMode` (ticket 45, ADR 0006 amendment) reads every strip the
 * same way round. An uneven split of differing parity rounds to the nearest cell (see mirror.test.ts). */
export function mirrorCounterparts(
  index: number,
  dimension: number,
  axisCount: number,
  copyMode = false,
): number[] {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return [index]
  }

  const space = stripSpace(dimension, axisCount)
  const position = toPosition(index, space)
  const sourceStrip = stripAtPosition(position, space)
  const local = forwardLocal(position, sourceStrip, space, copyMode)

  const seen = new Set<number>()
  const results: number[] = []
  for (let strip = 0; strip < strips; strip++) {
    const target = toIndex(targetPositionIn(local, strip, space, copyMode), dimension, space)
    if (!seen.has(target)) {
      seen.add(target)
      results.push(target)
    }
  }
  return results
}

/** The one counterpart `index` has in `sourceStrip` (0..axisCount), for "Mirror current" (ticket 46): copying one
 * strip onto every other. Returns `index` itself when `sourceStrip` doesn't exist for this axisCount. */
export function mirrorCounterpartInStrip(
  index: number,
  dimension: number,
  axisCount: number,
  copyMode: boolean,
  sourceStrip: number,
): number {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return index
  }

  const space = stripSpace(dimension, axisCount)
  const position = toPosition(index, space)
  const ownStrip = stripAtPosition(position, space)
  const local = forwardLocal(position, ownStrip, space, copyMode)
  return toIndex(targetPositionIn(local, sourceStrip, space, copyMode), dimension, space)
}

/** One strip's placement of a mirrored block along a single axis: where its near (top or left) edge lands, and
 * whether the strip reads reversed from the block's own strip -- see mirrorBlockPlacements. */
export interface MirrorBlockPlacement {
  anchorIndex: number
  flipped: boolean
}

/** Every placement (ticket 50) of a `size`-cell block at `anchorIndex` across all strips; a block can come out flipped
 * or off-grid, which the caller handles. Built from the near edge mapped affinely (far edge = +/- `size - 1`) so
 * toIndexUnclamped's rounding can't split the edges. Deduped by anchor + flip. */
export function mirrorBlockPlacements(
  anchorIndex: number,
  size: number,
  dimension: number,
  axisCount: number,
  copyMode = false,
): MirrorBlockPlacement[] {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return [{ anchorIndex, flipped: false }]
  }

  const space = stripSpace(dimension, axisCount)
  const position = toPosition(anchorIndex, space)
  const sourceStrip = stripAtPosition(position, space)
  const sourceReversed = isReversedStrip(sourceStrip, copyMode)
  const local = forwardLocal(position, sourceStrip, space, copyMode)

  const seen = new Set<string>()
  const results: MirrorBlockPlacement[] = []
  for (let strip = 0; strip < strips; strip++) {
    const mirroredAnchor = toIndexUnclamped(targetPositionIn(local, strip, space, copyMode), space)
    const flipped = sourceReversed !== isReversedStrip(strip, copyMode)
    const placement = { anchorIndex: flipped ? mirroredAnchor - (size - 1) : mirroredAnchor, flipped }
    const key = `${placement.anchorIndex}:${placement.flipped}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push(placement)
    }
  }
  return results
}

/** Where each of `axisCount` axis lines sits as a fraction of the dimension (0 start, 1 end), for drawing the lines.
 * Evenly spaced, so strips are equally wide *continuously*; cell counts differ by one when uneven. */
export function axisLinePositions(axisCount: number): number[] {
  const strips = axisCount + 1
  return Array.from({ length: axisCount }, (_, i) => (i + 1) / strips)
}

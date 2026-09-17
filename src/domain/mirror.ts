/**
 * The strip-splitting math behind rich Mirror (ticket 44, ADR 0006 amendment): N axes split a dimension's cells
 * into N+1 strips "as equal as possible", neighbouring strips reading as mirror images of each other
 * (A | A' | A | A' ...). Grid-space only -- `columns`/`rows` here are never "left-right"/"top-bottom": which
 * screen direction each maps to is a view-layer concern (Toolbox.vue), swapped when the Pattern is rotated, exactly
 * like the rest of this codebase's view-only rotation (see PatternCanvas.vue) -- never a transform of this math or
 * the grid data itself.
 */

/** Per-direction Mirror axis counts, in grid space. `columns` splits the grid across its columns (today's, i.e.
 * flag-off, "horizontal"/left-right-when-unrotated mirror); `rows` splits it across its rows (today's "vertical"/
 * top-bottom-when-unrotated mirror). */
export interface MirrorAxisCounts {
  columns: number
  rows: number
}

export const NO_MIRROR_AXES: MirrorAxisCounts = { columns: 0, rows: 0 }

/** The largest axis count a direction with this many cells across it can take: every axis needs at least one cell on each side (ticket 44 decision). */
export function maxAxisCount(cellsAcross: number): number {
  return Math.max(0, cellsAcross - 1)
}

/** Keeps an axis count inside [0, maxAxisCount(cellsAcross)], e.g. after the Pattern's size changes. */
export function clampAxisCount(count: number, cellsAcross: number): number {
  return Math.min(maxAxisCount(cellsAcross), Math.max(0, count))
}

/**
 * Shared coordinate space for every strip computation below: works in integer units doubled (for a cell's
 * half-integer center) and scaled by the strip count (to clear the strip-width fraction when `dimension` doesn't
 * divide evenly), so every intermediate value is an exact integer -- no float rounding drift for large grids.
 */
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

/**
 * Which strip (0-indexed, 0..axisCount) a position falls in. `Math.ceil(x / w) - 1` rather than the more obvious
 * `Math.floor(x / w)`: the two agree everywhere except exactly on a strip boundary, where this rounds *down* to the
 * lower/earlier strip -- matching legacy `mirrorPattern`'s tie-break for its center axis (an odd dimension's exact
 * middle cell counts toward the first/larger half, not the second), which only ever arises at exactly this kind of
 * boundary. See stripOf's own tests for the case this was chosen for.
 */
function stripAtPosition(position: number, space: StripSpace): number {
  return Math.min(space.strips - 1, Math.max(0, Math.ceil(position / space.stripWidth) - 1))
}

/** A strip reads reversed (mirror-image) when it's an odd strip and we're not in copy mode; every strip reads forward (plain, A | A | A) in copy mode (ticket 45). */
function isReversedStrip(strip: number, copyMode: boolean): boolean {
  return !copyMode && strip % 2 === 1
}

/** A position's offset from `strip`'s own start, always read as if that strip were strip 0 (i.e. un-reversed) -- the common coordinate every strip's counterpart is found at the same offset in (see targetPositionIn). */
function forwardLocal(position: number, strip: number, space: StripSpace, copyMode: boolean): number {
  return isReversedStrip(strip, copyMode)
    ? (strip + 1) * space.stripWidth - position
    : position - strip * space.stripWidth
}

/** The inverse of forwardLocal: where a forward-local offset sits once read into `strip`. */
function targetPositionIn(local: number, strip: number, space: StripSpace, copyMode: boolean): number {
  return isReversedStrip(strip, copyMode) ? (strip + 1) * space.stripWidth - local : strip * space.stripWidth + local
}

/** toIndex without the clamp into [0, dimension - 1] -- lets a mirrored point land off-grid, which mirrorBlockPlacements needs so a block anchored near one edge can clip on the *other* edge once mirrored, instead of being pinned to the boundary cell. */
function toIndexUnclamped(position: number, space: StripSpace): number {
  return Math.round((position - space.strips) / space.scale)
}

/**
 * Which strip (0-indexed, 0..axisCount) a cell belongs to, per the same "as equal as possible" split
 * mirrorCounterparts uses.
 */
export function stripOf(index: number, dimension: number, axisCount: number): number {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return 0
  }

  const space = stripSpace(dimension, axisCount)
  return stripAtPosition(toPosition(index, space), space)
}

/**
 * Every index (across every strip -- its own included) that `index` mirrors onto when `axisCount` axes split
 * `dimension` cells into axisCount + 1 strips "as equal as possible". With 0 axes that's just `[index]`. With 1
 * axis this is exactly today's single center-mirror reflection, `dimension - 1 - index`, which self-mirrors the
 * middle cell of an odd dimension (ADR 0006's original behaviour, still what the flag-off path uses directly). With
 * more axes, strips alternate mirror-image/plain the way a fan-folded strip of paper would (A | A' | A | A' ...),
 * so an axis can run through the middle of a strip's own middle cell too, when that strip's width is odd.
 *
 * `copyMode` (ticket 45) switches every strip to read the same way round instead (A | A | A | A ...): a painted
 * cell's counterpart sits at the *same* relative position in every other strip, unflipped. It's its own switch
 * rather than something implied by the axis count (ADR 0006 amendment: "tying '2+ axes means copy' to the count
 * would make 1 axis the only true mirror and change what Mirror means as you step the count") -- with axisCount <=
 * 1 there's only ever one "other" strip, so copyMode has no observable effect there.
 *
 * Deduped and sorted by strip order; a self-mirroring cell (e.g. the 1-axis odd-dimension case above) only appears
 * once.
 *
 * Implementation note: where a dimension doesn't divide evenly among more than 2 strips, a cell in a strip whose
 * width has different parity from its target strip has no exact positional counterpart there; that case rounds to
 * the nearest cell (see mirror.test.ts) rather than left undefined, since painting a slightly-off cell is harmless
 * where painting nothing at all would silently break the "every strip" guarantee.
 */
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

/**
 * The one counterpart `index` has specifically in `sourceStrip` (0-indexed, 0..axisCount) -- what "Mirror current"
 * (ticket 46) needs: copying one particular strip's content onto every *other* strip individually, rather than
 * every strip's mutual counterpart of a single painted cell (see mirrorCounterparts, which this shares its strip
 * math with). Meaningless, and returns `index` itself, when `sourceStrip` doesn't exist for this axisCount.
 */
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

/**
 * Every placement (ticket 50) a `size`-cell-long block anchored at `anchorIndex` lands at across all of `axisCount`
 * axes' strips, generalizing mirrorCounterparts from a single cell to a block's extent: a block, unlike a single
 * cell, can come out *flipped* in a strip that reads reversed from its own, and its edges can end up off-grid even
 * when the original placement wasn't (a block anchored near one edge can run past the *other* edge once mirrored) --
 * both left for the caller to handle (flip the block's own content; clip per placement the same way a single
 * un-mirrored placement already does).
 *
 * Deliberately built from just the block's own strip and one mapped point (its near edge), not by independently
 * re-deriving each strip's mapping from scratch: a block's own strip and orientation are fixed by where its anchor
 * cell sits, so its far edge always follows the same affine step (+/- `size - 1`) from the mapped near edge, with the
 * sign flipping exactly when the target strip reads reversed relative to the block's own -- see forwardLocal/
 * targetPositionIn's own "local offset from strip start" framing, which is what makes this an affine map in the
 * first place. That also sidesteps toIndexUnclamped's rounding drift (see mirrorCounterparts' own implementation
 * note) ever pulling a block's two edges out of step with each other.
 *
 * One placement per strip (0 axes: just the block's own, unflipped -- matches mirrorCounterparts' `[index]`).
 * Deduped by resulting anchor + flip, so a self-mirroring placement (the single-axis odd-dimension case
 * mirrorCounterparts documents, generalized) only appears once.
 */
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

/**
 * Where each of `axisCount` axis lines sits, as a fraction of the whole dimension (0 = the grid's start edge, 1 =
 * its end edge) -- for drawing the thin axis lines over the canvas. Evenly spaced so every strip is the same
 * *continuous* width; a strip's actual cell count only differs by one from its neighbours where the dimension
 * doesn't divide evenly (see mirrorCounterparts).
 */
export function axisLinePositions(axisCount: number): number[] {
  const strips = axisCount + 1
  return Array.from({ length: axisCount }, (_, i) => (i + 1) / strips)
}

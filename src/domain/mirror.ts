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
 * Implementation note: works in integer units doubled (for a cell's half-integer center) and scaled by the strip
 * count (to clear the strip-width fraction when `dimension` doesn't divide evenly), so every intermediate value is
 * an exact integer -- no float rounding drift for large grids. Where a dimension doesn't divide evenly among more
 * than 2 strips, a cell in a strip whose width has different parity from its target strip has no exact positional
 * counterpart there; that case rounds to the nearest cell (see mirror.test.ts) rather than left undefined, since
 * painting a slightly-off cell is harmless where painting nothing at all would silently break the "every strip"
 * guarantee.
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

  const scale = 2 * strips
  const stripWidth = 2 * dimension
  const position = index * scale + strips

  // A strip reads reversed (mirror-image) when it's an odd strip and we're not in copy mode; every strip reads
  // forward (plain, A | A | A) in copy mode.
  const isReversed = (strip: number) => !copyMode && strip % 2 === 1

  const sourceStrip = Math.min(strips - 1, Math.floor(position / stripWidth))
  const forwardLocal = isReversed(sourceStrip)
    ? (sourceStrip + 1) * stripWidth - position
    : position - sourceStrip * stripWidth

  const seen = new Set<number>()
  const results: number[] = []
  for (let strip = 0; strip < strips; strip++) {
    const targetPosition = isReversed(strip)
      ? (strip + 1) * stripWidth - forwardLocal
      : strip * stripWidth + forwardLocal
    const target = Math.min(dimension - 1, Math.max(0, Math.round((targetPosition - strips) / scale)))
    if (!seen.has(target)) {
      seen.add(target)
      results.push(target)
    }
  }
  return results
}

/** Which strip (0-indexed) a cell belongs to, per the same "as equal as possible" split mirrorCounterparts uses. */
export function stripOf(index: number, dimension: number, axisCount: number): number {
  const strips = axisCount + 1
  if (strips <= 1 || dimension <= 0) {
    return 0
  }

  const scale = 2 * strips
  const stripWidth = 2 * dimension
  const position = index * scale + strips
  return Math.min(strips - 1, Math.floor(position / stripWidth))
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

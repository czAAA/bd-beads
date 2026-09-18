import type { Grid, Pattern } from './pattern'

/**
 * The compact form a Pattern's grid is stored in (ADR 0009): the distinct colours it holds, listed once each, plus its
 * cells as runs of indexes into that list. A 60×90 Pattern costs about 3KB this way instead of about 100KB as an
 * object per cell, which is what moves the library's ceiling from roughly 50 Patterns to roughly 1,600.
 *
 * The table is per-Pattern and deliberately not indexes into the Palette: a cell may hold any hex at all — a Custom
 * color, or a colour from an imported Pattern this device's Palette has never had — and a Palette-indexed encoding
 * would have had nothing to write for those.
 *
 * It is also deliberately **not** ticket 58's Image colors ([ADR 0011](../../docs/adr/0011-image-colors-stored-frozen.md)):
 * that field records what one Convert image found and is frozen, while this describes the grid as it stands now. They
 * differ the moment a colour is erased and both are then correct, so this table stays inside the grid's own stored
 * value rather than becoming a Pattern field the two could be confused for.
 */
export interface EncodedGrid {
  /** Every distinct hex in the grid, in the order the cells first use it. Empty cells aren't in here — see EMPTY_INDEX. */
  colors: string[]
  /**
   * The cells in row-major order (runs cross row ends freely) as comma-separated runs of colour-table indexes: `"3"`
   * for a single cell of index 3, `"3x40"` for forty of them. An all-empty 60×90 grid is therefore `"0x5400"`.
   */
  runs: string
}

/**
 * A Pattern as it is stored: every field it has, verbatim, except that `grid` is replaced by its compact form. Passing
 * the rest through by spread rather than field by field is what lets a field added after this encoding — Image colors,
 * say — round-trip untouched without this module knowing it exists.
 */
export type EncodedPattern = Omit<Pattern, 'grid'> & { cells: EncodedGrid }

/** The run index for an empty cell. Real colours start at 1, so `colors` holds no placeholder for "nothing". */
const EMPTY_INDEX = 0

const RUN_SEPARATOR = ','
/** Separates a run's index from its length; absent for a run of one cell, which is the common case on a busy grid. */
const LENGTH_MARKER = 'x'

export function encodeGrid(grid: Grid): EncodedGrid {
  const colors: string[] = []
  const indexByColor = new Map<string, number>()
  const runs: string[] = []
  let runIndex = EMPTY_INDEX
  let runLength = 0

  function indexOf(color: string): number {
    const known = indexByColor.get(color)
    if (known !== undefined) {
      return known
    }
    const index = colors.push(color)
    indexByColor.set(color, index)
    return index
  }

  function closeRun(): void {
    if (runLength > 0) {
      runs.push(runLength === 1 ? String(runIndex) : `${runIndex}${LENGTH_MARKER}${runLength}`)
    }
  }

  for (const row of grid) {
    for (const cell of row) {
      const index = cell.color === null ? EMPTY_INDEX : indexOf(cell.color)
      if (index === runIndex && runLength > 0) {
        runLength += 1
        continue
      }
      closeRun()
      runIndex = index
      runLength = 1
    }
  }
  closeRun()

  return { colors, runs: runs.join(RUN_SEPARATOR) }
}

/**
 * Expands a compact grid back to `rows` × `columns` cells. The Pattern's own dimensions decide the shape, so a stored
 * value whose runs don't add up to exactly that many cells still yields a usable grid (missing cells come back empty,
 * extra ones are dropped) rather than a Pattern the editor can't open.
 */
export function decodeGrid({ colors, runs }: EncodedGrid, columns: number, rows: number): Grid {
  const cells: (string | null)[] = []
  if (runs !== '') {
    for (const run of runs.split(RUN_SEPARATOR)) {
      const marker = run.indexOf(LENGTH_MARKER)
      const index = Number(marker === -1 ? run : run.slice(0, marker))
      const length = marker === -1 ? 1 : Number(run.slice(marker + 1))
      const color = index === EMPTY_INDEX ? null : (colors[index - 1] ?? null)
      for (let repeat = 0; repeat < length; repeat += 1) {
        cells.push(color)
      }
    }
  }

  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => ({ color: cells[row * columns + column] ?? null })),
  )
}

export function encodePattern(pattern: Pattern): EncodedPattern {
  const { grid, ...rest } = pattern
  return { ...rest, cells: encodeGrid(grid) }
}

export function decodePattern(encoded: EncodedPattern): Pattern {
  const { cells, ...rest } = encoded
  return { ...rest, grid: decodeGrid(cells, rest.columns, rest.rows) }
}

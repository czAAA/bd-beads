import { forEachBead, type BeadMap } from './canvas'
import type { Grid, GridPattern, Pattern } from './pattern'

/**
 * The compact form a Pattern's beads are stored in (ADR 0009, reshaped for the open canvas by ADR 0026): the distinct
 * colors the Pattern holds, listed once each, plus, for every row that has a bead, where that row's beads start and
 * the beads themselves as runs of indexes into that list. A 60×90 Pattern costs about 3KB this way instead of about
 * 100KB as an object per bead, which is what moves the library's ceiling from roughly 50 Patterns to roughly 1,600.
 * Only rows with a bead are written, so a bead far from the others costs one row and an empty canvas costs nothing.
 *
 * The table is per-Pattern and deliberately not indexes into the Palette: a bead may hold any hex at all — a Custom
 * color, or a color from an imported Pattern this device's Palette has never had — and a Palette-indexed encoding
 * would have had nothing to write for those.
 *
 * It is also deliberately **not** ticket 58's Image colors (ADR 0011): that field records what one Convert image found
 * and is frozen, while this describes the beads as they stand now. They differ the moment a color is erased and both
 * are then correct, so this table stays inside the beads' own stored value rather than becoming a Pattern field the
 * two could be confused for.
 */
export interface EncodedBeads {
  /** Every distinct hex on the canvas, in the order the beads first use it. */
  colors: string[]
  /**
   * One entry per row that has a bead, keyed by the row number: `"<first column>:<runs>"`, where the runs cover the
   * columns from the first bead to the last in that row as comma-separated color-table indexes — `"3"` for a single
   * bead of index 3, `"3x40"` for forty of them, and index 0 for an empty position between two beads.
   */
  rows: Record<string, string>
}

/**
 * A Pattern as the open canvas stores it: every field it has, verbatim, except that `beads` is replaced by its compact
 * form. Passing the rest through by spread rather than field by field is what lets a field added after this encoding —
 * Image colors, say, or the Frame — round-trip untouched without this module knowing it exists.
 */
export type EncodedPattern = Omit<Pattern, 'beads'> & { encodedBeads: EncodedBeads }

/**
 * A Pattern as it was stored before the open canvas (ADR 0009's original shape): `columns` × `rows` cells as runs in
 * row-major order. Still read, never written.
 */
interface EncodedCells {
  colors: string[]
  runs: string
}
export type EncodedGridPattern = Omit<GridPattern, 'grid'> & { cells: EncodedCells }

/** The run index for an empty position. Real colors start at 1, so `colors` holds no placeholder for "nothing". */
const EMPTY_INDEX = 0

const RUN_SEPARATOR = ','
/** Separates a run's index from its length; absent for a run of one bead, which is the common case on a busy row. */
const LENGTH_MARKER = 'x'
const START_SEPARATOR = ':'

function encodeBeads(beads: BeadMap): EncodedBeads {
  const colors: string[] = []
  const slotByColor = new Map<string, number>()
  const rows: Record<string, string> = {}

  /** This color's run index, adding it to the table if it's new. One-based, since EMPTY_INDEX has claimed zero. */
  function slotFor(color: string): number {
    const known = slotByColor.get(color)
    if (known !== undefined) {
      return known
    }
    colors.push(color)
    const slot = colors.length
    slotByColor.set(color, slot)
    return slot
  }

  let currentRow: number | undefined
  let firstColumn = 0
  let nextColumn = 0
  let runs: string[] = []
  let runIndex = EMPTY_INDEX
  let runLength = 0

  function closeRun(): void {
    if (runLength > 0) {
      runs.push(runLength === 1 ? String(runIndex) : `${runIndex}${LENGTH_MARKER}${runLength}`)
    }
    runLength = 0
  }

  function push(index: number, count: number): void {
    if (index === runIndex && runLength > 0) {
      runLength += count
      return
    }
    closeRun()
    runIndex = index
    runLength = count
  }

  function closeRow(): void {
    if (currentRow !== undefined) {
      closeRun()
      rows[String(currentRow)] = `${firstColumn}${START_SEPARATOR}${runs.join(RUN_SEPARATOR)}`
    }
  }

  forEachBead(beads, (row, column, color) => {
    if (row !== currentRow) {
      closeRow()
      currentRow = row
      firstColumn = column
      nextColumn = column
      runs = []
      runLength = 0
    }
    if (column > nextColumn) {
      push(EMPTY_INDEX, column - nextColumn)
    }
    push(slotFor(color), 1)
    nextColumn = column + 1
  })
  closeRow()

  return { colors, rows }
}

/** The color-table index of each position a stored run list covers, in order. A run that is not a number reads as empty. */
function expandRuns(runs: string): number[] {
  const indexes: number[] = []
  if (runs === '') {
    return indexes
  }
  for (const run of runs.split(RUN_SEPARATOR)) {
    const marker = run.indexOf(LENGTH_MARKER)
    const index = Number(marker === -1 ? run : run.slice(0, marker))
    const length = marker === -1 ? 1 : Number(run.slice(marker + 1))
    for (let repeat = 0; repeat < length; repeat += 1) {
      indexes.push(Number.isFinite(index) ? index : EMPTY_INDEX)
    }
  }
  return indexes
}

function decodeBeads({ colors, rows }: EncodedBeads): BeadMap {
  const beads: BeadMap = {}
  for (const [rowKey, entry] of Object.entries(rows)) {
    const split = entry.indexOf(START_SEPARATOR)
    const firstColumn = Number(entry.slice(0, split))
    expandRuns(entry.slice(split + 1)).forEach((index, offset) => {
      const color = index === EMPTY_INDEX ? undefined : colors[index - 1]
      if (color !== undefined) {
        const row = Number(rowKey)
        beads[row] ??= {}
        beads[row][firstColumn + offset] = color
      }
    })
  }
  return beads
}

/**
 * Expands the original compact cells back to `rows` × `columns` cells. The Pattern's own dimensions decide the shape,
 * so a stored value whose runs don't add up to exactly that many cells still yields a usable grid — missing cells come
 * back empty, extra ones are dropped — rather than a Pattern the editor can't open at all.
 */
function decodeCells({ colors, runs }: EncodedCells, columns: number, rows: number): Grid {
  const flat = expandRuns(runs).map((index) => (index === EMPTY_INDEX ? null : (colors[index - 1] ?? null)))
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => ({ color: flat[row * columns + column] ?? null })),
  )
}

export function encodePattern(pattern: Pattern): EncodedPattern {
  const { beads, ...rest } = pattern
  return { ...rest, encodedBeads: encodeBeads(beads) }
}

/** The Pattern a stored value holds, whichever shape wrote it; a grid-shaped one still goes through normalizePattern to get its Frame. */
export function decodePattern(encoded: EncodedPattern | EncodedGridPattern): Pattern | GridPattern {
  if ('encodedBeads' in encoded) {
    const { encodedBeads, ...rest } = encoded
    return { ...rest, beads: decodeBeads(encodedBeads) }
  }
  const { cells, ...rest } = encoded
  return { ...rest, grid: decodeCells(cells, rest.columns, rest.rows) }
}


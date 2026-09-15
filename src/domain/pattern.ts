import { beadLabel } from './beads'
import { findBead } from './beadStorage'
import { computeGridDimensions, neighborsOf, toMillimeters, type SizeUnit, type Technique } from './grid'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

export type Grid = Cell[][]

/** Which row the weaver is on, and whether the editor is showing that overlay (see CONTEXT.md's Row progress entry). */
export interface RowProgress {
  enabled: boolean
  /** Zero-based index of the row being woven now; every row before it counts as finished. */
  currentRow: number
}

/** Palette color id -> Bead id, for the colors this Pattern maps differently from the global default (ticket 11). */
export type ColorBeadOverrides = Record<string, string>

export interface Pattern {
  id: string
  name: string
  technique: Technique
  beadId: string
  widthMm: number
  heightMm: number
  columns: number
  rows: number
  grid: Grid
  rowProgress: RowProgress
  colorBeadOverrides: ColorBeadOverrides
  createdAt: number
  updatedAt: number
}

export interface CreatePatternInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  beadId: string
  size: { width: number; height: number; unit: SizeUnit }
}

function createEmptyGrid(columns: number, rows: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ color: null })),
  )
}

export function createPattern(input: CreatePatternInput): Pattern {
  // findBead checks custom beads (ticket 10) as well as the seeded catalog, so a Pattern can be created with either.
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const widthMm = toMillimeters(input.size.width, input.size.unit)
  const heightMm = toMillimeters(input.size.height, input.size.unit)
  const { columns, rows } = computeGridDimensions({ widthMm, heightMm }, bead)
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)

  return {
    id: crypto.randomUUID(),
    name,
    technique: input.technique,
    beadId: input.beadId,
    widthMm,
    heightMm,
    columns,
    rows,
    grid: createEmptyGrid(columns, rows),
    rowProgress: { enabled: false, currentRow: 0 },
    colorBeadOverrides: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Applies a change to a Pattern as a new object, stamping it as just-edited. */
function touch(pattern: Pattern, changes: Partial<Pattern>): Pattern {
  return { ...pattern, ...changes, updatedAt: Date.now() }
}

function clampRow(row: number, rows: number): number {
  return Math.min(rows - 1, Math.max(0, row))
}

/**
 * Fills in fields added after a Pattern was first saved, and re-clamps the row pointer, so a Pattern read back from
 * storage or an imported file is safe to use whatever version wrote it.
 */
export function normalizePattern(pattern: Pattern): Pattern {
  const rowProgress = pattern.rowProgress ?? { enabled: false, currentRow: 0 }

  return {
    ...pattern,
    rowProgress: { ...rowProgress, currentRow: clampRow(rowProgress.currentRow, pattern.rows) },
    colorBeadOverrides: pattern.colorBeadOverrides ?? {},
  }
}

/** Shows or hides the row-progress overlay, leaving the pointer where it is. */
export function setRowProgressEnabled(pattern: Pattern, enabled: boolean): Pattern {
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, enabled } })
}

/** Points row progress at the given row, clamped to the Pattern — used to advance a finished row and to go back to an earlier one. */
export function moveToRow(pattern: Pattern, row: number): Pattern {
  return touch(pattern, {
    rowProgress: { ...pattern.rowProgress, currentRow: clampRow(row, pattern.rows) },
  })
}

/** Points one Palette color at a different Bead for this Pattern only; passing no bead drops back to the global default. */
export function setColorBeadOverride(
  pattern: Pattern,
  colorId: string,
  beadId: string | null,
): Pattern {
  const { [colorId]: _removed, ...rest } = pattern.colorBeadOverrides

  return touch(pattern, {
    colorBeadOverrides: beadId === null ? rest : { ...rest, [colorId]: beadId },
  })
}

/** Swaps in a whole new grid (e.g. to restore a prior snapshot on undo), returning a new Pattern rather than mutating the one passed in. */
export function restoreGrid(pattern: Pattern, grid: Grid): Pattern {
  return touch(pattern, { grid })
}

/** Paints a single cell, returning a new Pattern (grid and updatedAt) rather than mutating the one passed in. */
export function paintCell(pattern: Pattern, row: number, column: number, color: string | null): Pattern {
  const grid = pattern.grid.map((gridRow, rowIndex) =>
    rowIndex === row
      ? gridRow.map((cell, columnIndex) => (columnIndex === column ? { color } : cell))
      : gridRow,
  )

  return restoreGrid(pattern, grid)
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors, per the Pattern's grid adjacency (see neighborsOf), with the given color. Returns the same Pattern instance, unchanged, if the clicked cell is already that color. */
export function fillArea(pattern: Pattern, row: number, column: number, color: string | null): Pattern {
  const targetColor = pattern.grid[row]?.[column]?.color
  if (targetColor === undefined || targetColor === color) {
    return pattern
  }

  const dimensions = { columns: pattern.columns, rows: pattern.rows }
  const visited = new Set<string>()
  const toPaint = new Set<string>()
  const stack = [{ row, column }]

  while (stack.length > 0) {
    const position = stack.pop()!
    const key = `${position.row},${position.column}`
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    if (pattern.grid[position.row]?.[position.column]?.color !== targetColor) {
      continue
    }
    toPaint.add(key)
    stack.push(...neighborsOf(pattern.technique, dimensions, position))
  }

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => (toPaint.has(`${rowIndex},${columnIndex}`) ? { color } : cell)),
  )

  return restoreGrid(pattern, grid)
}

export interface MirrorAxes {
  horizontal: boolean
  vertical: boolean
}

function isInFirstHalf(index: number, dimension: number): boolean {
  return index < Math.ceil(dimension / 2)
}

/** Whether the first half (by index, along the given axis) holds at least as much painted content as the second — used to find "the drawn half" to mirror from. Ties, including an all-blank grid, default to the first half. */
function firstHalfIsSource(grid: Grid, dimension: number, axis: 'row' | 'column'): boolean {
  let firstHalfPainted = 0
  let secondHalfPainted = 0

  grid.forEach((gridRow, rowIndex) => {
    gridRow.forEach((cell, columnIndex) => {
      if (cell.color === null) {
        return
      }
      const index = axis === 'row' ? rowIndex : columnIndex
      if (isInFirstHalf(index, dimension)) {
        firstHalfPainted++
      } else {
        secondHalfPainted++
      }
    })
  })

  return firstHalfPainted >= secondHalfPainted
}

/** Maps an index in the non-source half onto its mirror partner in the source half; indices already in the source half map to themselves. */
function mirrorIndex(index: number, dimension: number, sourceIsFirstHalf: boolean): number {
  return isInFirstHalf(index, dimension) === sourceIsFirstHalf ? index : dimension - 1 - index
}

/**
 * Reflects the drawn half (or quadrant, if both axes are selected) across the chosen axis/axes onto the rest of the
 * grid, overwriting whatever was there. Which half counts as "drawn" is decided per axis by which side has more
 * painted cells (see firstHalfIsSource), so mirroring works whichever side the user actually painted on rather than
 * assuming a fixed corner. "Horizontal" flips left-right; "vertical" flips top-bottom. Returns the same Pattern
 * instance, unchanged, when neither axis is selected.
 */
export function mirrorPattern(pattern: Pattern, axes: MirrorAxes): Pattern {
  if (!axes.horizontal && !axes.vertical) {
    return pattern
  }

  const verticalSourceIsFirstHalf = axes.vertical && firstHalfIsSource(pattern.grid, pattern.rows, 'row')
  const horizontalSourceIsFirstHalf =
    axes.horizontal && firstHalfIsSource(pattern.grid, pattern.columns, 'column')

  const sourceRow = (row: number) => (axes.vertical ? mirrorIndex(row, pattern.rows, verticalSourceIsFirstHalf) : row)
  const sourceColumn = (column: number) =>
    axes.horizontal ? mirrorIndex(column, pattern.columns, horizontalSourceIsFirstHalf) : column

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((_cell, columnIndex) => ({
      color: pattern.grid[sourceRow(rowIndex)]![sourceColumn(columnIndex)]!.color,
    })),
  )

  return restoreGrid(pattern, grid)
}

/** A short, language-neutral identifier for a Pattern in UI lists (names are proper nouns, not translated). */
export function summarizePattern(pattern: Pattern): string {
  return `${pattern.name} · ${pattern.columns}×${pattern.rows}`
}

export function mostRecentlyUpdated(patterns: Pattern[]): Pattern | undefined {
  return patterns.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}

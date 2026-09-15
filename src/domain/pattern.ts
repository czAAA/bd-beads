import { beadLabel, findBead } from './beads'
import { computeGridDimensions, neighborsOf, toMillimeters, type SizeUnit, type Technique } from './grid'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

export type Grid = Cell[][]

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
    createdAt: now,
    updatedAt: now,
  }
}

/** Swaps in a whole new grid (e.g. to restore a prior snapshot on undo), returning a new Pattern rather than mutating the one passed in. */
export function restoreGrid(pattern: Pattern, grid: Grid): Pattern {
  return { ...pattern, grid, updatedAt: Date.now() }
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

/**
 * Reflects the top-left quadrant (or half, if only one axis is selected) across the chosen axis/axes onto the rest
 * of the grid, overwriting whatever was there. "Horizontal" flips left-right (source: left half); "vertical" flips
 * top-bottom (source: top half); both together mirror the top-left quadrant into all four. Returns the same Pattern
 * instance, unchanged, when neither axis is selected.
 */
export function mirrorPattern(pattern: Pattern, axes: MirrorAxes): Pattern {
  if (!axes.horizontal && !axes.vertical) {
    return pattern
  }

  const sourceRow = (row: number) => (axes.vertical && row >= Math.ceil(pattern.rows / 2) ? pattern.rows - 1 - row : row)
  const sourceColumn = (column: number) =>
    axes.horizontal && column >= Math.ceil(pattern.columns / 2) ? pattern.columns - 1 - column : column

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

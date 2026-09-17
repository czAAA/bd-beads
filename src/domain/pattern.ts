import { beadLabel } from './beads'
import { withColorBeadMapping } from './beadMapping'
import { findBead } from './beadStorage'
import {
  computeGridDimensions,
  neighborsOf,
  positionKey,
  toMillimeters,
  type GridPosition,
  type SizeUnit,
  type Technique,
} from './grid'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

export type Grid = Cell[][]

/**
 * Which way the weaver's rows run across the grid (ticket 32): along the grid's rows, or down its columns. Separate
 * from Pattern.rotated, which only turns the picture: after rotating, the grid's columns are what run across the
 * screen, so the weaver flips this too, but neither setting ever changes the other.
 */
export type RowDirection = 'rows' | 'columns'

/** Which row the weaver is on, and whether the editor is showing that overlay (see CONTEXT.md's Row progress entry). */
export interface RowProgress {
  enabled: boolean
  direction: RowDirection
  /** Zero-based index of the row being woven now; every row before it counts as finished. */
  currentRow: number
  /** The same pointer for when rows run down the grid's columns, kept apart so flipping the direction never loses either place. */
  currentColumn: number
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
  /**
   * A view-only orientation flip (ticket 28): true shows the Pattern turned 90°, like a rotated photo. Purely
   * cosmetic — the grid, technique geometry, and every other field stay exactly as woven; only the on-screen (and
   * printed/exported) presentation turns. Deliberately not a data transform: for Peyote/Brick, the offset stagger is
   * tied to weave direction, so actually transposing the grid would change which cells are adjacent — a different,
   * unweavable schema, not the same picture turned sideways.
   */
  rotated: boolean
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

/** Row progress exactly as a freshly created Pattern starts out — also what Delete all (ticket 42) resets it back to. */
const INITIAL_ROW_PROGRESS: RowProgress = { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }

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
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    colorBeadOverrides: {},
    rotated: false,
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
    rowProgress: {
      ...rowProgress,
      direction: rowProgress.direction ?? 'rows',
      currentRow: clampRow(rowProgress.currentRow, pattern.rows),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, pattern.columns),
    },
    colorBeadOverrides: pattern.colorBeadOverrides ?? {},
    rotated: pattern.rotated ?? false,
  }
}

/** Shows or hides the row-progress overlay, leaving the pointer where it is. */
export function setRowProgressEnabled(pattern: Pattern, enabled: boolean): Pattern {
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, enabled } })
}

/** Flips the view-only rotated flag (see Pattern.rotated) — turns the Pattern's on-screen presentation 90°, like rotating a photo, without touching the grid itself. */
export function toggleRotated(pattern: Pattern): Pattern {
  return touch(pattern, { rotated: !pattern.rotated })
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view alone. */
export function toggleRowDirection(pattern: Pattern): Pattern {
  const direction = pattern.rowProgress.direction === 'rows' ? 'columns' : 'rows'
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, direction } })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many rows there are. */
export function rowProgressPosition(pattern: Pattern): { current: number; total: number } {
  const { direction, currentRow, currentColumn } = pattern.rowProgress
  return direction === 'rows'
    ? { current: currentRow, total: pattern.rows }
    : { current: currentColumn, total: pattern.columns }
}

/** Whether a bead sits in a row the weaver has already finished: before the pointer, counted the way rows run. Only while the overlay is on. */
export function isInFinishedRow(pattern: Pattern, { row, column }: GridPosition): boolean {
  const { enabled, direction, currentRow, currentColumn } = pattern.rowProgress
  if (!enabled) {
    return false
  }
  return direction === 'rows' ? row < currentRow : column < currentColumn
}

/**
 * Takes back whatever a drawing command did to finished rows (ticket 33): those beads are already woven, so an edit
 * only lands on the row being woven now and the ones after it. An edit left with nothing to change hands back
 * `before` itself, the same "unchanged" signal the drawing commands give, so it records no undo step.
 */
export function keepFinishedRows(before: Pattern, after: Pattern): Pattern {
  const grid = after.grid.map((cells, row) =>
    cells.map((cell, column) => (isInFinishedRow(before, { row, column }) ? before.grid[row]![column]! : cell)),
  )
  const changed = grid.some((cells, row) =>
    cells.some((cell, column) => cell.color !== before.grid[row]![column]!.color),
  )
  return changed ? { ...after, grid } : before
}

/** Points row progress at the given row in its current direction, clamped to the Pattern — used to advance a finished row and to go back to an earlier one. */
export function moveToRow(pattern: Pattern, row: number): Pattern {
  const { total } = rowProgressPosition(pattern)
  const pointer = pattern.rowProgress.direction === 'rows' ? 'currentRow' : 'currentColumn'
  return touch(pattern, {
    rowProgress: { ...pattern.rowProgress, [pointer]: clampRow(row, total) },
  })
}

/** Points one Palette color at a different Bead for this Pattern only; passing no bead drops back to the global default. */
export function setColorBeadOverride(
  pattern: Pattern,
  colorId: string,
  beadId: string | null,
): Pattern {
  return touch(pattern, {
    colorBeadOverrides: withColorBeadMapping(pattern.colorBeadOverrides, colorId, beadId),
  })
}

/** Swaps in a whole new grid (e.g. to restore a prior snapshot on undo), returning a new Pattern rather than mutating the one passed in. */
export function restoreGrid(pattern: Pattern, grid: Grid): Pattern {
  return touch(pattern, { grid })
}

/**
 * One entry on the editing-session undo stack (App.vue): the grid to restore, plus Row progress for the one command
 * that resets that too alongside the grid — Delete all (ticket 42, see deleteAll) — so a single Undo brings both
 * back together. Every other drawing command's entry carries only a grid, leaving Row progress as Undo finds it.
 */
export interface UndoEntry {
  grid: Grid
  rowProgress?: RowProgress
}

/** Restores a grid, and Row progress alongside it when the undo entry carries it (see UndoEntry) — otherwise the same as restoreGrid. */
export function restoreSnapshot(pattern: Pattern, entry: UndoEntry): Pattern {
  return touch(pattern, {
    grid: entry.grid,
    ...(entry.rowProgress ? { rowProgress: entry.rowProgress } : {}),
  })
}

function isEmptyGrid(grid: Grid): boolean {
  return grid.every((row) => row.every((cell) => cell.color === null))
}

/** Whether Row progress is already exactly the just-created state (see INITIAL_ROW_PROGRESS), so deleteAll has nothing left to reset. */
function isInitialRowProgress(rowProgress: RowProgress): boolean {
  return (
    rowProgress.enabled === INITIAL_ROW_PROGRESS.enabled &&
    rowProgress.direction === INITIAL_ROW_PROGRESS.direction &&
    rowProgress.currentRow === INITIAL_ROW_PROGRESS.currentRow &&
    rowProgress.currentColumn === INITIAL_ROW_PROGRESS.currentColumn
  )
}

/**
 * Resets the open Pattern to how it was when first created at its size (CONTEXT.md's Delete all): every cell
 * emptied and Row progress back to its just-created state — off, both pointers at the first row — while name, size,
 * Technique, Bead and rotation stay exactly as they were. Unlike Paint/Fill/Paste/Mirror it ignores the Row
 * progress lock (see isInFinishedRow): clearing progress is the point, so callers apply this directly rather than
 * routing it through keepFinishedRows. Returns the same Pattern instance, unchanged, if it's already in that state.
 */
export function deleteAll(pattern: Pattern): Pattern {
  if (isEmptyGrid(pattern.grid) && isInitialRowProgress(pattern.rowProgress)) {
    return pattern
  }

  return touch(pattern, {
    grid: createEmptyGrid(pattern.columns, pattern.rows),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
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
 * Every cell a live-mirrored stroke touches when painting `position` (ADR 0006/ticket 22): itself, plus its
 * reflection(s) across whichever axes are on, fixed to the grid's exact center rather than mirrorPattern's adaptive
 * "bigger half" (there's no drawn-so-far content to judge a source half from mid-stroke). 1 cell with neither axis
 * on, 2 with one, 4 with both — fewer if the position sits on the exact center of an odd dimension, where a cell
 * mirrors onto itself.
 */
export function mirroredCells(
  pattern: Pick<Pattern, 'rows' | 'columns'>,
  position: GridPosition,
  axes: MirrorAxes,
): GridPosition[] {
  const mirroredRow = pattern.rows - 1 - position.row
  const mirroredColumn = pattern.columns - 1 - position.column

  const rows = axes.vertical ? [position.row, mirroredRow] : [position.row]
  const columns = axes.horizontal ? [position.column, mirroredColumn] : [position.column]

  const seen = new Set<string>()
  const cells: GridPosition[] = []
  for (const row of rows) {
    for (const column of columns) {
      const key = positionKey({ row, column })
      if (!seen.has(key)) {
        seen.add(key)
        cells.push({ row, column })
      }
    }
  }
  return cells
}

/**
 * Paints every position in `positions` plus each one's live-mirror counterpart(s) (see mirroredCells) as a single
 * Pattern edit, so a whole stroke — mirrored or not, one cell or a whole dragged path (ticket 24) — is one undo
 * step rather than one per cell. Returns the same Pattern instance, unchanged, if every touched cell is already
 * that color.
 */
export function paintCells(
  pattern: Pattern,
  positions: GridPosition[],
  color: string | null,
  axes: MirrorAxes,
): Pattern {
  const targets = new Map<string, GridPosition>()
  for (const position of positions) {
    for (const cell of mirroredCells(pattern, position, axes)) {
      targets.set(positionKey(cell), cell)
    }
  }

  const changed = [...targets.values()].some(
    ({ row, column }) => pattern.grid[row]?.[column]?.color !== color,
  )
  if (!changed) {
    return pattern
  }

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) =>
      targets.has(positionKey({ row: rowIndex, column: columnIndex })) ? { color } : cell,
    ),
  )

  return restoreGrid(pattern, grid)
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

/** A short, language-neutral identifier for a Pattern in UI lists (names are proper nouns, not translated); reflects the rotated view's swapped dimensions, since that's how the Pattern currently looks. */
export function summarizePattern(pattern: Pattern): string {
  const [width, height] = pattern.rotated ? [pattern.rows, pattern.columns] : [pattern.columns, pattern.rows]
  return `${pattern.name} · ${width}×${height}`
}

export function mostRecentlyUpdated(patterns: Pattern[]): Pattern | undefined {
  return patterns.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}

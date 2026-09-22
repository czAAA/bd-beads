import { isOffsetTechnique, type Technique } from './grid'
import type { Cell, Grid, Pattern, RowProgress } from './pattern'
import { selectedLine, type Selection } from './selection'

/** Which end of a direction a Resize changes: the right/bottom (as seen on screen) or the left/top. */
export type ResizeAnchor = 'end' | 'start'

/** The size a Resize asks for, in grid space, and which end of each direction it changes (CONTEXT.md's Resize). */
export interface ResizeRequest {
  columns: number
  rows: number
  /** Defaults to 'end'. */
  columnsFrom?: ResizeAnchor
  /** Defaults to 'end'. */
  rowsFrom?: ResizeAnchor
}

/** Why a Resize was turned away. */
export type ResizeRefusal =
  /** Not a whole number of at least 1. */
  | 'invalid'
  /** Row progress is on: shrinking would invalidate finished rows (ADR 0017). */
  | 'locked'
  /** Peyote or brick stitch, rows changed from the start by an odd number — see resizeRowStep. */
  | 'odd-start-rows'

/**
 * How many rows one step of a Resize moves by. Peyote and brick stitch shift every other row half a bead sideways
 * (rowOffsetPx), so adding or removing an odd number of rows at the top flips which rows are the stepped ones and
 * shoves the whole design sideways: from the start they move in pairs. Every other change — columns, loom rows, and
 * anything anchored at the end, which never moves a row's parity — is unrestricted.
 */
export function resizeRowStep(technique: Technique, from: ResizeAnchor): 1 | 2 {
  return from === 'start' && isOffsetTechnique(technique) ? 2 : 1
}

function isWholeCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1
}

/**
 * Why a Resize would not be applied, or undefined when it would be. No size is refused for being large: what limits how
 * big a Pattern can get is the device's storage and memory, not a rule (ADR 0019, which took away the cell cap of
 * ADR 0017).
 */
export function resizeRefusal(pattern: Pattern, request: ResizeRequest): ResizeRefusal | undefined {
  if (!isWholeCount(request.columns) || !isWholeCount(request.rows)) {
    return 'invalid'
  }
  if (pattern.rowProgress.enabled) {
    return 'locked'
  }

  const step = resizeRowStep(pattern.technique, request.rowsFrom ?? 'end')
  if ((request.rows - pattern.rows) % step !== 0) {
    return 'odd-start-rows'
  }

  return undefined
}

/** Where a cell of the resized grid comes from in the old one along one direction: the same index from the end, shifted by the size change from the start. */
function sourceIndex(index: number, from: ResizeAnchor, oldCount: number, newCount: number): number | undefined {
  const source = index - (from === 'start' ? newCount - oldCount : 0)
  return source >= 0 && source < oldCount ? source : undefined
}

/** Row progress's pointers, moved onto a row/column that still exists once the grid shrinks to `rows`x`columns` — shared by resizePattern and removeSelectedLine, which can each drop the row or column a pointer sat on. Hands back the same RowProgress instance, unchanged, when both pointers already fit. */
function clampRowProgress(rowProgress: RowProgress, rows: number, columns: number): RowProgress {
  const currentRow = Math.min(rowProgress.currentRow, rows - 1)
  const currentColumn = Math.min(rowProgress.currentColumn, columns - 1)
  return currentRow === rowProgress.currentRow && currentColumn === rowProgress.currentColumn
    ? rowProgress
    : { ...rowProgress, currentRow, currentColumn }
}

function resizeGrid(pattern: Pattern, request: ResizeRequest): Grid {
  const { columnsFrom = 'end', rowsFrom = 'end' } = request

  return Array.from({ length: request.rows }, (_row, row) => {
    const sourceRow = sourceIndex(row, rowsFrom, pattern.rows, request.rows)
    return Array.from({ length: request.columns }, (_column, column): Cell => {
      const sourceColumn = sourceIndex(column, columnsFrom, pattern.columns, request.columns)
      const source = sourceRow === undefined || sourceColumn === undefined ? undefined : pattern.grid[sourceRow]?.[sourceColumn]
      return source ?? { color: null }
    })
  })
}

/**
 * Adds or removes whole rows and columns (CONTEXT.md's Resize, ADR 0017), from either end of each direction. Growing
 * adds empty cells; shrinking removes the cells that were painted on what it removes. From the start, the design slides
 * with that edge instead of staying pinned to the top-left.
 *
 * Hands back the same Pattern instance, unchanged, when the request is refused (see resizeRefusal) or changes nothing,
 * the same "unchanged" signal the drawing commands give, so it records no undo step. Row progress's pointers are kept on
 * a row that still exists; clearing the Selection and Mirror's axis counts is the caller's job, since neither is a
 * Pattern field (see UndoEntry.size).
 */
export function resizePattern(pattern: Pattern, request: ResizeRequest): Pattern {
  if (resizeRefusal(pattern, request) || (request.columns === pattern.columns && request.rows === pattern.rows)) {
    return pattern
  }

  return {
    ...pattern,
    columns: request.columns,
    rows: request.rows,
    grid: resizeGrid(pattern, request),
    rowProgress: clampRowProgress(pattern.rowProgress, request.rows, request.columns),
    updatedAt: Date.now(),
  }
}

/** Why "remove selected row/column" (ticket 123) would not apply, or undefined when it would. */
export type RemoveLineRefusal =
  /** The Selection isn't exactly one whole row or column (see selectedLine) — there's nothing this Tool acts on. */
  | 'no-line'
  /** Row progress is on, the same lock Resize itself refuses under (ADR 0017). */
  | 'locked'
  /** The Pattern has only the one row or column the Selection names — removing it is a Resize to 0, which nothing here allows any more than resizeRefusal's 'invalid' does. */
  | 'only-line'

/**
 * Whether "remove selected row/column" (ticket 123) would be refused, or undefined when it would apply — what the
 * Tool's own enabled state reads (see Toolbox.vue/App.vue).
 */
export function removeLineRefusal(pattern: Pattern, selection: Selection | undefined): RemoveLineRefusal | undefined {
  const line = selectedLine(pattern, selection)
  if (!line) {
    return 'no-line'
  }
  if (pattern.rowProgress.enabled) {
    return 'locked'
  }
  if ((line.axis === 'row' ? pattern.rows : pattern.columns) <= 1) {
    return 'only-line'
  }
  return undefined
}

/**
 * Removes exactly the row or column the Selection marks out (ticket 123, CONTEXT.md's Resize entry) — any index, not
 * just an end the way Resize itself is limited to — shifting the rest of the grid up or left to close the gap. Row
 * progress's pointers are clamped exactly as resizePattern's are, since the grid shrinks by one line the same way;
 * clearing the Selection and Mirror's axis counts is the caller's job, same division of labor as resizePattern (see
 * UndoEntry.size). Unlike Resize this never refuses for a technique's row-pairing (there's no "from the start" to
 * keep in step here — a single row can be removed from anywhere and the rest simply shift up).
 *
 * Hands back the same Pattern instance, unchanged, when refused (see removeLineRefusal).
 */
export function removeSelectedLine(pattern: Pattern, selection: Selection | undefined): Pattern {
  const line = selectedLine(pattern, selection)
  if (!line || removeLineRefusal(pattern, selection)) {
    return pattern
  }

  const grid: Grid =
    line.axis === 'row'
      ? pattern.grid.filter((_row, rowIndex) => rowIndex !== line.index)
      : pattern.grid.map((row) => row.filter((_cell, columnIndex) => columnIndex !== line.index))
  const rows = line.axis === 'row' ? pattern.rows - 1 : pattern.rows
  const columns = line.axis === 'column' ? pattern.columns - 1 : pattern.columns

  return {
    ...pattern,
    columns,
    rows,
    grid,
    rowProgress: clampRowProgress(pattern.rowProgress, rows, columns),
    updatedAt: Date.now(),
  }
}

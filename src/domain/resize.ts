import { isOffsetTechnique, type Technique } from './grid'
import type { Cell, Grid, Pattern } from './pattern'
import { isOverCellCap } from './patternSize'

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
  /** Would make the Pattern larger than the cell cap. */
  | 'over-cap'
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
 * Why a Resize would not be applied, or undefined when it would be. Growing past MAX_PATTERN_CELLS is refused, but a
 * change that does not make the Pattern larger is always allowed, so a Pattern that is already over the cap — one
 * imported, say — can still be trimmed and is never blocked from opening.
 */
export function resizeRefusal(pattern: Pattern, request: ResizeRequest): ResizeRefusal | undefined {
  if (!isWholeCount(request.columns) || !isWholeCount(request.rows)) {
    return 'invalid'
  }
  if (pattern.rowProgress.enabled) {
    return 'locked'
  }

  const grows = request.columns * request.rows > pattern.columns * pattern.rows
  if (grows && isOverCellCap(request)) {
    return 'over-cap'
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

  const { currentRow, currentColumn } = pattern.rowProgress
  const clampedRow = Math.min(currentRow, request.rows - 1)
  const clampedColumn = Math.min(currentColumn, request.columns - 1)
  const pointersFit = clampedRow === currentRow && clampedColumn === currentColumn

  return {
    ...pattern,
    columns: request.columns,
    rows: request.rows,
    grid: resizeGrid(pattern, request),
    rowProgress: pointersFit ? pattern.rowProgress : { ...pattern.rowProgress, currentRow: clampedRow, currentColumn: clampedColumn },
    updatedAt: Date.now(),
  }
}

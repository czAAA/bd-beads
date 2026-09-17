import { positionKey, type GridDimensions, type GridPosition } from './grid'
import { mirrorBlockPlacements, type MirrorAxisCounts } from './mirror'
import { restoreGrid, type Pattern } from './pattern'

/**
 * A rectangular area of a Pattern's grid, marked out with the Select tool (see CONTEXT.md's Selection entry).
 * Addressed by its top-left corner and its size in cells, so it reads the same way a Pattern's own grid does.
 */
export interface Selection {
  top: number
  left: number
  rows: number
  columns: number
}

/**
 * The cells one Copy snapshotted, ready to stamp elsewhere (see CONTEXT.md's Copy entry). Holds colors rather than
 * grid positions: where it came from stops mattering the moment it's copied, and a block is stamped at whatever
 * position Paste is aimed at.
 */
export interface CopiedBlock {
  rows: number
  columns: number
  /**
   * Row-major cell colors, relative to the block's own top-left corner. `null` marks a cell that was empty in the
   * Selection — a hole, which Paste skips rather than erasing what's underneath it (see pastedCells).
   */
  colors: (string | null)[][]
}

/** One cell a Paste would land on, with the color it would get — what both the paste preview and the paste itself are built from. */
export interface PastedCell extends GridPosition {
  color: string
}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value))
}

/**
 * The Selection a drag from `anchor` to `focus` marks out. Either corner may be the one the drag started from, so
 * dragging up-left covers the same rectangle as dragging down-right; both are clamped onto the grid, so a drag
 * that wandered off the Pattern still yields a selection the Pattern actually has cells for.
 */
export function selectionBetween(
  dimensions: GridDimensions,
  anchor: GridPosition,
  focus: GridPosition,
): Selection {
  const rowsSpanned = [anchor.row, focus.row].map((row) => clamp(row, dimensions.rows - 1))
  const columnsSpanned = [anchor.column, focus.column].map((column) =>
    clamp(column, dimensions.columns - 1),
  )
  const top = Math.min(...rowsSpanned)
  const left = Math.min(...columnsSpanned)

  return {
    top,
    left,
    rows: Math.max(...rowsSpanned) - top + 1,
    columns: Math.max(...columnsSpanned) - left + 1,
  }
}

/** Whether a cell falls inside the Selection — what the marquee is drawn from, cell by cell. */
export function isWithinSelection(selection: Selection, position: GridPosition): boolean {
  return (
    position.row >= selection.top &&
    position.row < selection.top + selection.rows &&
    position.column >= selection.left &&
    position.column < selection.left + selection.columns
  )
}

/** Snapshots a Selection's cells — the empty ones included, as holes — into a block Paste can stamp anywhere. */
export function copySelection(pattern: Pattern, selection: Selection): CopiedBlock {
  const colors = Array.from({ length: selection.rows }, (_row, rowOffset) =>
    Array.from(
      { length: selection.columns },
      (_column, columnOffset) =>
        pattern.grid[selection.top + rowOffset]?.[selection.left + columnOffset]?.color ?? null,
    ),
  )

  return { rows: selection.rows, columns: selection.columns, colors }
}

/**
 * Where a block's painted cells land when stamped with its top-left corner at `at`. Two kinds of cell are left out,
 * and for opposite reasons: the block's own empty cells, which are holes that leave the destination's color alone
 * (stamping a motif onto painted background mustn't punch through it), and cells that fall past the grid's edge,
 * which are clipped silently rather than blocking or shifting the whole stamp.
 */
export function pastedCells(
  dimensions: GridDimensions,
  block: CopiedBlock,
  at: GridPosition,
): PastedCell[] {
  const cells: PastedCell[] = []

  for (let rowOffset = 0; rowOffset < block.rows; rowOffset++) {
    for (let columnOffset = 0; columnOffset < block.columns; columnOffset++) {
      const color = block.colors[rowOffset]?.[columnOffset]
      const row = at.row + rowOffset
      const column = at.column + columnOffset
      const onGrid = row >= 0 && row < dimensions.rows && column >= 0 && column < dimensions.columns

      if (color && onGrid) {
        cells.push({ row, column, color })
      }
    }
  }

  return cells
}

/**
 * Stamps a single, unmirrored placement of a block onto the grid with its top-left corner at `at`, as one Pattern
 * edit so it undoes in one step. The building block mirroredPasteBlock uses once per Mirror-projected copy (ticket
 * 50); called directly, this is what Paste stamps with both axis counts at 0. Returns the same Pattern instance,
 * unchanged, when the stamp would leave every cell as it already is.
 */
export function pasteBlock(pattern: Pattern, block: CopiedBlock, at: GridPosition): Pattern {
  const cells = pastedCells(pattern, block, at)
  const colorsByPosition = new Map(cells.map((cell) => [positionKey(cell), cell.color]))

  const changed = cells.some(({ row, column, color }) => pattern.grid[row]![column]!.color !== color)
  if (!changed) {
    return pattern
  }

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => {
      const color = colorsByPosition.get(positionKey({ row: rowIndex, column: columnIndex }))
      return color ? { color } : cell
    }),
  )

  return restoreGrid(pattern, grid)
}

/** Reverses a block's rows and/or columns -- what a copy landing in a strip that reads reversed from the block's own
 * needs its content rebuilt as, so pastedCells can treat every mirrored copy exactly like an ordinary, unflipped
 * placement once built (see mirrorBlockPlacements). */
function flippedBlock(block: CopiedBlock, flipRows: boolean, flipColumns: boolean): CopiedBlock {
  if (!flipRows && !flipColumns) {
    return block
  }

  let colors = block.colors
  if (flipRows) {
    colors = [...colors].reverse()
  }
  if (flipColumns) {
    colors = colors.map((row) => [...row].reverse())
  }
  return { rows: block.rows, columns: block.columns, colors }
}

/**
 * Every cell every Mirror-projected copy of `block` would land on when its own top-left corner is aimed at `at`
 * (ticket 50, reversing pasteBlock's old "unaffected by Mirror" precedent — see CONTEXT.md's Paste entry): one
 * placement per strip combination the current axis counts (and copy mode) define, each built by flipping the
 * block's content per mirrorBlockPlacements' verdict and then handed to pastedCells exactly like a single
 * unmirrored placement — so each copy keeps its own hole rule and its own independent edge-clipping, with no
 * interaction between copies beyond later ones winning where two happen to overlap (the same merge order
 * paintCellsForCounts uses for mirrored Paint strokes). With both axis counts at 0 this is exactly pastedCells'
 * own single placement.
 */
export function mirroredPastedCells(
  dimensions: GridDimensions,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): PastedCell[] {
  const rowPlacements = mirrorBlockPlacements(at.row, block.rows, dimensions.rows, axes.rows, copyMode)
  const columnPlacements = mirrorBlockPlacements(at.column, block.columns, dimensions.columns, axes.columns, copyMode)

  const cellsByPosition = new Map<string, PastedCell>()
  for (const rowPlacement of rowPlacements) {
    for (const columnPlacement of columnPlacements) {
      const copy = flippedBlock(block, rowPlacement.flipped, columnPlacement.flipped)
      const anchor = { row: rowPlacement.anchorIndex, column: columnPlacement.anchorIndex }
      for (const cell of pastedCells(dimensions, copy, anchor)) {
        cellsByPosition.set(positionKey(cell), cell)
      }
    }
  }
  return [...cellsByPosition.values()]
}

/**
 * pasteBlock's Mirror-aware counterpart (ticket 50): stamps `block` at `at` plus every copy Mirror projects it onto
 * (see mirroredPastedCells), all as one Pattern edit so the whole click — original placement and every mirrored one
 * — undoes in a single step, same as a mirrored Paint stroke. Returns the same Pattern instance, unchanged, when the
 * stamp would leave every cell as it already is.
 */
export function mirroredPasteBlock(
  pattern: Pattern,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): Pattern {
  const cells = mirroredPastedCells(pattern, block, at, axes, copyMode)
  const colorsByPosition = new Map(cells.map((cell) => [positionKey(cell), cell.color]))

  const changed = cells.some(({ row, column, color }) => pattern.grid[row]![column]!.color !== color)
  if (!changed) {
    return pattern
  }

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => {
      const color = colorsByPosition.get(positionKey({ row: rowIndex, column: columnIndex }))
      return color ? { color } : cell
    }),
  )

  return restoreGrid(pattern, grid)
}

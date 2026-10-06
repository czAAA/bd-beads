import { positionKey, type GridPosition } from './grid'
import { mirrorBlockPlacements, type MirrorAxisCounts } from './mirror'
import { colorAt, withColors, type BeadChange, type Frame } from './canvas'
import { restoreBeads, type Project } from './project'

/**
 * A rectangular area of a Project's grid, marked out with the Select tool (see CONTEXT.md's Selection entry).
 * Addressed by its top-left corner and its size in cells, so it reads the same way a Project's own grid does.
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

/**
 * The Selection a drag from `anchor` to `focus` marks out. Either corner may be the one the drag started from, so
 * dragging up-left covers the same rectangle as dragging down-right. The open canvas has no edge to clamp to
 * (ADR 0026): a Selection covers whatever positions the drag crossed, painted or not.
 */
export function selectionBetween(anchor: GridPosition, focus: GridPosition): Selection {
  const rowsSpanned = [anchor.row, focus.row]
  const columnsSpanned = [anchor.column, focus.column]
  const top = Math.min(...rowsSpanned)
  const left = Math.min(...columnsSpanned)

  return {
    top,
    left,
    rows: Math.max(...rowsSpanned) - top + 1,
    columns: Math.max(...columnsSpanned) - left + 1,
  }
}

/** Snapshots a Selection's cells — the empty ones included, as holes — into a block Paste can stamp anywhere. */
export function copySelection(project: Project, selection: Selection): CopiedBlock {
  const colors = Array.from({ length: selection.rows }, (_row, rowOffset) =>
    Array.from(
      { length: selection.columns },
      (_column, columnOffset) =>
        colorAt(project.beads, selection.top + rowOffset, selection.left + columnOffset),
    ),
  )

  return { rows: selection.rows, columns: selection.columns, colors }
}

/**
 * Where a block's painted cells land when stamped with its top-left corner at `at`. The block's own empty cells are
 * left out: they are holes that leave the destination's color alone (stamping a motif onto painted background mustn't
 * punch through it). Nothing is clipped, since the open canvas has no edge (ADR 0026).
 */
export function pastedCells(block: CopiedBlock, at: GridPosition): PastedCell[] {
  const cells: PastedCell[] = []

  for (let rowOffset = 0; rowOffset < block.rows; rowOffset++) {
    for (let columnOffset = 0; columnOffset < block.columns; columnOffset++) {
      const color = block.colors[rowOffset]?.[columnOffset]
      const row = at.row + rowOffset
      const column = at.column + columnOffset

      if (color) {
        cells.push({ row, column, color })
      }
    }
  }

  return cells
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
 * (ticket 50, reversing Paste's old "unaffected by Mirror" precedent — see CONTEXT.md's Paste entry): one
 * placement per strip combination the current axis counts (and copy mode) define, each built by flipping the
 * block's content per mirrorBlockPlacements' verdict and then handed to pastedCells exactly like a single
 * unmirrored placement — so each copy keeps its own hole rule and its own independent edge-clipping, with no
 * interaction between copies beyond later ones winning where two happen to overlap (the same merge order
 * paintCells uses for mirrored Paint strokes). With both axis counts at 0 this is exactly pastedCells'
 * own single placement.
 */
export function mirroredPastedCells(
  frame: Frame | undefined,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): PastedCell[] {
  // Mirror's axes divide the Frame; with none, or none turned on, a stamp is only itself.
  if (!frame || (axes.columns === 0 && axes.rows === 0)) {
    return pastedCells(block, at)
  }
  const rowPlacements = mirrorBlockPlacements(at.row - frame.row, block.rows, frame.rows, axes.rows, copyMode)
  const columnPlacements = mirrorBlockPlacements(at.column - frame.column, block.columns, frame.columns, axes.columns, copyMode)

  const cellsByPosition = new Map<string, PastedCell>()
  for (const rowPlacement of rowPlacements) {
    for (const columnPlacement of columnPlacements) {
      const copy = flippedBlock(block, rowPlacement.flipped, columnPlacement.flipped)
      const anchor = { row: frame.row + rowPlacement.anchorIndex, column: frame.column + columnPlacement.anchorIndex }
      for (const cell of pastedCells(copy, anchor)) {
        cellsByPosition.set(positionKey(cell), cell)
      }
    }
  }
  return [...cellsByPosition.values()]
}

/**
 * The Mirror-aware form of a single unmirrored paste stamp (ticket 50): stamps `block` at `at` plus every copy Mirror projects it onto
 * (see mirroredPastedCells), all as one Project edit so the whole click — original placement and every mirrored one
 * — undoes in a single step, same as a mirrored Paint stroke. Returns the same Project instance, unchanged, when the
 * stamp would leave every cell as it already is.
 */
export function mirroredPasteBlock(
  project: Project,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): Project {
  const cells = mirroredPastedCells(project.frame, block, at, axes, copyMode)
  const changes: BeadChange[] = cells.map(({ row, column, color }) => ({ row, column, color }))
  const beads = withColors(project.beads, changes)
  return beads === project.beads ? project : restoreBeads(project, beads)
}

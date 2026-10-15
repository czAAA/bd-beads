import { positionKey, type GridPosition } from './grid'
import { mirrorBlockPlacements, type MirrorAxisCounts } from './mirror'
import { beadBounds, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import type { FrameEdge } from './frame'
import type { Technique } from './grid'
import { inMargin, trimToAllowed, withMargin } from './margin'
import { pieceBeadsAt } from './pieces'
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
 * dragging up-left covers the same rectangle as dragging down-right. The Canvas has no edge to clamp to
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

/** A box of beads carries guides (rulers, selection handles) once it spans at least this many beads in total, i.e. more than 4 (tickets 377, 434); a single row of five does. */
const GUIDED_MIN_BEADS = 5

/** Whether a box of this many rows and columns is big enough for guides: the one rule behind a Piece area's rulers and a Selection's handles. */
export function hasGuides(box: { rows: number; columns: number }): boolean {
  return box.rows * box.columns >= GUIDED_MIN_BEADS
}

/** The Selection's rectangle as a Frame-shaped box, for what measures a block of beads on screen (its border, its handles). */
export function selectionFrame(selection: Selection): Frame {
  return { row: selection.top, column: selection.left, rows: selection.rows, columns: selection.columns }
}

/** The Selection over a rectangle of beads given as a Frame-shaped box (a Piece's area, the box round every bead). */
function selectionOfBox(box: Frame): Selection {
  return { top: box.row, left: box.column, rows: box.rows, columns: box.columns }
}

/**
 * The Selection a tap with the Piece tool makes (ticket 414): the bounding rectangle of the Piece the tapped bead belongs
 * to. Beads of other Pieces inside that rectangle are inside the Selection too. None when the tap is on an empty position.
 * With a Frame (ticket 433) only the part of the Piece on the tapped bead's side counts, inside the Frame or clear of its
 * margin, and the rectangle is trimmed to a legal one; a tap in the margin selects nothing.
 */
export function pieceSelectionAt(beads: BeadMap, technique: Technique, at: GridPosition, frame?: Frame): Selection | undefined {
  const members = pieceBeadsAt(beads, technique, at).filter((member) => {
    if (!frame) return true
    if (frameContains(frame, at)) return frameContains(frame, member)
    return !frameContains(withMargin(frame), member)
  })
  if (members.length === 0 || inMargin(frame, at)) {
    return undefined
  }
  const rows = members.map((member) => member.row)
  const columns = members.map((member) => member.column)
  const top = Math.min(...rows)
  const left = Math.min(...columns)
  return trimToAllowed(frame, { top, left, rows: Math.max(...rows) - top + 1, columns: Math.max(...columns) - left + 1 }, at)
}

/** The Selection Select all makes (tickets 414, 428): the Frame's inside when there is a Frame, else the rectangle round every placed bead, or none on an empty canvas. */
export function selectAllSelection(beads: BeadMap, frame: Frame | undefined): Selection | undefined {
  return frame ? { top: frame.row, left: frame.column, rows: frame.rows, columns: frame.columns } : allBeadsSelection(beads)
}

/** The rectangle round every placed bead (ticket 414), or none on an empty canvas. */
export function allBeadsSelection(beads: BeadMap): Selection | undefined {
  const bounds = beadBounds(beads)
  return bounds ? selectionOfBox(bounds) : undefined
}

/** Whether the Selection holds every placed bead (ticket 415): the Select all case, where Clear selection means Delete all. False on an empty canvas. */
export function selectionHoldsAllBeads(beads: BeadMap, selection: Selection): boolean {
  const all = allBeadsSelection(beads)
  if (!all) return false
  return (
    selection.top <= all.top &&
    selection.left <= all.left &&
    selection.top + selection.rows >= all.top + all.rows &&
    selection.left + selection.columns >= all.left + all.columns
  )
}

/**
 * The Selection with the sides a handle drags moved to a bead (ticket 414): `edges` are the sides (a corner drags two),
 * `cell` the bead the pointer is over. A side never passes the one opposite it, so a Selection stays one bead each way.
 */
export function selectionWithEdges(selection: Selection, edges: readonly FrameEdge[], cell: GridPosition): Selection {
  let top = selection.top
  let bottom = selection.top + selection.rows - 1
  let left = selection.left
  let right = selection.left + selection.columns - 1

  if (edges.includes('top')) top = Math.min(cell.row, bottom)
  if (edges.includes('bottom')) bottom = Math.max(cell.row, top)
  if (edges.includes('left')) left = Math.min(cell.column, right)
  if (edges.includes('right')) right = Math.max(cell.column, left)

  return { top, left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Selection moved by whole beads, its size kept; its beads stay where they are. */
export function movedSelection(selection: Selection, rows: number, columns: number): Selection {
  return { ...selection, top: selection.top + rows, left: selection.left + columns }
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
 * punch through it). Nothing is clipped, since the Canvas has no edge (ADR 0026).
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

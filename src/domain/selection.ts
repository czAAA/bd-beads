import { positionKey, type GridPosition } from './grid'
import { mirrorBlockPlacements, type MirrorAxisCounts } from './mirror'
import { beadBounds, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import type { FrameEdge } from './frame'
import { describeWeave, type Weave } from './weave'
import { inMargin, trimToAllowed, withMargin } from './margin'
import { pieceBeadsAt } from './pieces'
import { mirroredCells, restoreBeads, type Project } from './project'

/** A rectangular area of a Project's grid, marked out with the Select tool (CONTEXT.md's Selection): top-left corner
 * plus size in cells. */
export interface Selection {
  top: number
  left: number
  rows: number
  columns: number
}

/** The cells one Copy snapshotted (CONTEXT.md's Copy): colors, not grid positions, stamped wherever Paste is aimed. */
export interface CopiedBlock {
  rows: number
  columns: number
  /** Row-major cell colors relative to the block's top-left. `null` is a hole that Paste skips (see pastedCells). */
  colors: (string | null)[][]
  /** First drawn bead in reading order, relative to the top-left: where the pointer's bead lands (ticket 437, ADR
   * 0057). */
  anchor: { row: number; column: number }
}

/** One cell a Paste would land on, with the color it would get — what both the paste preview and the paste itself
 * are built from. */
export interface PastedCell extends GridPosition {
  color: string
}

/** The Selection a drag from `anchor` to `focus` marks out, from either corner. The Canvas has no edge to clamp to
 * (ADR 0026). */
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

/** A box of beads carries guides (rulers, selection handles) once it spans at least this many beads in total, i.e.
 * more than 4 (tickets 377, 435); a single row of five does. */
const GUIDED_MIN_BEADS = 5

/** Whether a box of this many rows and columns is big enough for guides: the one rule behind a Piece area's rulers
 * and a Selection's handles. */
export function hasGuides(box: { rows: number; columns: number }): boolean {
  return box.rows * box.columns >= GUIDED_MIN_BEADS
}

/** The Selection's rectangle as a Frame-shaped box, for what measures a block of beads on screen (its border, its
 * handles). */
export function selectionFrame(selection: Selection): Frame {
  return { row: selection.top, column: selection.left, rows: selection.rows, columns: selection.columns }
}

/** The Selection over a rectangle of beads given as a Frame-shaped box (a Piece's area, the box round every bead). */
function selectionOfBox(box: Frame): Selection {
  return { top: box.row, left: box.column, rows: box.rows, columns: box.columns }
}

// The Selection a tap with the Piece tool makes (ticket 414): the bounding rectangle of the tapped bead's Piece (other
// Pieces' beads inside it are in too); none on an empty position. With a Frame (ticket 433) only the part on the
// tapped bead's side counts, trimmed to a legal rectangle; a tap in the margin selects nothing.
export function pieceSelectionAt(beads: BeadMap, weave: Weave, at: GridPosition, frame?: Frame): Selection | undefined {
  const members = pieceBeadsAt(beads, weave, at).filter((member) => {
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

/** The Selection Select all makes (tickets 414, 428): the Frame's inside when there is a Frame, else the rectangle
 * round every placed bead, or none on an empty canvas. */
export function selectAllSelection(beads: BeadMap, frame: Frame | undefined): Selection | undefined {
  return frame ? { top: frame.row, left: frame.column, rows: frame.rows, columns: frame.columns } : allBeadsSelection(beads)
}

/** The rectangle round every placed bead (ticket 414), or none on an empty canvas. */
export function allBeadsSelection(beads: BeadMap): Selection | undefined {
  const bounds = beadBounds(beads)
  return bounds ? selectionOfBox(bounds) : undefined
}

/** Whether the Selection holds every placed bead (ticket 415): the Select all case, where Clear selection means
 * Delete all. False on an empty canvas. */
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

/** The Selection with the sides a handle drags (`edges`, two for a corner) moved to `cell` (ticket 414); a side
 * never passes its opposite. */
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

/** The Selection moved by whole beads, its size kept; its beads stay where they are. Where beads are laid in Units it
 * moves by whole Units down. */
export function movedSelection(selection: Selection, rows: number, columns: number, weave: Weave = { technique: 'loom' }): Selection {
  const { rowsPerUnit } = describeWeave(weave)
  return { ...selection, top: selection.top + Math.round(rows / rowsPerUnit) * rowsPerUnit, left: selection.left + columns }
}

/** The Selection grown to whole Units where the Technique has them (ticket 483), kept inside the Frame it started in. */
export function snapSelectionToUnits(weave: Weave, selection: Selection, frame?: Frame): Selection {
  return describeWeave(weave).snapSelection(selection, frame)
}

/** Snapshots a Selection's drawn beads into a block (ticket 437, ADR 0057): trimmed to the bounding box, anchored on
 * the first bead. */
export function copySelection(project: Project, selection: Selection): CopiedBlock | undefined {
  const { rowsPerUnit } = describeWeave(project)
  const drawn: GridPosition[] = []
  for (let row = selection.top; row < selection.top + selection.rows; row++) {
    for (let column = selection.left; column < selection.left + selection.columns; column++) {
      if (colorAt(project.beads, row, column)) drawn.push({ row, column })
    }
  }
  if (drawn.length === 0) return undefined

  // Where beads are laid in Units the block starts on a Unit's line, so Paste can keep each bead lying as it does.
  const top = drawn[0].row - (((drawn[0].row % rowsPerUnit) + rowsPerUnit) % rowsPerUnit)
  const bottom = Math.max(...drawn.map((cell) => cell.row))
  const left = Math.min(...drawn.map((cell) => cell.column))
  const right = Math.max(...drawn.map((cell) => cell.column))
  const colors = Array.from({ length: bottom - top + 1 }, (_row, rowOffset) =>
    Array.from({ length: right - left + 1 }, (_column, columnOffset) => colorAt(project.beads, top + rowOffset, left + columnOffset)),
  )

  return { rows: colors.length, columns: colors[0].length, colors, anchor: { row: drawn[0].row - top, column: drawn[0].column - left } }
}

/** Where a block's painted cells land with its top-left at `at`; empty cells are holes, nothing is clipped (ADR
 * 0026). */
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
  return { ...block, colors }
}

// Every cell every Mirror-projected copy of `block` lands on when aimed at `at` (ticket 50; CONTEXT.md's Paste entry):
// one placement per strip combination, flipped per mirrorBlockPlacements and run through pastedCells, so each copy
// keeps its own hole and clipping rules and later copies win overlaps (paintCells' order).
export function mirroredPastedCells(
  project: Pick<Project, 'frame' | 'technique' | 'brickBlock'>,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): PastedCell[] {
  const { frame } = project
  const { rowsPerUnit, countsUnits } = describeWeave(project)
  // `at` is where the block's anchor bead lands (ticket 437); the rest works from the block's top-left corner, on a
  // Unit's line where beads are laid in Units (ticket 483).
  const row = at.row - block.anchor.row
  const topLeft = { row: row - (((row % rowsPerUnit) + rowsPerUnit) % rowsPerUnit), column: at.column - block.anchor.column }
  if (countsUnits) {
    return unitMirroredPastedCells(project, block, topLeft, axes, copyMode)
  }
  // Mirror's axes divide the Frame; with none, or none turned on, a stamp is only itself.
  if (!frame || (axes.columns === 0 && axes.rows === 0)) {
    return pastedCells(block, topLeft)
  }
  const rowPlacements = mirrorBlockPlacements(topLeft.row - frame.row, block.rows, frame.rows, axes.rows, copyMode)
  const columnPlacements = mirrorBlockPlacements(topLeft.column - frame.column, block.columns, frame.columns, axes.columns, copyMode)

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

/** Each bead of the block with its Mirror counterparts, as they fold among beads that lie alike (Weave.lattice); a later
 * copy wins an overlap. */
function unitMirroredPastedCells(
  project: Pick<Project, 'frame' | 'technique' | 'brickBlock'>,
  block: CopiedBlock,
  topLeft: GridPosition,
  axes: MirrorAxisCounts,
  copyMode: boolean,
): PastedCell[] {
  const cellsByPosition = new Map<string, PastedCell>()
  for (const cell of pastedCells(block, topLeft)) {
    for (const copy of mirroredCells(project, cell, axes, copyMode)) {
      cellsByPosition.set(positionKey(copy), { ...copy, color: cell.color })
    }
  }
  return [...cellsByPosition.values()]
}

/** The Mirror-aware paste stamp (ticket 50): `block` at `at` plus every Mirror copy as one Project edit (one undo
 * step). */
export function mirroredPasteBlock(
  project: Project,
  block: CopiedBlock,
  at: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): Project {
  const cells = mirroredPastedCells(project, block, at, axes, copyMode)
  const changes: BeadChange[] = cells.map(({ row, column, color }) => ({ row, column, color }))
  const beads = withColors(project.beads, changes)
  return beads === project.beads ? project : restoreBeads(project, beads)
}

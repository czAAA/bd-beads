import { type GridPosition } from './grid'
import { beadBounds, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import type { FrameEdge } from './frame'
import { DEFAULT_TECHNIQUE, describeWeave, type Weave } from './weave'
import { layerAt, layerView, onLayer, positionInLayer, positionOnCanvas, type Layer, type Placed } from './layers'
import { footprintOf } from './footprint'
import { inMargin, trimToAllowed, withMargin } from './margin'
import { pieceBeadsAt } from './pieces'
import { paintCells, restoreBeads } from './drawing'
import type { Project } from './project'
import { aimOf, cellOfBead, copiedFromCustom, isCustomView, landOnLayout, pointsOfCells, positionsInRectangle, type PlacedColor } from './customSelection'

/** A rectangular area of a Project's grid, marked out with the Select tool (CONTEXT.md's Selection): top-left corner
 * plus size in cells. */
export interface Selection {
  top: number
  left: number
  rows: number
  columns: number
  /** The layer the drag or tap began on (ADR 0066, ticket 491); absent: the one its top-left bead is on. */
  layer?: Layer
  /** A Piece-tool tap's exact shape (ticket 547, ADR 0051): the Piece's own bead positions, which lie inside the
   * rectangle above (its bounding box). Absent: every position of the rectangle. */
  cells?: readonly GridPosition[]
}

/** The cells one Copy snapshotted (CONTEXT.md's Copy): colors, not grid positions, stamped wherever Paste is aimed. */
export interface CopiedBlock {
  rows: number
  columns: number
  /** Row-major cell colors relative to the block's top-left. `null` is a hole that Paste skips (see pastedCells). */
  colors: (string | null)[][]
  /** First drawn bead in reading order, relative to the top-left: where the pointer's bead lands (ticket 437, ADR
   * 0016). */
  anchor: { row: number; column: number }
  /** Copied from a Custom frame (ticket 0594): each bead's centre on screen from the anchor bead's, which a Paste onto a
   * Custom frame lands as they lay; `colors` holds the same beads in the Frame's cells, for a Paste onto a rectangle. */
  points?: readonly PlacedColor[]
}

/** One cell a Paste would land on, with the color it would get — what both the paste preview and the paste itself
 * are built from. */
export interface PastedCell extends GridPosition {
  color: string
}

/** The Selection a drag from `anchor` to `focus` marks out, from either corner. The Canvas has no edge to clamp to
 * (ADR 0026). */
export function selectionBetween(anchor: GridPosition, focus: GridPosition, layer?: Layer): Selection {
  const rowsSpanned = [anchor.row, focus.row]
  const columnsSpanned = [anchor.column, focus.column]
  const top = Math.min(...rowsSpanned)
  const left = Math.min(...columnsSpanned)

  return {
    top,
    left,
    rows: Math.max(...rowsSpanned) - top + 1,
    columns: Math.max(...columnsSpanned) - left + 1,
    ...(layer ? { layer } : {}),
  }
}

/** Where a drag that began on `layer` may reach (ticket 491): on the Frame, the nearest cell inside it; on the Canvas, a
 * cell under the Frame is not reached, so the drag stays at `held`. */
export function dragFocusOnLayer(project: Placed, layer: Layer, cell: GridPosition, held: GridPosition): GridPosition {
  const frame = project.frame
  if (!frame) return cell
  if (layer === 'canvas') return cell.layer === 'frame' || frameContains(footprintOf(project)!, cell) ? held : cell
  return {
    row: Math.min(Math.max(cell.row, frame.row), frame.row + frame.rows - 1),
    column: Math.min(Math.max(cell.column, frame.column), frame.column + frame.columns - 1),
  }
}

/** A position as a set key. */
export const cellKey = (row: number, column: number): string => `${row},${column}`

/** Whether a position is in the Selection's own cells: the whole rectangle, or for a shape only its Piece's beads
 * (ticket 547). Undefined for a rectangle, which needs no test beyond its bounds. */
export function selectionMask(selection: Selection): ((row: number, column: number) => boolean) | undefined {
  if (!selection.cells) return undefined
  const keys = new Set(selection.cells.map((cell) => cellKey(cell.row, cell.column)))
  return (row, column) => keys.has(cellKey(row, column))
}

/** Whether the Selection has the Frame's eight handles: a rectangle big enough for guides. A shape has none and can't
 * be resized or moved (ticket 547). */
export function selectionHasHandles(selection: Selection): boolean {
  return !selection.cells && hasGuides(selection)
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
export function selectionFrame(selection: Selection): Rect {
  return { row: selection.top, column: selection.left, rows: selection.rows, columns: selection.columns }
}

/** The Selection over a rectangle of beads given as a Frame-shaped box (a Piece's area, the box round every bead). */
function selectionOfBox(box: Rect): Selection {
  return { top: box.row, left: box.column, rows: box.rows, columns: box.columns }
}

/** The Selection a Piece tool tap makes (ticket 414): the tapped bead's Piece, its rectangle carrying its exact cells
 * (ticket 547), or none. With a Frame (ticket 433), only its part on the bead's side, trimmed; nothing in the margin.
 * @internal Tests check the Piece tool's Selection on its own. */
export function pieceSelectionAt(beads: BeadMap, weave: Weave, at: GridPosition, frame?: Rect): Selection | undefined {
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
  const box = trimToAllowed(frame, { top, left, rows: Math.max(...rows) - top + 1, columns: Math.max(...columns) - left + 1 }, at)
  const cells = box && members.filter((member) => frameContains(selectionFrame(box), member))
  return box && cells && { ...box, cells }
}

/** The Selection Select all makes (tickets 414, 428): the Frame's inside when there is a Frame, else the rectangle
 * round every placed bead, or none on an empty canvas. */
export function selectAllSelection(beads: BeadMap, frame: Rect | undefined): Selection | undefined {
  if (frame) return { top: frame.row, left: frame.column, rows: frame.rows, columns: frame.columns, layer: 'frame' }
  const all = allBeadsSelection(beads)
  return all && { ...all, layer: 'canvas' }
}

/** The rectangle round every placed bead (ticket 414), or none on an empty canvas.
 * @internal Tests check the select-all rectangle on its own. */
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

  return { ...selection, top, left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Selection moved by whole beads, its size kept; its beads stay where they are. Where beads are laid in Units it
 * moves by whole Units down. */
export function movedSelection(selection: Selection, rows: number, columns: number, weave: Weave = { technique: DEFAULT_TECHNIQUE }): Selection {
  const { rowsPerUnit } = describeWeave(weave)
  return { ...selection, top: selection.top + Math.round(rows / rowsPerUnit) * rowsPerUnit, left: selection.left + columns }
}

/** The Selection slid back inside `frame` when it was moved past an edge; as it is when it is larger than the Frame. */
export function withinFrame(selection: Selection, frame: Rect): Selection {
  const top = Math.max(frame.row, Math.min(selection.top, frame.row + frame.rows - selection.rows))
  const left = Math.max(frame.column, Math.min(selection.left, frame.column + frame.columns - selection.columns))
  return { ...selection, top, left }
}

/** The Selection grown to whole Units where the Technique has them (ticket 483), kept inside the Frame it started in. */
export function snapSelectionToUnits(weave: Weave, selection: Selection, frame?: Rect): Selection {
  const snapped = describeWeave(weave).snapSelection(selection, frame)
  if (snapped === selection) return selection
  return { ...snapped, ...(selection.layer ? { layer: selection.layer } : {}), ...(selection.cells ? { cells: selection.cells } : {}) }
}

/** Snapshots a Selection's drawn beads into a block (ticket 437, ADR 0016): trimmed to the bounding box, anchored on
 * the first bead.
 * @internal Tests copy a block to paste it. */
export function copySelection(project: Project, selection: Selection): CopiedBlock | undefined {
  const { rowsPerUnit } = describeWeave(project)
  const mask = selectionMask(selection)
  const colorIn = (row: number, column: number) => (!mask || mask(row, column) ? colorAt(project.beads, row, column) : null)
  const drawn: GridPosition[] = []
  for (let row = selection.top; row < selection.top + selection.rows; row++) {
    for (let column = selection.left; column < selection.left + selection.columns; column++) {
      if (colorIn(row, column)) drawn.push({ row, column })
    }
  }
  if (drawn.length === 0) return undefined

  // Where beads are laid in Units the block starts on a Unit's line, so Paste can keep each bead lying as it does.
  const top = drawn[0].row - (((drawn[0].row % rowsPerUnit) + rowsPerUnit) % rowsPerUnit)
  const bottom = Math.max(...drawn.map((cell) => cell.row))
  const left = Math.min(...drawn.map((cell) => cell.column))
  const right = Math.max(...drawn.map((cell) => cell.column))
  const colors = Array.from({ length: bottom - top + 1 }, (_row, rowOffset) =>
    Array.from({ length: right - left + 1 }, (_column, columnOffset) => colorIn(top + rowOffset, left + columnOffset)),
  )

  return { rows: colors.length, columns: colors[0].length, colors, anchor: { row: drawn[0].row - top, column: drawn[0].column - left } }
}

/** Where a block's painted cells land with its top-left at `at`; empty cells are holes, nothing is clipped (ADR
 * 0026).
 * @internal Tests check where a pasted block lands on its own. */
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

/** Every cell `block` lands on when aimed at `at` (CONTEXT.md's Paste entry): its anchor bead on `at` (ticket 437), on
 * a Unit's line and clear of the holes where beads are laid in Units (tickets 483, 486).
 * @internal Tests check where a block is aimed on its own. */
export function stampedCells(
  project: Pick<Project, 'frame' | 'technique' | 'brickBlock' | 'netSize'>,
  block: CopiedBlock,
  at: GridPosition,
): PastedCell[] {
  const weave = describeWeave(project)
  const { rowsPerUnit } = weave
  const row = at.row - block.anchor.row
  const topLeft = { row: row - (((row % rowsPerUnit) + rowsPerUnit) % rowsPerUnit), column: at.column - block.anchor.column }
  const placed = weave.fitBlock(topLeft, pastedCells(block, { row: 0, column: 0 }))
  // A position that holds no bead (a hole in a net) takes nothing (ticket 486).
  return pastedCells(block, placed).filter((cell) => weave.hasPosition(cell, project.frame))
}

/** The paste stamp: `block` at `at` as one Project edit (one undo step). */
function stampBlock(project: Project, block: CopiedBlock, at: GridPosition): Project {
  const frame = project.frame
  // A Frame holds only its own cells: what a stamp puts outside it is dropped (ADR 0066).
  const cells = stampedCells(project, block, at).filter((cell) => !frame || frameContains(frame, cell))
  const changes: BeadChange[] = cells.map(({ row, column, color }) => ({ row, column, color }))
  const beads = withColors(project.beads, changes)
  return beads === project.beads ? project : restoreBeads(project, beads)
}

/** The layer a Selection acts on (ADR 0066): the one its top-left bead is on. A Selection that begins in the Frame is the
 * Frame's; any other is the Canvas's. */
export function selectionLayer(project: Placed, selection: Selection): Layer {
  return selection.layer ?? layerAt(project, { row: selection.top, column: selection.left })
}

/** The Selection counted in a layer's own rows and columns. */
export function selectionInLayer(project: Pick<Project, 'frame'>, layer: Layer, selection: Selection): Selection {
  const { row, column } = positionInLayer(project, layer, { row: selection.top, column: selection.left })
  const cells = selection.cells?.map((cell) => positionInLayer(project, layer, cell))
  return { top: row, left: column, rows: selection.rows, columns: selection.columns, ...(cells ? { cells } : {}) }
}

/** Snapshots the drawn beads of a Selection on its layer (Copy). */
export function copyLayerSelection(project: Project, selection: Selection): CopiedBlock | undefined {
  const layer = selectionLayer(project, selection)
  const view = layerView(project, layer)
  const local = selectionInLayer(project, layer, selection)
  return isCustomView(view) ? copyCustomSelection(view, local) : copySelection(view, local)
}

/** Snapshots a Custom frame's Selection (ticket 0594): its beads' places on screen, and the same beads in its cells. */
function copyCustomSelection(view: Project, selection: Selection): CopiedBlock | undefined {
  const copied = copiedFromCustom(view, selection)
  if (!copied) return undefined
  const top = Math.min(...copied.cells.map(({ row }) => row))
  const left = Math.min(...copied.cells.map(({ column }) => column))
  const rows = Math.max(...copied.cells.map(({ row }) => row)) - top + 1
  const columns = Math.max(...copied.cells.map(({ column }) => column)) - left + 1
  const colors: (string | null)[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, () => null))
  for (const { row, column, color } of copied.cells) colors[row - top]![column - left] = color
  const first = copied.cells[0]!
  return { rows, columns, colors, anchor: { row: first.row - top, column: first.column - left }, points: copied.points }
}

/** Where a block's beads land on a Custom frame aimed at its cell `at`: its anchor bead on that cell's centre, each other
 * bead as it lay on screen, and how many fell on a Seam or Off-shape (ticket 0594). */
function landedOnCustom(view: Project, block: CopiedBlock, at: GridPosition): ReturnType<typeof landOnLayout> {
  const points = block.points ?? pointsOfCells(view, pastedCells(block, { row: 0, column: 0 }), block.anchor)
  const aim = aimOf(view, at)
  return landOnLayout(view, points.map(({ x, y, color }) => ({ x: aim.x + x, y: aim.y + y, color })))
}

/** Every position in a Selection on its layer: the Selection's rectangle (a shape's own cells), cut to the Frame when it
 * is the Frame's; on a Custom frame every bead whose centre lies in it (ticket 0594). */
function selectionCells(view: Project, selection: Selection): GridPosition[] {
  if (isCustomView(view)) return positionsInRectangle(view, selection).map(({ row, column }) => ({ row, column }))
  const mask = selectionMask(selection)
  const cells: GridPosition[] = []
  for (let row = selection.top; row < selection.top + selection.rows; row++) {
    for (let column = selection.left; column < selection.left + selection.columns; column++) {
      if ((!mask || mask(row, column)) && (!view.frame || frameContains(view.frame, { row, column }))) {
        cells.push({ row, column })
      }
    }
  }
  return cells
}

/** Every position of a Selection takes `color` (empty ones too; null clears them), on the
 * Selection's layer: Fill (Selection) and Clear selection. */
export function paintLayerSelection(project: Project, selection: Selection, color: string | null): Project {
  const layer = selectionLayer(project, selection)
  const local = selectionInLayer(project, layer, selection)
  return onLayer(project, layer, (view) => paintCells(view, selectionCells(view, local), color))
}

/** Paste on the layer the pointer is at: the block at `at`, cut to the Frame when it lands in it; on a Custom frame each
 * bead on the nearest free position of the panel under it (ticket 0594). */
export function pasteOnLayer(project: Project, block: CopiedBlock, at: GridPosition): Project {
  const layer = layerAt(project, at)
  return onLayer(project, layer, (view, local) => {
    if (!isCustomView(view)) return stampBlock(view, block, local(at))
    const beads = withColors(view.beads, landedOnCustom(view, block, local(at)).landed)
    return beads === view.beads ? view : restoreBeads(view, beads)
  })
}

/** The Selection a tap with the Piece tool makes at a position, on the layer the tap is on (ticket 414): the Piece of
 * the Canvas's bead there, or of the Frame's own. In Canvas positions. */
export function pieceSelectionOnLayer(project: Project, at: GridPosition): Selection | undefined {
  const layer = layerAt(project, at)
  if (layer === 'canvas') {
    const picked = pieceSelectionAt(project.beads, project, at, footprintOf(project))
    return picked && { ...picked, layer }
  }
  const view = layerView(project, 'frame')
  const picked = pieceSelectionAt(view.beads, view, positionInLayer(project, 'frame', at), view.frame)
  const origin = positionOnCanvas(project, 'frame', { row: picked?.top ?? 0, column: picked?.left ?? 0 })
  const cells = picked?.cells?.map((cell) => positionOnCanvas(project, 'frame', cell))
  return picked && { ...picked, top: origin.row, left: origin.column, layer, ...(cells ? { cells } : {}) }
}

/** The cells a Paste at `at` would fill, as Canvas positions (the paste preview). */
export function pastedCellsOnLayer(project: Project, block: CopiedBlock, at: GridPosition): PastedCell[] {
  const layer = layerAt(project, at)
  const view = layerView(project, layer)
  if (isCustomView(view)) {
    // A Custom frame's positions are named by round and place, which only the Frame's layer reads (ticket 0594).
    return landedOnCustom(view, block, positionInLayer(project, layer, at)).landed.map(({ row, column, color }) => ({ ...positionOnCanvas(project, layer, { row, column }), color: color!, layer }))
  }
  return stampedCells(view, block, positionInLayer(project, layer, at))
    .filter((cell) => !view.frame || frameContains(view.frame, cell))
    .map((cell) => ({ ...cell, ...positionOnCanvas(project, layer, cell) }))
}

/** Where a Paste loses beads: past the Frame's edge (ticket 491), or on a Custom frame's Seams and Off-shape (ticket
 * 0594). */
export type PasteLoss = 'edge' | 'shape'

/** How many beads a Paste at `at` loses, and where: those of a block landing in the Frame that fall outside it, or on
 * a Custom frame those that land on a Seam or Off-shape. None on the Canvas, which has no edge. */
export function pasteLostCount(project: Project, block: CopiedBlock, at: GridPosition): { count: number; loss: PasteLoss } {
  if (layerAt(project, at) !== 'frame') return { count: 0, loss: 'edge' }
  const view = layerView(project, 'frame')
  const local = positionInLayer(project, 'frame', at)
  if (isCustomView(view)) return { count: landedOnCustom(view, block, local).dropped, loss: 'shape' }
  const cells = stampedCells(view, block, local)
  return { count: cells.filter((cell) => !frameContains(view.frame!, cell)).length, loss: 'edge' }
}

/** Where Ctrl+V aims when the pointer is over a bead rather than a cell (a tool other than Select): on a Custom frame the
 * cell over that bead, its position being named by round and place (ticket 0594); elsewhere the position itself. */
export function pasteAimAtBead(project: Project, position: GridPosition): GridPosition {
  if (layerAt(project, position) !== 'frame') return position
  const view = layerView(project, 'frame')
  if (!isCustomView(view)) return position
  return { ...positionOnCanvas(project, 'frame', cellOfBead(view, positionInLayer(project, 'frame', position))), layer: 'frame' }
}

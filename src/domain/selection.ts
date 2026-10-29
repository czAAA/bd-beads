import { type GridPosition } from './grid'
import { beadBounds, beadCount, colorAt, frameContains, withColors, type BeadMap, type Rect } from './canvas'
import type { FrameEdge } from './frame'
import type { Weave } from './weave'
import { layerAt, layerSheet, onLayer, shownBeads, positionInLayer, positionOnCanvas, type Layer, type LayerSheet, type Placed } from './layers'
import { footprintOf } from './footprint'
import { beadsOfLayer, heldWeave, type Layered } from './layerRecord'
import { inMargin, trimToAllowed, withMargin } from './margin'
import { pieceBeadsAt } from './pieces'
import { paintCells } from './drawing'
import type { Project } from './project'
import { isInFinishedRow } from './rowProgress'
import { aimOf, cellOfBead, copiedFromCustom, landOnLayout, pointsOfCells, positionsInRectangle, type PlacedColor } from './customSelection'

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

/** Whether the Selection holds every bead you see (ticket 415): the Select all case, where Clear selection means Delete
 * all. Only what its layer shows counts (ticket 0659), so a rectangle round a bead of the other layer does not. */
export function selectionHoldsAllBeads(project: Project, selection: Selection): boolean {
  const beadsLeft = (target: Project) => beadCount(shownBeads(target)) + beadCount(beadsOfLayer(target, 'frame') ?? {})
  return beadsLeft(project) > 0 && beadsLeft(paintLayerSelection(project, selection, null)) === 0
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

/** The Selection moved by whole beads, its size kept; its beads stay where they are. */
export function movedSelection(selection: Selection, rows: number, columns: number): Selection {
  return { ...selection, top: selection.top + rows, left: selection.left + columns }
}

/** Whether a Selection on a layer acts on a position of that layer (ticket 0659): on the Frame, a cell inside it; on the
 * Canvas, one clear of the Frame and its margin, as the Canvas beads there are not drawn. A Selection's rectangle may
 * lie anywhere; only these positions of it are selected. */
export function selectableOn(project: Placed, sheet: LayerSheet): (row: number, column: number) => boolean {
  const { edge } = sheet
  if (edge) return (row, column) => frameContains(edge, { row, column })
  const covered = footprintOf(project)
  return covered ? (row, column) => !frameContains(withMargin(covered), { row, column }) : () => true
}

/** Snapshots a Selection's drawn beads on a layer laid on a grid into a block (ticket 437, ADR 0016): trimmed to the
 * bounding box, anchored on the first bead. */
function copySelection({ beads }: Pick<LayerSheet, 'beads'>, selection: Selection, selectable: (row: number, column: number) => boolean): CopiedBlock | undefined {
  const mask = selectionMask(selection)
  const colorIn = (row: number, column: number) => ((!mask || mask(row, column)) && selectable(row, column) ? colorAt(beads, row, column) : null)
  const drawn: GridPosition[] = []
  for (let row = selection.top; row < selection.top + selection.rows; row++) {
    for (let column = selection.left; column < selection.left + selection.columns; column++) {
      if (colorIn(row, column)) drawn.push({ row, column })
    }
  }
  if (drawn.length === 0) return undefined

  const top = drawn[0].row
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

/** Every cell `block` lands on when aimed at `at` (CONTEXT.md's Paste entry): its anchor bead on `at` (ticket 437).
 * @internal Tests check where a block is aimed on its own. */
export function stampedCells(block: CopiedBlock, at: GridPosition): PastedCell[] {
  return pastedCells(block, { row: at.row - block.anchor.row, column: at.column - block.anchor.column })
}

/** The paste stamp: `block` at `at` on a layer laid on a grid, as one edit (one undo step). */
function stampBlock(sheet: LayerSheet, block: CopiedBlock, at: GridPosition): BeadMap {
  const { edge } = sheet
  // A Frame holds only its own cells: what a stamp puts outside it is dropped (ADR 0066).
  const cells = stampedCells(block, at).filter((cell) => !edge || frameContains(edge, cell))
  return withColors(sheet.beads, cells.map(({ row, column, color }) => ({ row, column, color })))
}

/** The layer a Selection acts on (ADR 0066): the one its top-left bead is on. A Selection that begins in the Frame is the
 * Frame's; any other is the Canvas's. */
export function selectionLayer(project: Placed, selection: Selection): Layer {
  return selection.layer ?? layerAt(project, { row: selection.top, column: selection.left })
}

/** The Selection counted in a layer's own rows and columns. */
export function selectionInLayer(project: Layered, layer: Layer, selection: Selection): Selection {
  const { row, column } = positionInLayer(project, layer, { row: selection.top, column: selection.left })
  const cells = selection.cells?.map((cell) => positionInLayer(project, layer, cell))
  return { top: row, left: column, rows: selection.rows, columns: selection.columns, ...(cells ? { cells } : {}) }
}

/** Snapshots the drawn beads of a Selection on its layer (Copy). */
export function copyLayerSelection(project: Project, selection: Selection): CopiedBlock | undefined {
  const layer = selectionLayer(project, selection)
  const sheet = layerSheet(project, layer)
  const local = selectionInLayer(project, layer, selection)
  return sheet.geometry.grid ? copySelection(sheet, local, selectableOn(project, sheet)) : copyCustomSelection(sheet, local)
}

/** Whether Copy would take any bead from a Selection (ticket 0675): `copyLayerSelection`'s answer, found by stopping at
 * the first bead, so the Copy and Cut controls never copy a big Selection just to ask. */
export function selectionHasBeads(project: Project, selection: Selection): boolean {
  const layer = selectionLayer(project, selection)
  const sheet = layerSheet(project, layer)
  if (!sheet.geometry.grid) return copyCustomSelection(sheet, selectionInLayer(project, layer, selection)) !== undefined
  const selectable = selectableOn(project, sheet)
  const holds = ({ row, column }: GridPosition) => selectable(row, column) && !!colorAt(sheet.beads, row, column)
  if (selection.cells) return selection.cells.some((cell) => holds(positionInLayer(project, layer, cell)))
  // Only the stored beads are read, so an empty stretch costs nothing however big the rectangle is.
  const { row: top, column: left } = positionInLayer(project, layer, { row: selection.top, column: selection.left })
  return Object.keys(sheet.beads).some((key) => {
    const row = Number(key)
    if (row < top || row >= top + selection.rows) return false
    return Object.keys(sheet.beads[row]!).some((at) => {
      const column = Number(at)
      return column >= left && column < left + selection.columns && holds({ row, column })
    })
  })
}

/** Snapshots a Custom frame's Selection (ticket 0594): its beads' places on screen, and the same beads in its cells. */
function copyCustomSelection(sheet: LayerSheet, selection: Selection): CopiedBlock | undefined {
  const copied = copiedFromCustom(sheet, selection)
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
function landedOnCustom(sheet: LayerSheet, block: CopiedBlock, at: GridPosition): ReturnType<typeof landOnLayout> {
  const points = block.points ?? pointsOfCells(sheet, pastedCells(block, { row: 0, column: 0 }), block.anchor)
  const aim = aimOf(sheet, at)
  return landOnLayout(sheet, points.map(({ x, y, color }) => ({ x: aim.x + x, y: aim.y + y, color })))
}

/** Every position in a Selection on its layer: the Selection's rectangle (a shape's own cells), cut to what the layer
 * shows (`selectableOn`); on a Custom frame every bead whose centre lies in it (ticket 0594). */
function selectionCells(sheet: LayerSheet, selection: Selection, selectable: (row: number, column: number) => boolean): GridPosition[] {
  if (!sheet.geometry.grid) return positionsInRectangle(sheet, selection).map(({ row, column }) => ({ row, column }))
  const mask = selectionMask(selection)
  const cells: GridPosition[] = []
  for (let row = selection.top; row < selection.top + selection.rows; row++) {
    for (let column = selection.left; column < selection.left + selection.columns; column++) {
      if ((!mask || mask(row, column)) && selectable(row, column)) {
        cells.push({ row, column })
      }
    }
  }
  return cells
}

/** Whether a Selection holds a position of a finished pass (ticket 0647, ADR 0052): Rotate is then held back, as the
 * turn would leave those locked beads in place and draw their turned copies too. Never on the Canvas, which Row
 * progress does not cover. */
export function selectionInFinishedRows(project: Project, selection: Selection): boolean {
  if (selectionLayer(project, selection) !== 'frame') return false
  const sheet = layerSheet(project, 'frame')
  const cells = selectionCells(sheet, selectionInLayer(project, 'frame', selection), selectableOn(project, sheet))
  return cells.some((cell) => isInFinishedRow(project, { ...positionOnCanvas(project, 'frame', cell), layer: 'frame' }))
}

/** Every position of a Selection takes `color` (empty ones too; null clears them), on the
 * Selection's layer: Fill (Selection) and Clear selection. */
export function paintLayerSelection(project: Project, selection: Selection, color: string | null): Project {
  const layer = selectionLayer(project, selection)
  const local = selectionInLayer(project, layer, selection)
  return onLayer(project, layer, (sheet) => paintCells(sheet, selectionCells(sheet, local, selectableOn(project, sheet)), color))
}

/** Paste on the layer the pointer is at: the block at `at`, cut to the Frame when it lands in it; on a Custom frame each
 * bead on the nearest free position of the panel under it (ticket 0594). */
export function pasteOnLayer(project: Project, block: CopiedBlock, at: GridPosition): Project {
  const layer = layerAt(project, at)
  return onLayer(project, layer, (sheet, local) =>
    sheet.geometry.grid ? stampBlock(sheet, block, local(at)) : withColors(sheet.beads, landedOnCustom(sheet, block, local(at)).landed),
  )
}

/** The Selection a tap with the Piece tool makes at a position, on the layer the tap is on (ticket 414): the Piece of
 * the Canvas's bead there, or of the Frame's own. In Canvas positions. */
export function pieceSelectionOnLayer(project: Project, at: GridPosition): Selection | undefined {
  const layer = layerAt(project, at)
  if (layer === 'canvas') {
    const picked = pieceSelectionAt(beadsOfLayer(project, 'canvas'), heldWeave(project, 'canvas'), at, footprintOf(project))
    return picked && { ...picked, layer }
  }
  const sheet = layerSheet(project, 'frame')
  const picked = pieceSelectionAt(sheet.beads, sheet.weave, positionInLayer(project, 'frame', at), sheet.edge)
  const origin = positionOnCanvas(project, 'frame', { row: picked?.top ?? 0, column: picked?.left ?? 0 })
  const cells = picked?.cells?.map((cell) => positionOnCanvas(project, 'frame', cell))
  return picked && { ...picked, top: origin.row, left: origin.column, layer, ...(cells ? { cells } : {}) }
}

/** A Paste's preview on a layer laid on a grid (ticket 0675): the copied block aimed at a Canvas position. Its cells are
 * read only where they are drawn, so a hover costs what is on screen, not the whole block. */
export interface PasteStamp {
  /** The block's colors, row-major from its top-left: the copied block's own array, never copied again. */
  colors: CopiedBlock['colors']
  /** The Canvas position the block's top-left lands on. */
  top: number
  left: number
  rows: number
  columns: number
  /** Whether a cell of the block lands at this Canvas position: one past the Frame's edge is clipped (ADR 0066). */
  lands: (row: number, column: number) => boolean
}

/** Where a Paste at `at` would put the block, as a stamp; none on a Custom frame, whose beads are listed instead (see
 * pastedCellsOnLayer). */
export function pasteStampOnLayer(project: Project, block: CopiedBlock, at: GridPosition): PasteStamp | undefined {
  const layer = layerAt(project, at)
  const sheet = layerSheet(project, layer)
  if (!sheet.geometry.grid) return undefined
  const aimed = positionInLayer(project, layer, at)
  const corner = positionOnCanvas(project, layer, { row: aimed.row - block.anchor.row, column: aimed.column - block.anchor.column })
  const edge = sheet.edge && { ...sheet.edge, ...positionOnCanvas(project, layer, sheet.edge) }
  const lands = edge ? (row: number, column: number) => frameContains(edge, { row, column }) : () => true
  return { colors: block.colors, top: corner.row, left: corner.column, rows: block.rows, columns: block.columns, lands }
}

/** Every cell a stamp lands, in reading order: for a press that asks about all of them, never for each hover. */
export function stampCells(stamp: PasteStamp): PastedCell[] {
  const cells: PastedCell[] = []
  for (let rowOffset = 0; rowOffset < stamp.rows; rowOffset++) {
    for (let columnOffset = 0; columnOffset < stamp.columns; columnOffset++) {
      const color = stamp.colors[rowOffset]?.[columnOffset]
      const row = stamp.top + rowOffset
      const column = stamp.left + columnOffset
      if (color && stamp.lands(row, column)) cells.push({ row, column, color })
    }
  }
  return cells
}

/** The cells a Paste at `at` would fill, as Canvas positions (the paste preview). */
export function pastedCellsOnLayer(project: Project, block: CopiedBlock, at: GridPosition): PastedCell[] {
  const stamp = pasteStampOnLayer(project, block, at)
  if (stamp) return stampCells(stamp)
  // A Custom frame's positions are named by round and place, which only the Frame's layer reads (ticket 0594).
  const layer = layerAt(project, at)
  return landedOnCustom(layerSheet(project, layer), block, positionInLayer(project, layer, at)).landed.map(({ row, column, color }) => ({ ...positionOnCanvas(project, layer, { row, column }), color: color!, layer }))
}

/** Where a Paste loses beads: past the Frame's edge (ticket 491), or on a Custom frame's Seams and Off-shape (ticket
 * 0594). */
export type PasteLoss = 'edge' | 'shape'

/** How many beads a Paste at `at` loses, and where: those of a block landing in the Frame that fall outside it, or on
 * a Custom frame those that land on a Seam or Off-shape. None on the Canvas, which has no edge. */
export function pasteLostCount(project: Project, block: CopiedBlock, at: GridPosition): { count: number; loss: PasteLoss } {
  if (layerAt(project, at) !== 'frame') return { count: 0, loss: 'edge' }
  const sheet = layerSheet(project, 'frame')
  const local = positionInLayer(project, 'frame', at)
  if (!sheet.geometry.grid) return { count: landedOnCustom(sheet, block, local).dropped, loss: 'shape' }
  const cells = stampedCells(block, local)
  return { count: cells.filter((cell) => !frameContains(sheet.edge!, cell)).length, loss: 'edge' }
}

/** Where Ctrl+V aims when the pointer is over a bead rather than a cell (a tool other than Select): on a Custom frame the
 * cell over that bead, its position being named by round and place (ticket 0594); elsewhere the position itself. */
export function pasteAimAtBead(project: Project, position: GridPosition): GridPosition {
  if (layerAt(project, position) !== 'frame') return position
  const sheet = layerSheet(project, 'frame')
  if (sheet.geometry.grid) return position
  return { ...positionOnCanvas(project, 'frame', cellOfBead(sheet, positionInLayer(project, 'frame', position))), layer: 'frame' }
}

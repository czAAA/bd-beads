import { frameContains, shiftedBeads, withColors, type BeadMap, type FrameSheet, type Rect } from './canvas'
import { snappedFrame } from './frame'
import type { GridPosition } from './grid'
import { beadsOfLayer, frameOf, heldWeave, lettersOn, withLetters, withLayer } from './layerRecord'
import { withFrameSheet } from './frameSheet'
import { pieceNameAt } from './pieceNames'
import type { Project } from './project'
import { selectionFrame, selectionLayer, type Selection } from './selection'

// A Selection exported as a part (ticket 1210; ExportPanel card): the Project as a Frame laid on just the Selection, so
// the Picture, the Printable chart, Beads needed, the Word chart and the Cover page need no other path than a Frame's.

/** The beads of `beads` inside `area`, or only at `cells` when a Piece gave its exact shape, counted from `area`'s first
 * row and column. */
function beadsInside(beads: BeadMap, area: Rect, cells: readonly GridPosition[] | undefined): BeadMap {
  const inside = (position: GridPosition) => frameContains(area, position)
  const only = cells && new Set(cells.map((cell) => `${cell.row}:${cell.column}`))
  const kept: { row: number; column: number; color: string }[] = []
  for (const key of Object.keys(beads)) {
    const row = Number(key)
    for (const [columnKey, color] of Object.entries(beads[row] ?? {})) {
      const column = Number(columnKey)
      if (inside({ row, column }) && (!only || only.has(`${row}:${column}`))) kept.push({ row, column, color })
    }
  }
  return shiftedBeads(withColors({}, kept), -area.row, -area.column)
}

/** Whether a Selection can be exported: not on a Custom frame (its chart is its Frame shape's whole) nor one off the
 * Canvas's grid, which have no rectangle of beads to cut. */
export function selectionExportable(project: Project, selection: Selection): boolean {
  const frame = frameOf(project)
  return selectionLayer(project, selection) !== 'frame' || (!!frame && !frame.shape && !frame.centre)
}

/** The Project to export for a Selection (ticket 1210), or none where it can't be. Only the Selection's layer is cut, a
 * Piece to its own beads. The rectangle snaps outward where the Weave starts a row or column, as Frame from Selection
 * does, the rows it adds empty. `partName` is the file name's Frame place when no Piece's name is. */
export function selectionExportProject(project: Project, selection: Selection, partName: string): Project | undefined {
  if (!selectionExportable(project, selection)) return undefined
  const layer = selectionLayer(project, selection)
  const asked = selectionFrame(selection)
  if (layer === 'frame') {
    const frame = frameOf(project)!
    const own = { row: asked.row - frame.row, column: asked.column - frame.column, rows: asked.rows, columns: asked.columns }
    const inside = clipped(own, { row: 0, column: 0, rows: frame.rows, columns: frame.columns })
    if (!inside) return undefined
    const area = snappedFrame(heldWeave(project, 'frame')!, inside)
    const beads = beadsInside(beadsOfLayer(project, 'frame')!, area, selection.cells?.map((cell) => ({ row: cell.row - frame.row, column: cell.column - frame.column })))
    const { shape: _shape, settings: _settings, folded: _folded, quarterTurns: _turns, ...kept } = frame
    const cut: FrameSheet & Partial<typeof frame> = { ...kept, row: frame.row + area.row, column: frame.column + area.column, rows: area.rows, columns: area.columns, beads }
    return withLayer(withFrameSheet(withLayer(project, 'canvas', { beads: {} }), cut), 'frame', { name: partName })
  }
  const area = snappedFrame(heldWeave(project, 'canvas'), asked)
  const beads = beadsInside(beadsOfLayer(project, 'canvas'), asked, selection.cells)
  const piece = selection.cells?.[0] && pieceNameAt(project, selection.cells[0])
  const base = withLayer(frameOf(project) ? withFrameSheet(project, undefined) : project, 'canvas', { beads: {} })
  const sheet: FrameSheet = { row: area.row, column: area.column, rows: area.rows, columns: area.columns, beads: shiftedBeads(beads, asked.row - area.row, asked.column - area.column), ...heldWeave(project, 'canvas') }
  const laid = withFrameSheet(base, sheet, { anew: true })
  return withLayer(withLetters(laid, 'frame', lettersOn(project, 'canvas')), 'frame', { name: piece || partName })
}

/** The overlap of two rectangles, or none. */
function clipped(a: Rect, b: Rect): Rect | undefined {
  const top = Math.max(a.row, b.row)
  const left = Math.max(a.column, b.column)
  const bottom = Math.min(a.row + a.rows, b.row + b.rows)
  const right = Math.min(a.column + a.columns, b.column + b.columns)
  return bottom > top && right > left ? { row: top, column: left, rows: bottom - top, columns: right - left } : undefined
}

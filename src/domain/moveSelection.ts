import { colorAt, withColors, type BeadChange } from './canvas'
import type { GridPosition } from './grid'
import { layerSheet, onLayer, positionOnCanvas } from './layers'
import { carryNames } from './pieceNames'
import type { Project } from './project'
import { isInFinishedRow } from './rowProgress'
import { cellKey, movedSelection, selectableOn, selectionCells, selectionInLayer, selectionLayer, type Selection } from './selection'
import { columnCycle, rowCycle, wholeCycles } from './weave'

// Moving a Piece (ticket 1013): its move grip carries a Piece-shaped Selection's beads on their layer. No move puts a
// bead off what its layer shows (the Frame's edge, its keep-out margin) or into a row marked done, nor onto another
// bead unless asked to cover it (a drag, ticket 1162), its beads then taking those places as a Paste's do.

/** The Project with a Selection's beads moved, and the Selection where they went. */
export interface MovedSelection {
  project: Project
  selection: Selection
}

/** After how many rows and columns the stagger of the Selection's layer repeats. */
function cyclesOf(project: Project, selection: Selection): { rows: number; columns: number } {
  const { weave } = layerSheet(project, selectionLayer(project, selection))
  return { rows: rowCycle(weave), columns: columnCycle(weave) }
}

/** The move nearest to one by `rows` and `columns` that keeps the Selection's beads touching as they do: by whole
 * cycles of its layer's stagger (a pair of columns on peyote, a pair of rows on brick stitch). */
export function wholeMove(project: Project, selection: Selection, rows: number, columns: number): { rows: number; columns: number } {
  const cycle = cyclesOf(project, selection)
  return { rows: wholeCycles(rows, cycle.rows), columns: wholeCycles(columns, cycle.columns) }
}

/** The move a step of `rows` and `columns` on the keys makes: a bead, or where the stagger repeats later one whole
 * cycle of it (see `wholeMove`). */
export function stepMove(project: Project, selection: Selection, rows: number, columns: number): { rows: number; columns: number } {
  const cycle = cyclesOf(project, selection)
  return { rows: rows * cycle.rows, columns: columns * cycle.columns }
}

/** A Selection's beads moved by whole beads on its layer, the Selection going with them and a Piece's name with its
 * beads; with `cover`, over any bead in the way. None when the move can't be made whole (see above), or there is
 * nothing to move. */
export function moveLayerSelection(project: Project, selection: Selection, rows: number, columns: number, { cover = false }: { cover?: boolean } = {}): MovedSelection | undefined {
  const layer = selectionLayer(project, selection)
  const sheet = layerSheet(project, layer)
  if (!sheet.geometry.grid || (rows === 0 && columns === 0)) return undefined
  const selectable = selectableOn(project, sheet)
  const finished = (cell: GridPosition) => layer === 'frame' && isInFinishedRow(project, { ...positionOnCanvas(project, 'frame', cell), layer: 'frame' })

  const lifted: BeadChange[] = []
  for (const { row, column } of selectionCells(sheet, selectionInLayer(project, layer, selection), selectable)) {
    const color = colorAt(sheet.beads, row, column)
    if (color) lifted.push({ row, column, color })
  }
  if (lifted.length === 0) return undefined
  const own = new Set(lifted.map(({ row, column }) => cellKey(row, column)))
  const landed = lifted.map(({ row, column, color }) => ({ row: row + rows, column: column + columns, color }))
  const taken = (at: GridPosition) => !cover && !own.has(cellKey(at.row, at.column)) && colorAt(sheet.beads, at.row, at.column) !== null
  const blocked = (at: GridPosition) => !selectable(at.row, at.column) || finished(at) || taken(at)
  if (lifted.some(finished) || landed.some(blocked)) return undefined

  const moved = onLayer(project, layer, ({ beads }) => withColors(beads, [...lifted.map(({ row, column }) => ({ row, column, color: null })), ...landed]))
  // Pieces and their names are the Canvas's, whose positions are its own. A bead it covers is gone, so a name follows
  // what is left of its Piece, and is dropped with the last of it.
  const covered = new Set(landed.map(({ row, column }) => cellKey(row, column)))
  const where = (at: GridPosition) => {
    const key = cellKey(at.row, at.column)
    if (own.has(key)) return { row: at.row + rows, column: at.column + columns }
    return covered.has(key) ? undefined : at
  }
  const carried = layer === 'canvas' ? carryNames(project, moved, where) : moved
  const next = movedSelection(selection, rows, columns)
  return { project: carried, selection: selection.cells ? { ...next, cells: selection.cells.map((cell) => ({ row: cell.row + rows, column: cell.column + columns })) } : next }
}

import { beadPitchMm } from './beads'
import type { GridPosition } from './grid'
import { insideBounds, type CellCenter, type GeometryStrategy, type RowsGeometry } from './weaveGeometry'

/** Beads laid on rows (loom, peyote, brick stitch; ADR 0078): every other row, or block of `brickBlock` rows, sits
 * `shift` across where the rows are shifted, and rows sit `rowPitch` apart. Passes are lines: one each, or peyote's
 * first line in one pass and every later one in two. */
export const rowsGeometry: GeometryStrategy<RowsGeometry> = (geometry, { brickBlock }, cell) => {
  const { shifted, shift, rowPitch, passes } = geometry
  const frameStep = shifted ? 2 * brickBlock : 1
  const twoPasses = passes === 'twoAfterFirst'
  // The second half of each cycle is shifted, whichever side of row 0 it is on.
  const isShiftedRow = (row: number): boolean => frameStep > 1 && Math.abs(Math.floor((row * 2) / frameStep)) % 2 === 1
  const rowOffset = (row: number, cellSize: number): number => (isShiftedRow(row) ? cellSize * shift : 0)
  const center = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): CellCenter => ({
    x: column * cellWidth + cellWidth / 2 + rowOffset(row, cellWidth),
    y: cellHeight / 2 + row * (cellHeight * rowPitch),
  })
  // A row's cell overlaps the same column of a row with the same offset, and two columns of a row offset the other way.
  const overlappingColumns = (fromRow: number, toRow: number, column: number): number[] => {
    const from = rowOffset(fromRow, 1)
    const to = rowOffset(toRow, 1)
    if (to > from) return [column - 1, column]
    if (to < from) return [column, column + 1]
    return [column]
  }
  const lineOf = (pass: number): number => (twoPasses && pass > 0 ? Math.ceil(pass / 2) : pass)
  return {
    shifted,
    shift,
    rowPitch,
    cellAspect: cell?.aspect ?? geometry.cellAspect,
    roundness: geometry.roundness,
    countsUnits: false,
    frameStep,
    hasPosition: () => true,
    orientationAt: () => 'upright',
    box: (position, cellWidth, cellHeight) => {
      const { x, y } = center(position, cellWidth, cellHeight)
      return { x: x - cellWidth / 2, y: y - cellHeight / 2, width: cellWidth, height: cellHeight }
    },
    blockExtent: (columns, rows, cellWidth, cellHeight) => ({
      width: columns * cellWidth + (shifted ? cellWidth * shift : 0),
      height: rows === 0 ? 0 : cellHeight + (rows - 1) * (cellHeight * rowPitch),
    }),
    positionAt: () => undefined,
    nearestPosition: () => ({ row: 0, column: 0 }),
    rowsPerUnit: 1,
    columnsPerUnit: 1,
    columnStep: 1,
    snapRight: (_left, right) => right,
    visible: () => ({ firstRow: 0, lastRow: -1, first: 0, last: -1 }),
    tile: (cellWidth, cellHeight) => ({ size: { width: cellWidth, height: cellHeight }, beads: [{ x: 0, y: 0, width: cellWidth, height: cellHeight }] }),
    origin: (position, cellWidth, cellHeight) => ({ x: position.column * cellWidth, y: position.row * cellHeight }),
    positionsOf: (units) => units,
    unitsOf: (positions) => positions,
    snapBottom: (_top, bottom) => bottom,
    smallest: { columns: 1, rows: 1 },
    center,
    // Same-row left and right, plus the overlapping cells above and below, so Fill follows real adjacency (ticket 06).
    neighbors: (bounds, { row, column }) => {
      const candidates: GridPosition[] = [
        { row, column: column - 1 },
        { row, column: column + 1 },
      ]
      for (const neighborRow of [row - 1, row + 1]) {
        for (const c of overlappingColumns(row, neighborRow, column)) candidates.push({ row: neighborRow, column: c })
      }
      return candidates.filter((position) => insideBounds(bounds, position))
    },
    twoPasses,
    passes: {
      count: (lines) => (!twoPasses || lines <= 0 ? Math.max(0, lines) : 1 + (lines - 1) * 2),
      of: (line, along) => (!twoPasses || line === 0 ? line : (line - 1) * 2 + 1 + (along % 2)),
      lineOf,
      lines: (pass) => [lineOf(pass)],
    },
    turned: ({ row, column }, block) => ({ row: column, column: block.rows - 1 - row }),
    snapSelection: (selection) => selection,
    fitBlock: (topLeft) => topLeft,
    stepMm: (bead) => ({ across: beadPitchMm(bead), down: bead.heightMm * rowPitch }),
  }
}

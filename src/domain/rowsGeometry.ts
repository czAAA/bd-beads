import { beadPitchMm } from './beads'
import type { GridPosition } from './grid'
import { insideBounds, type Box, type CellCenter, type GeometryStrategy, type RowsGeometry } from './weaveGeometry'

/** Beads laid on rows (loom, peyote, brick stitch; ADR 0078): every other row, or block of `brickBlock` rows, sits
 * `shift` across where the rows are shifted, and rows sit `rowPitch` apart. Passes are lines: one each, or peyote's
 * first line in one pass and every later one in two. */
export const rowsGeometry: GeometryStrategy<RowsGeometry> = (geometry, { brickBlock }, cell) => {
  const { shifted, shift, rowPitch, passes } = geometry
  const frameStep = shifted ? 2 * brickBlock : 1
  const twoPasses = passes === 'twoAfterFirst'
  // A Real cell's own rounding, which a press in a bead's corner misses.
  const roundness = cell?.roundness ?? geometry.roundness
  // The second half of each cycle is shifted, whichever side of row 0 it is on.
  const isShiftedRow = (row: number): boolean => frameStep > 1 && Math.abs(Math.floor((row * 2) / frameStep)) % 2 === 1
  const rowOffset = (row: number, cellSize: number): number => (isShiftedRow(row) ? cellSize * shift : 0)
  const center = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): CellCenter => ({
    x: column * cellWidth + cellWidth / 2 + rowOffset(row, cellWidth),
    y: cellHeight / 2 + row * (cellHeight * rowPitch),
  })
  const box = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): Box => ({
    x: rowOffset(row, cellWidth) + column * cellWidth,
    y: row * (cellHeight * rowPitch),
    width: cellWidth,
    height: cellHeight,
  })
  const blockExtent = (columns: number, rows: number, cellWidth: number, cellHeight: number) => ({
    width: columns * cellWidth + (shifted ? cellWidth * shift : 0),
    height: rows === 0 ? 0 : cellHeight + (rows - 1) * (cellHeight * rowPitch),
  })
  // The rows whose beads reach a height of the grid: a bead hangs its height below its row's top.
  const rowsAt = (top: number, bottom: number, cellHeight: number) => ({
    firstRow: Math.ceil((top - cellHeight) / (cellHeight * rowPitch)),
    lastRow: Math.floor(bottom / (cellHeight * rowPitch)),
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
    box,
    rowOffset,
    blockExtent,
    blockBox: ({ row, column, rows, columns }, cellWidth, cellHeight) => ({
      x: column * cellWidth,
      y: row * (cellHeight * rowPitch),
      ...blockExtent(columns, rows, cellWidth, cellHeight),
    }),
    // The marks either side of a column edge are a shifted and an unshifted row's; a row's middle is its beads'.
    boundary: ({ row, column, rows, columns }, cellWidth, cellHeight) => {
      const pitch = cellHeight * rowPitch
      const top = row * pitch + cellHeight / 2 - pitch / 2
      const left = column * cellWidth + cellWidth / 4
      return { x: left, y: top, width: (column + columns) * cellWidth + cellWidth / 4 - left, height: (row + rows - 1) * pitch + cellHeight / 2 + pitch / 2 - top }
    },
    unitSize: (cellWidth, cellHeight) => ({ width: cellWidth, height: cellHeight }),
    unitMiddle: (cellWidth, cellHeight) => ({ x: cellWidth / 2, y: cellHeight / 2 }),
    // Later rows are drawn over earlier ones, so the lowest row whose bead holds the point wins; a rounded corner misses.
    positionAt: (x, y, cellWidth, cellHeight, within) => {
      const { firstRow, lastRow } = rowsAt(y, y, cellHeight)
      const radius = roundness * cellWidth
      for (let row = Math.min(lastRow, within ? within.rows - 1 : Infinity); row >= Math.max(firstRow, within ? 0 : -Infinity); row -= 1) {
        const { x: left, y: top } = box({ row, column: 0 }, cellWidth, cellHeight)
        const offsetX = x - left
        const offsetY = y - top
        if (offsetY < 0 || offsetY >= cellHeight || (within && offsetX < 0)) continue
        const column = Math.floor(offsetX / cellWidth)
        if (within && column >= within.columns) continue
        if (inRoundedCorner(offsetX - column * cellWidth, offsetY, radius, cellWidth, cellHeight)) continue
        return { row, column }
      }
      return undefined
    },
    nearestPosition: (x, y, cellWidth, cellHeight) => {
      // + 0 turns a rounded -0 into row 0.
      const row = Math.round((y - cellHeight / 2) / (cellHeight * rowPitch)) + 0
      return { row, column: Math.floor((x - rowOffset(row, cellWidth)) / cellWidth) }
    },
    rowsPerUnit: 1,
    columnsPerUnit: 1,
    columnStep: 1,
    snapRight: (_left, right) => right,
    visible: (area, cellWidth, cellHeight) => ({
      ...rowsAt(area.top, area.bottom, cellHeight),
      columnsOf: (row) => {
        const offset = rowOffset(row, cellWidth)
        return { first: Math.ceil((area.left - offset - cellWidth) / cellWidth), last: Math.floor((area.right - offset) / cellWidth) }
      },
    }),
    tile: (cellWidth, cellHeight) => {
      const rows = Math.max(2, frameStep)
      return {
        size: { width: cellWidth, height: rows * (cellHeight * rowPitch) },
        beads: Array.from({ length: rows }, (_row, row) => box({ row, column: 0 }, cellWidth, cellHeight)),
      }
    },
    origin: (position, cellWidth, cellHeight) => {
      const { x, y } = box(position, cellWidth, cellHeight)
      return { x, y }
    },
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

/** Whether a point of a bead's cell, from its top-left, lies outside its rounded corners. A corner can't be rounder
 * than half the shorter side (a pill). */
function inRoundedCorner(x: number, y: number, wanted: number, width: number, height: number): boolean {
  const radius = Math.min(wanted, width / 2, height / 2)
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > width - radius ? width - radius : x
  const cornerY = y < radius ? radius : y > height - radius ? height - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

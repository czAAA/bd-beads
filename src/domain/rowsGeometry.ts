import type { GridPosition } from './grid'
import { insideBounds, inRoundedCorner, linePasses, type Box, type CellCenter, type GeometryStrategy, type RowsGeometry } from './weaveGeometry'

// The columns a bead reaches in a row offset further right, further left, or the same (see `reach`).
const REACH_BACK = [-1, 0] as const
const REACH_ON = [0, 1] as const
const REACH_SAME = [0, 0] as const

/** Beads laid on rows (loom, brick stitch; ADR 0078): every other row, or block of `block` rows, sits `shift` across
 * where the rows are shifted, and rows sit a full bead apart. Passes are lines: one each. */
export const rowsGeometry: GeometryStrategy<RowsGeometry> = (geometry, cell) => {
  const { shifted, shift, passes, block } = geometry
  const rowCycle = shifted ? 2 * block : 1
  const twoPasses = passes === 'twoAfterFirst'
  // A Bead's cell's own rounding, which a press in a bead's corner misses.
  const roundness = cell?.roundness ?? geometry.roundness
  // The second half of each cycle is shifted, whichever side of row 0 it is on.
  const isShiftedRow = (row: number): boolean => rowCycle > 1 && Math.abs(Math.floor((row * 2) / rowCycle)) % 2 === 1
  const rowOffset = (row: number, cellSize: number): number => (isShiftedRow(row) ? cellSize * shift : 0)
  const center = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): CellCenter => ({
    x: column * cellWidth + cellWidth / 2 + rowOffset(row, cellWidth),
    y: cellHeight / 2 + row * cellHeight,
  })
  const box = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): Box => ({
    x: rowOffset(row, cellWidth) + column * cellWidth,
    y: row * cellHeight,
    width: cellWidth,
    height: cellHeight,
  })
  const blockExtent = (columns: number, rows: number, cellWidth: number, cellHeight: number) => ({
    width: columns * cellWidth + (shifted ? cellWidth * shift : 0),
    height: rows * cellHeight,
  })
  // The rows whose beads reach a height of the grid: a bead hangs its height below its row's top.
  const rowsAt = (top: number, bottom: number, cellHeight: number) => ({
    firstRow: Math.ceil((top - cellHeight) / cellHeight),
    lastRow: Math.floor(bottom / cellHeight),
  })
  // A row's cell overlaps the same column of a row with the same offset, and two columns of a row offset the other way.
  const reach = (fromRow: number, toRow: number): readonly [number, number] => {
    const from = rowOffset(fromRow, 1)
    const to = rowOffset(toRow, 1)
    return to > from ? REACH_BACK : to < from ? REACH_ON : REACH_SAME
  }
  return {
    shifted,
    shift,
    staggers: 'rows',
    cellAspect: cell?.aspect ?? geometry.cellAspect,
    roundness: geometry.roundness,
    rowCycle,
    columnCycle: 1,
    box,
    rowOffset,
    columnOffset: () => 0,
    blockExtent,
    blockBox: ({ row, column, rows, columns }, cellWidth, cellHeight) => ({
      x: column * cellWidth,
      y: row * cellHeight,
      ...blockExtent(columns, rows, cellWidth, cellHeight),
    }),
    // The marks either side of a column edge are a shifted and an unshifted row's; a row's middle is its beads'.
    boundary: ({ row, column, rows, columns }, cellWidth, cellHeight) => {
      const top = row * cellHeight
      const left = column * cellWidth + cellWidth / 4
      return { x: left, y: top, width: (column + columns) * cellWidth + cellWidth / 4 - left, height: (row + rows) * cellHeight - top }
    },
    // Rows don't overlap, so the one row whose bead holds the point is the answer; a rounded corner misses.
    positionAt: (x, y, cellWidth, cellHeight, within) => {
      const row = Math.floor(y / cellHeight)
      if (within && (row < 0 || row >= within.rows)) return undefined
      const offsetX = x - rowOffset(row, cellWidth)
      if (within && offsetX < 0) return undefined
      const column = Math.floor(offsetX / cellWidth)
      if (within && column >= within.columns) return undefined
      return inRoundedCorner(offsetX - column * cellWidth, y - row * cellHeight, roundness * cellWidth, cellWidth, cellHeight) ? undefined : { row, column }
    },
    nearestPosition: (x, y, cellWidth, cellHeight) => {
      // + 0 turns a rounded -0 into row 0.
      const row = Math.round((y - cellHeight / 2) / cellHeight) + 0
      return { row, column: Math.floor((x - rowOffset(row, cellWidth)) / cellWidth) }
    },
    visible: (area, cellWidth, cellHeight) => ({
      ...rowsAt(area.top, area.bottom, cellHeight),
      columnsOf: (row) => {
        const offset = rowOffset(row, cellWidth)
        return { first: Math.ceil((area.left - offset - cellWidth) / cellWidth), last: Math.floor((area.right - offset) / cellWidth) }
      },
    }),
    tile: (cellWidth, cellHeight) => {
      const rows = Math.max(2, rowCycle)
      return {
        size: { width: cellWidth, height: rows * cellHeight },
        beads: Array.from({ length: rows }, (_row, row) => box({ row, column: 0 }, cellWidth, cellHeight)),
      }
    },
    origin: (position, cellWidth, cellHeight) => {
      const { x, y } = box(position, cellWidth, cellHeight)
      return { x, y }
    },
    center,
    // Same-row left and right, plus the overlapping cells above and below, so Fill follows real adjacency (ticket 06).
    neighbors: (bounds, { row, column }) => {
      const candidates: GridPosition[] = [
        { row, column: column - 1 },
        { row, column: column + 1 },
      ]
      for (const neighborRow of [row - 1, row + 1]) {
        const [first, last] = reach(row, neighborRow)
        for (let c = column + first; c <= column + last; c += 1) candidates.push({ row: neighborRow, column: c })
      }
      return candidates.filter((position) => insideBounds(bounds, position))
    },
    spans: { along: 'row', reach },
    twoPasses,
    passes: linePasses(twoPasses),
    turned: ({ row, column }, block) => ({ row: column, column: block.rows - 1 - row }),
  }
}

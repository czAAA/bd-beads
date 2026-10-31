import type { GridPosition } from './grid'
import { insideBounds, inRoundedCorner, linePasses, type Box, type CellCenter, type ColumnsGeometry, type GeometryStrategy } from './weaveGeometry'

// The rows a bead reaches in a column offset further down, further up, or the same (see `reach`).
const REACH_BACK = [-1, 0] as const
const REACH_ON = [0, 1] as const
const REACH_SAME = [0, 0] as const

/** Beads laid on columns (peyote, ticket 0734): every other column, or block of `block` columns, sits `shift` of a
 * bead down, and columns and rows sit a full bead apart, so nothing nests. The thread runs along a row, where passes
 * are lines: the first in one pass, every later one in two (even beads, then odd). */
export const columnsGeometry: GeometryStrategy<ColumnsGeometry> = (geometry, cell) => {
  const { shift, passes, block } = geometry
  const columnCycle = 2 * block
  const twoPasses = passes === 'twoAfterFirst'
  // A Bead's cell's own rounding, which a press in a bead's corner misses.
  const roundness = cell?.roundness ?? geometry.roundness
  // The second half of each cycle is shifted, whichever side of column 0 it is on.
  const isShiftedColumn = (column: number): boolean => Math.abs(Math.floor((column * 2) / columnCycle)) % 2 === 1
  const columnOffset = (column: number, cellHeight: number): number => (isShiftedColumn(column) ? cellHeight * shift : 0)
  const center = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): CellCenter => ({
    x: column * cellWidth + cellWidth / 2,
    y: row * cellHeight + cellHeight / 2 + columnOffset(column, cellHeight),
  })
  const box = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): Box => ({
    x: column * cellWidth,
    y: row * cellHeight + columnOffset(column, cellHeight),
    width: cellWidth,
    height: cellHeight,
  })
  const blockExtent = (columns: number, rows: number, cellWidth: number, cellHeight: number) => ({
    width: columns * cellWidth,
    height: rows * cellHeight + cellHeight * shift,
  })
  // The columns whose beads reach a width of the grid: a bead hangs its width right of its column's left.
  const columnsAt = (left: number, right: number, cellWidth: number) => ({
    first: Math.ceil((left - cellWidth) / cellWidth),
    last: Math.floor(right / cellWidth),
  })
  // A column's cell overlaps the same row of a column with the same offset, and two rows of a column offset the other way.
  const reach = (fromColumn: number, toColumn: number): readonly [number, number] => {
    const from = columnOffset(fromColumn, 1)
    const to = columnOffset(toColumn, 1)
    return to > from ? REACH_BACK : to < from ? REACH_ON : REACH_SAME
  }
  return {
    shifted: true,
    shift,
    staggers: 'columns',
    cellAspect: cell?.aspect ?? geometry.cellAspect,
    roundness: geometry.roundness,
    rowCycle: 1,
    columnCycle,
    box,
    rowOffset: () => 0,
    columnOffset,
    blockExtent,
    blockBox: ({ row, column, rows, columns }, cellWidth, cellHeight) => ({
      x: column * cellWidth,
      y: row * cellHeight,
      ...blockExtent(columns, rows, cellWidth, cellHeight),
    }),
    // The marks either side of a row edge are a shifted and an unshifted column's; a column's middle is its beads'.
    boundary: ({ row, column, rows, columns }, cellWidth, cellHeight) => {
      const top = row * cellHeight + cellHeight / 4
      const left = column * cellWidth
      return { x: left, y: top, width: (column + columns) * cellWidth - left, height: (row + rows) * cellHeight + cellHeight / 4 - top }
    },
    // Columns don't overlap, so the one column whose bead holds the point is the answer; a rounded corner misses.
    positionAt: (x, y, cellWidth, cellHeight, within) => {
      const column = Math.floor(x / cellWidth)
      if (within && (column < 0 || column >= within.columns)) return undefined
      const offsetY = y - columnOffset(column, cellHeight)
      if (within && offsetY < 0) return undefined
      const row = Math.floor(offsetY / cellHeight)
      if (within && row >= within.rows) return undefined
      return inRoundedCorner(x - column * cellWidth, offsetY - row * cellHeight, roundness * cellWidth, cellWidth, cellHeight) ? undefined : { row, column }
    },
    nearestPosition: (x, y, cellWidth, cellHeight) => {
      const column = Math.floor(x / cellWidth)
      // + 0 turns a rounded -0 into row 0.
      return { row: Math.round((y - columnOffset(column, cellHeight) - cellHeight / 2) / cellHeight) + 0, column }
    },
    // A shifted column's beads hang half a bead lower, so the rows reach as far as the lowest of them.
    visible: (area, cellWidth, cellHeight) => {
      const { first, last } = columnsAt(area.left, area.right, cellWidth)
      return {
        firstRow: Math.ceil((area.top - cellHeight - cellHeight * shift) / cellHeight),
        lastRow: Math.floor(area.bottom / cellHeight),
        columnsOf: () => ({ first, last }),
      }
    },
    tile: (cellWidth, cellHeight) => {
      const columns = Math.max(2, columnCycle)
      return {
        size: { width: columns * cellWidth, height: cellHeight },
        beads: Array.from({ length: columns }, (_column, column) => box({ row: 0, column }, cellWidth, cellHeight)),
      }
    },
    origin: (position, cellWidth, cellHeight) => {
      const { x, y } = box(position, cellWidth, cellHeight)
      return { x, y }
    },
    center,
    // Same-column above and below, plus the overlapping cells of the columns beside, so Fill follows real adjacency.
    neighbors: (bounds, { row, column }) => {
      const candidates: GridPosition[] = [
        { row: row - 1, column },
        { row: row + 1, column },
      ]
      for (const neighborColumn of [column - 1, column + 1]) {
        const [first, last] = reach(column, neighborColumn)
        for (let r = row + first; r <= row + last; r += 1) candidates.push({ row: r, column: neighborColumn })
      }
      return candidates.filter((position) => insideBounds(bounds, position))
    },
    spans: { along: 'column', reach },
    twoPasses,
    passes: linePasses(twoPasses),
    turned: ({ row, column }, blockSize) => ({ row: column, column: blockSize.rows - 1 - row }),
  }
}

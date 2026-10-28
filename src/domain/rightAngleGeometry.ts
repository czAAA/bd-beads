import { beadPitchMm } from './beads'
import type { Rect } from './canvas'
import type { GridDimensions, GridPosition } from './grid'
import { beadsBox, insideBounds, keptWithin, type Box, type GeometryStrategy, type RightAngleGeometry } from './weaveGeometry'

const isHorizontalLine = (row: number): boolean => ((row % 2) + 2) % 2 === 0

const unitsOf = ({ columns, rows }: GridDimensions): GridDimensions => ({
  columns: Math.max(0, columns - 1),
  rows: Math.max(0, Math.floor((rows - 1) / 2)),
})

/** Right-angle weave (ticket 482): rows alternate between horizontal beads, lying along their line (one per Unit), and
 * upright vertical ones (one more). A Unit's side is a bead's length plus its width: `cellWidth` the length, `cellHeight`
 * the width. Beads touch at their corners, round a hole one length square. A pass weaves a line of Units (ticket 484). */
export const rightAngleGeometry: GeometryStrategy<RightAngleGeometry> = (geometry, cell) => {
  const orientationAt = ({ row }: GridPosition): 'sideways' | 'upright' => (isHorizontalLine(row) ? 'sideways' : 'upright')
  const box = (position: GridPosition, length: number, width: number): Box => {
    const side = length + width
    const line = Math.floor(position.row / 2)
    return isHorizontalLine(position.row)
      ? { x: position.column * side + width, y: line * side, width: length, height: width }
      : { x: position.column * side, y: line * side + width, width, height: length }
  }
  const beadsBoxOf = (block: Rect, length: number, width: number): Box => beadsBox({ box, orientationAt }, block, length, width)
  return {
    shifted: false,
    shift: 0,
    rowPitch: 1,
    cellAspect: cell?.aspect ?? geometry.aspect,
    roundness: geometry.roundness,
    countsUnits: true,
    frameStep: 2,
    hasPosition: (position, frame) =>
      !(
        frame &&
        isHorizontalLine(position.row) &&
        position.row >= frame.row &&
        position.row < frame.row + frame.rows &&
        position.column === frame.column + frame.columns - 1
      ),
    orientationAt,
    box,
    rowOffset: () => 0,
    blockBox: beadsBoxOf,
    boundary: beadsBoxOf,
    unitSize: (length, width) => ({ width: length + width, height: length + width }),
    unitMiddle: (length, width) => ({ x: (length + width) / 2, y: (length + width) / 2 }),
    blockExtent: (columns, rows, length, width) => {
      const side = length + width
      const units = unitsOf({ columns, rows })
      return { width: columns > 0 ? units.columns * side + width : 0, height: rows > 0 ? units.rows * side + width : 0 }
    },
    positionAt: (x, y, length, width) => {
      const side = length + width
      const line = Math.floor(y / side)
      if (y - line * side < width) {
        const across = x - width
        const unit = Math.floor(across / side)
        return across - unit * side < length ? { row: line * 2, column: unit } : undefined
      }
      const column = Math.floor(x / side)
      return x - column * side < width ? { row: line * 2 + 1, column } : undefined
    },
    nearestPosition: (x, y, length, width) => {
      const side = length + width
      const line = Math.floor(y / side)
      const column = Math.floor(x / side)
      let best: { position: GridPosition; distance: number } | undefined
      for (let row = line * 2 - 1; row <= line * 2 + 2; row += 1) {
        for (let c = column - 1; c <= column + 1; c += 1) {
          const { x: left, y: top, width: w, height: h } = box({ row, column: c }, length, width)
          const distance = (x - left - w / 2) ** 2 + (y - top - h / 2) ** 2
          if (!best || distance < best.distance) best = { position: { row, column: c }, distance }
        }
      }
      return best!.position
    },
    rowsPerUnit: 2,
    columnsPerUnit: 1,
    columnStep: 1,
    snapRight: (_left, right) => right,
    tile: (length, width) => ({ size: { width: length + width, height: length + width }, beads: [0, 1].map((row) => box({ row, column: 0 }, length, width)) }),
    // A Unit's pitch down is two rows, so the lines either side of the ones in view are asked for as well.
    visible: (area, length, width) => {
      const side = length + width
      const columns = { first: Math.floor(area.left / side) - 1, last: Math.floor(area.right / side) + 1 }
      return { firstRow: Math.floor(area.top / side) * 2 - 1, lastRow: Math.floor(area.bottom / side) * 2 + 2, columnsOf: () => columns }
    },
    origin: ({ row, column }, length, width) => ({ x: column * (length + width), y: (row / 2) * (length + width) }),
    positionsOf: ({ columns, rows }) => ({ columns: columns + 1, rows: rows * 2 + 1 }),
    unitsOf,
    snapBottom: (top, bottom) => Math.max(top + 2, bottom + (((bottom - top) % 2) + 2) % 2),
    smallest: { columns: 2, rows: 3 },
    center: (position, length, width) => {
      const { x, y, width: w, height: h } = box(position, length, width)
      return { x: x + w / 2, y: y + h / 2 }
    },
    // A horizontal bead meets the vertical beads on the lines above and below at its own column and the next, a
    // vertical one the horizontal beads on the lines above and below at its own and the previous.
    neighbors: (bounds, { row, column }) => {
      const across = isHorizontalLine(row) ? [column, column + 1] : [column - 1, column]
      return [row - 1, row + 1].flatMap((next) => across.map((c) => ({ row: next, column: c }))).filter((position) => insideBounds(bounds, position))
    },
    twoPasses: false,
    passes: {
      count: (lines, direction) => Math.max(0, direction === 'rows' ? Math.floor((lines - 1) / 2) : lines - 1),
      // Down a column the horizontal beads (even rows) belong to their own column, the vertical ones to the Unit left of them.
      of: (line, along, direction) => Math.max(0, direction === 'rows' ? Math.floor((line - 1) / 2) : line - (along % 2 === 1 ? 1 : 0)),
      lineOf: (pass, direction) => (direction === 'rows' ? pass * 2 : pass),
      lines: (pass, direction) => {
        if (direction === 'columns') return [pass, pass + 1]
        return pass === 0 ? [0, 1, 2] : [pass * 2 + 1, pass * 2 + 2]
      },
    },
    turned: ({ row, column }, block) => {
      const lines = Math.floor((block.rows - 1) / 2)
      const line = Math.floor(row / 2)
      if (isHorizontalLine(row)) {
        return column < block.columns - 1 ? { row: 2 * column + 1, column: lines - line } : undefined
      }
      return { row: 2 * column, column: lines - line - 1 }
    },
    snapSelection: (selection, within) => {
      const top = selection.top - (((selection.top % 2) + 2) % 2)
      const last = selection.top + selection.rows - 1
      const bottom = Math.max(top + 2, last + (((last % 2) + 2) % 2))
      const right = Math.max(selection.left + selection.columns - 1, selection.left + 1)
      return keptWithin({ top, left: selection.left, rows: bottom - top + 1, columns: right - selection.left + 1 }, selection, within)
    },
    fitBlock: (topLeft) => topLeft,
    stepMm: (bead) => ({ across: beadPitchMm(bead) + bead.heightMm, down: beadPitchMm(bead) + bead.heightMm }),
  }
}

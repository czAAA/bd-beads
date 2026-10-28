import { beadPitchMm } from './beads'
import type { Rect } from './canvas'
import type { GridPosition } from './grid'
import { beadsBox, insideBounds, keptWithin, modulo, type Box, type GeometryStrategy, type NetGeometry } from './weaveGeometry'

/** A bead's face reaches half a cell from its centre: squared, in cells, for a round bead's hit test. */
const BEAD_FACE_DISTANCE = 0.25

/** Netting, horizontal (ticket 485): beads on the two diagonals of a diamond mesh, p = (loopBeads + 1) / 2 positions
 * from one shared bead to the next. A diamond is 2p wide and tall and holds `loopBeads` beads; a position off a
 * diagonal is a hole, no position. A Frame starts on a multiple of 2p each way, so its lattice is the Canvas's. */
export const netGeometry: GeometryStrategy<NetGeometry> = ({ step, cellAspect, roundness, loopBeads }, cell) => {
  const p = (loopBeads + 1) / 2
  const period = 2 * p
  const hasPosition = ({ row, column }: GridPosition): boolean =>
    modulo(column - row - p, period) === 0 || modulo(column + row - p, period) === 0
  const box = ({ row, column }: GridPosition, cellWidth: number, cellHeight: number): Box => ({
    x: column * step * cellWidth,
    y: row * step * cellHeight,
    width: cellWidth,
    height: cellHeight,
  })
  const beadsBoxOf = (block: Rect, cellWidth: number, cellHeight: number): Box => beadsBox({ box, orientationAt: () => 'upright' }, block, cellWidth, cellHeight)
  const extent = (count: number, size: number): number => (count > 0 ? (count - 1) * step * size + size : 0)
  // The bead nearest a point, among the positions within `reach` steps of the one it falls on.
  const nearest = (x: number, y: number, cellWidth: number, cellHeight: number, reach: number): { position: GridPosition; distance: number } | undefined => {
    const column = Math.round((x - cellWidth / 2) / (step * cellWidth))
    const row = Math.round((y - cellHeight / 2) / (step * cellHeight))
    let best: { position: GridPosition; distance: number } | undefined
    for (let r = row - reach; r <= row + reach; r += 1) {
      for (let c = column - reach; c <= column + reach; c += 1) {
        if (!hasPosition({ row: r, column: c })) continue
        const { x: left, y: top } = box({ row: r, column: c }, cellWidth, cellHeight)
        const distance = ((x - left - cellWidth / 2) / cellWidth) ** 2 + ((y - top - cellHeight / 2) / cellHeight) ** 2
        if (!best || distance < best.distance) best = { position: { row: r, column: c }, distance }
      }
    }
    return best
  }
  return {
    shifted: false,
    shift: 0,
    rowPitch: step,
    cellAspect: cell?.aspect ?? cellAspect,
    roundness,
    countsUnits: true,
    frameStep: period,
    hasPosition,
    orientationAt: () => 'upright',
    box,
    rowOffset: () => 0,
    blockBox: beadsBoxOf,
    boundary: beadsBoxOf,
    unitSize: (cellWidth, cellHeight) => ({ width: period * step * cellWidth, height: period * step * cellHeight }),
    unitMiddle: (cellWidth, cellHeight) => ({ x: (period * step * cellWidth) / 2, y: (p * step * cellHeight) / 2 }),
    blockExtent: (columns, rows, cellWidth, cellHeight) => ({ width: extent(columns, cellWidth), height: extent(rows, cellHeight) }),
    // A press lands on a bead only inside its round face.
    positionAt: (x, y, cellWidth, cellHeight) => {
      const found = nearest(x, y, cellWidth, cellHeight, 1)
      return found && found.distance <= BEAD_FACE_DISTANCE ? found.position : undefined
    },
    nearestPosition: (x, y, cellWidth, cellHeight) => nearest(x, y, cellWidth, cellHeight, p + 1)?.position ?? { row: 0, column: 0 },
    rowsPerUnit: p,
    columnsPerUnit: period,
    columnStep: period,
    snapRight: (left, right) => left + Math.max(period, Math.ceil((right - left) / period) * period),
    tile: (cellWidth, cellHeight) => ({
      size: { width: period * step * cellWidth, height: period * step * cellHeight },
      beads: Array.from({ length: period * period }, (_cell, at) => ({ row: Math.floor(at / period), column: at % period }))
        .filter(hasPosition)
        .map((position) => box(position, cellWidth, cellHeight)),
    }),
    visible: (area, cellWidth, cellHeight) => {
      const columns = { first: Math.floor((area.left - cellWidth) / (step * cellWidth)), last: Math.ceil(area.right / (step * cellWidth)) }
      return { firstRow: Math.floor((area.top - cellHeight) / (step * cellHeight)), lastRow: Math.ceil(area.bottom / (step * cellHeight)), columnsOf: () => columns }
    },
    origin: ({ row, column }, cellWidth, cellHeight) => ({ x: column * step * cellWidth, y: row * step * cellHeight }),
    positionsOf: ({ columns, rows }) => ({ columns: columns * period + 1, rows: (rows + 1) * p + 1 }),
    unitsOf: ({ columns, rows }) => ({
      columns: Math.max(0, Math.floor((columns - 1) / period)),
      rows: Math.max(0, Math.floor((rows - 1) / p) - 1),
    }),
    snapBottom: (top, bottom) => top + Math.max(2 * p, Math.ceil((bottom - top) / p) * p),
    smallest: { columns: period + 1, rows: period + 1 },
    center: (position, cellWidth, cellHeight) => {
      const { x, y } = box(position, cellWidth, cellHeight)
      return { x: x + cellWidth / 2, y: y + cellHeight / 2 }
    },
    neighbors: (bounds, { row, column }) =>
      [-1, 1]
        .flatMap((down) => [-1, 1].map((across) => ({ row: row + down, column: column + across })))
        .filter((position) => hasPosition(position) && insideBounds(bounds, position)),
    // A pass along the rows weaves a row of diamonds (ticket 487), 2p tall and starting every p positions: the first
    // whole, each later one from below where the one before ended. Down the columns (never worked) a pass is a line.
    twoPasses: false,
    passes: {
      count: (lines, direction) => (direction === 'rows' ? Math.max(0, Math.floor((lines - 1) / p) - 1) : Math.max(0, lines)),
      of: (line, _along, direction) => (direction === 'rows' ? Math.max(0, Math.ceil(line / p) - 2) : line),
      lineOf: (pass, direction) => (direction === 'rows' ? pass * p : pass),
      lines: (pass, direction) => {
        if (direction === 'columns') return [pass]
        const lastLine = (pass + 2) * p
        const firstLine = pass === 0 ? 0 : (pass + 1) * p + 1
        return Array.from({ length: lastLine - firstLine + 1 }, (_line, at) => firstLine + at)
      },
    },
    turned: () => undefined,
    snapSelection: (selection, within) => {
      const top = selection.top - modulo(selection.top, p)
      const left = selection.left - modulo(selection.left, p)
      const lastRow = selection.top + selection.rows - 1
      const lastColumn = selection.left + selection.columns - 1
      const bottom = Math.max(top + period, lastRow + modulo(-lastRow, p))
      const right = Math.max(left + period, lastColumn + modulo(-lastColumn, p))
      return keptWithin({ top, left, rows: bottom - top + 1, columns: right - left + 1 }, selection, within)
    },
    // The nearest place within a step of where it was aimed that puts the most beads on beads of the mesh.
    fitBlock: (topLeft, offsets) => {
      let best = { position: topLeft, misses: Infinity, distance: Infinity }
      for (let down = -p; down <= p; down += 1) {
        for (let across = -p; across <= p; across += 1) {
          const position = { row: topLeft.row + down, column: topLeft.column + across }
          const misses = offsets.filter((offset) => !hasPosition({ row: position.row + offset.row, column: position.column + offset.column })).length
          const distance = Math.abs(down) + Math.abs(across)
          if (misses < best.misses || (misses === best.misses && distance < best.distance)) best = { position, misses, distance }
        }
      }
      return best.position
    },
    stepMm: (bead) => ({ across: period * step * beadPitchMm(bead), down: p * step * bead.heightMm }),
  }
}

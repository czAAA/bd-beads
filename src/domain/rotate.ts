import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { snapRow } from './frame'
import { isOffsetTechnique, positionKey, type GridPosition } from './grid'
import type { Pattern } from './pattern'
import { touching } from './pieces'

/**
 * Rotate (CONTEXT.md, ADR 0026): a quarter turn clockwise of the Frame and the beads in it, about the Frame's centre. It
 * changes the data, unlike the legacy view-only turn: the beads end up at new positions, and on peyote and brick stitch
 * the way they touch changes with them. The turned Frame may cover Pieces that lay outside the old one; each such Piece
 * moves, whole, to the nearest empty space clear of the turned Frame and its rulers. No bead is lost or overwritten.
 */

/** The beads' gap kept clear round the turned Frame for its line and rulers, and between a moved Piece and anything else. */
const RULER_CLEARANCE = 3

export interface Rotated {
  pattern: Pattern
  /** How many Pieces were in the way and moved outside the Frame. */
  moved: number
}

/** The Frame turned a quarter about its centre: rows and columns swap, and on stitches whose rows alternate it starts on an even row. */
export function rotatedFrame(pattern: Pick<Pattern, 'technique'>, frame: Frame): Frame {
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = frame.rows - frame.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  return { row: snapRow(pattern.technique, frame.row + rowShift), column: frame.column + columnShift, rows: frame.columns, columns: frame.rows }
}

interface Cell extends GridPosition {
  color: string
}

/** Every Piece's beads among the ones given: those that touch by a side or a corner, as lists of cells. */
function groups(pattern: Pick<Pattern, 'technique'>, beads: BeadMap): Cell[][] {
  const unvisited = new Map<string, Cell>()
  forEachBead(beads, (row, column, color) => unvisited.set(positionKey({ row, column }), { row, column, color }))
  const found: Cell[][] = []
  for (const [key, first] of [...unvisited]) {
    if (!unvisited.delete(key)) {
      continue
    }
    const cells: Cell[] = []
    const stack = [first]
    while (stack.length > 0) {
      const at = stack.pop()!
      cells.push(at)
      for (const next of touching(pattern.technique, at)) {
        const neighbour = unvisited.get(positionKey(next))
        if (neighbour) {
          unvisited.delete(positionKey(next))
          stack.push(neighbour)
        }
      }
    }
    found.push(cells)
  }
  return found
}

function boundsOf(cells: readonly GridPosition[]): Frame {
  const rows = cells.map((cell) => cell.row)
  const columns = cells.map((cell) => cell.column)
  const row = Math.min(...rows)
  const column = Math.min(...columns)
  return { row, column, rows: Math.max(...rows) - row + 1, columns: Math.max(...columns) - column + 1 }
}

function overlaps(a: Frame, b: Frame): boolean {
  return a.row < b.row + b.rows && b.row < a.row + a.rows && a.column < b.column + b.columns && b.column < a.column + a.columns
}

/**
 * The nearest shift of a Piece that leaves it clear of the `avoid` rectangle and one bead from every occupied position,
 * so it neither lands on a bead nor joins another Piece. Rows alternate on peyote and brick stitch, so a Piece there
 * moves by whole pairs of rows and keeps its stagger.
 */
function clearShift(pattern: Pick<Pattern, 'technique'>, cells: readonly Cell[], avoid: Frame, occupied: ReadonlySet<string>): GridPosition {
  const box = boundsOf(cells)
  const rowStep = isOffsetTechnique(pattern.technique) ? 2 : 1
  const limit = avoid.rows + avoid.columns + box.rows + box.columns + 2 * RULER_CLEARANCE + 2

  const fits = (dRow: number, dColumn: number): boolean => {
    const moved = { ...box, row: box.row + dRow, column: box.column + dColumn }
    if (overlaps(moved, avoid)) {
      return false
    }
    return cells.every((cell) => {
      const at = { row: cell.row + dRow, column: cell.column + dColumn }
      return !occupied.has(positionKey(at)) && touching(pattern.technique, at).every((next) => !occupied.has(positionKey(next)))
    })
  }

  for (let distance = 1; distance <= limit; distance += 1) {
    let best: GridPosition | undefined
    let bestSquare = Infinity
    for (let dRow = -distance; dRow <= distance; dRow += 1) {
      if (dRow % rowStep !== 0) {
        continue
      }
      const edge = Math.abs(dRow) === distance
      for (let dColumn = -distance; dColumn <= distance; dColumn += edge ? 1 : 2 * distance) {
        const square = dRow * dRow + dColumn * dColumn
        if (square < bestSquare && fits(dRow, dColumn)) {
          best = { row: dRow, column: dColumn }
          bestSquare = square
        }
      }
    }
    if (best) {
      return best
    }
  }
  // Unreachable: the search radius reaches past the Frame and every bead, and beads are finite.
  return { row: avoid.rows + box.rows + RULER_CLEARANCE * 2, column: 0 }
}

/** The Pattern with its Frame and beads turned a quarter clockwise, or undefined with no Frame to turn. */
export function rotatePattern(pattern: Pattern): Rotated | undefined {
  const frame = pattern.frame
  if (!frame) {
    return undefined
  }
  const turned = rotatedFrame(pattern, frame)

  const inside: Cell[] = []
  const outside: BeadMap = {}
  forEachBead(pattern.beads, (row, column, color) => {
    if (frameContains(frame, { row, column })) {
      inside.push({ row, column, color })
    } else {
      outside[row] ??= {}
      outside[row][column] = color
    }
  })

  // A bead at (r, c) of the Frame goes to (c, rows - 1 - r) of the turned one.
  const rotated: Cell[] = inside.map(({ row, column, color }) => ({
    row: turned.row + (column - frame.column),
    column: turned.column + (frame.rows - 1 - (row - frame.row)),
    color,
  }))

  // Pieces outside the old Frame that the turned one covers are in the way; the rest stay where they are.
  const pieces = groups(pattern, outside)
  const inTheWay = pieces.filter((cells) => cells.some((cell) => frameContains(turned, cell)))
  const occupied = new Set<string>()
  for (const cells of pieces) {
    if (!inTheWay.includes(cells)) {
      cells.forEach((cell) => occupied.add(positionKey(cell)))
    }
  }

  const avoid: Frame = {
    row: turned.row - RULER_CLEARANCE,
    column: turned.column - RULER_CLEARANCE,
    rows: turned.rows + 2 * RULER_CLEARANCE,
    columns: turned.columns + 2 * RULER_CLEARANCE,
  }

  const changes: BeadChange[] = inside.map(({ row, column }) => ({ row, column, color: null }))
  const placed: Cell[] = []
  for (const cells of inTheWay) {
    const shift = clearShift(pattern, cells, avoid, occupied)
    for (const cell of cells) {
      changes.push({ row: cell.row, column: cell.column, color: null })
      const moved = { row: cell.row + shift.row, column: cell.column + shift.column, color: cell.color }
      placed.push(moved)
      occupied.add(positionKey(moved))
    }
  }
  // Vacate first, then place, so a Piece that moves onto where another left (or where the Frame was) is drawn.
  const cleared = withColors(pattern.beads, changes)
  const beads = withColors(cleared, [...placed, ...rotated])

  return { pattern: { ...pattern, beads, frame: turned, updatedAt: Date.now() }, moved: inTheWay.length }
}

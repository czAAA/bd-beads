import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { isOffsetTechnique, positionKey, type GridPosition } from './grid'
import { changedPositions, keepFinishedRows, type Pattern } from './pattern'
import { touching } from './pieces'

/**
 * The keep-out margin round the Frame (CONTEXT.md, ticket 261, ADR 0027): the 3 bead positions all the way round it,
 * outside its line, where nothing can be drawn, so beads never end up right against the Frame and its rulers. Erase
 * still works there. A change of the Frame (or a Rotate) that leaves beads in it moves each Piece in the way clear, whole.
 */

/** How many bead positions the margin is wide: the room kept for the Frame's line and rulers, and between a moved Piece and anything else. */
export const MARGIN = 3

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Frame): Frame {
  return { row: frame.row - MARGIN, column: frame.column - MARGIN, rows: frame.rows + 2 * MARGIN, columns: frame.columns + 2 * MARGIN }
}

/** What a drawing command did, minus what it did to finished rows (ticket 33) and what it painted in the margin; `before` itself when nothing is left. */
export function keepAllowedEdits(before: Pattern, after: Pattern): Pattern {
  return keepMarginClear(before, keepFinishedRows(before, after))
}

/** Whether a position lies in the Frame's margin: within 3 of the Frame, but not in it. */
export function inMargin(frame: Frame | undefined, position: GridPosition): boolean {
  return !!frame && frameContains(withMargin(frame), position) && !frameContains(frame, position)
}

/**
 * What an edit did, with every bead it newly painted in the margin taken back (erasing there stays). An edit left with
 * nothing to change hands back `before` itself, the same "unchanged" signal the drawing commands give.
 */
export function keepMarginClear(before: Pattern, after: Pattern): Pattern {
  const frame = before.frame
  if (!frame) {
    return after
  }
  const reverts: BeadChange[] = []
  forEachBead(after.beads, (row, column, color) => {
    if (inMargin(frame, { row, column }) && before.beads[row]?.[column] !== color) {
      reverts.push({ row, column, color: before.beads[row]?.[column] ?? null })
    }
  })
  if (reverts.length === 0) {
    return after
  }
  const beads = withColors(after.beads, reverts)
  return changedPositions(before.beads, beads).length === 0 ? before : { ...after, beads }
}

export interface Cell extends GridPosition {
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
  const limit = avoid.rows + avoid.columns + box.rows + box.columns + 2 * MARGIN + 2

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
  return { row: avoid.rows + box.rows + MARGIN * 2, column: 0 }
}

/**
 * Moves every Piece of `outside` (beads not in the Frame) that reaches the Frame's margin to the nearest empty space
 * clear of the Frame and its margin; the rest stay. Returns the changes to vacate and place, and how many beads moved.
 */
export function relocateFromMargin(
  pattern: Pick<Pattern, 'technique'>,
  outside: BeadMap,
  frame: Frame,
): { changes: BeadChange[]; placed: Cell[]; pieces: number } {
  const avoid = withMargin(frame)
  const all = groups(pattern, outside)
  const inTheWay = all.filter((cells) => cells.some((cell) => frameContains(avoid, cell)))
  const occupied = new Set<string>()
  for (const cells of all) {
    if (!inTheWay.includes(cells)) {
      cells.forEach((cell) => occupied.add(positionKey(cell)))
    }
  }
  const changes: BeadChange[] = []
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
  return { changes, placed, pieces: inTheWay.length }
}

/** The Pattern with every bead in the Frame's margin moved clear, and how many beads that was; the same Pattern when none was. */
export function clearMargin(pattern: Pattern): { pattern: Pattern; moved: number } {
  const frame = pattern.frame
  if (!frame) {
    return { pattern, moved: 0 }
  }
  const outside: BeadMap = {}
  forEachBead(pattern.beads, (row, column, color) => {
    if (!frameContains(frame, { row, column })) {
      outside[row] ??= {}
      outside[row][column] = color
    }
  })
  const { changes, placed, pieces } = relocateFromMargin(pattern, outside, frame)
  if (pieces === 0) {
    return { pattern, moved: 0 }
  }
  const beads = withColors(withColors(pattern.beads, changes), placed)
  return { pattern: { ...pattern, beads, updatedAt: Date.now() }, moved: placed.length }
}

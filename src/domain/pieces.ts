import { forEachBead, frameContains, type BeadMap, type Frame } from './canvas'
import { isOffsetTechnique, neighborsOf, type GridPosition, type Technique } from './grid'

/**
 * A Piece (CONTEXT.md): beads that touch by a side or a corner. Pieces form, merge and split as beads are painted and
 * erased, so they are never stored; they are worked out from the beads on demand (and cached per set of beads).
 */
export interface Piece extends Frame {
  /** How many beads it holds. */
  beads: number
}

/** The positions a bead touches: all eight around it on loom, whose rows stack; on peyote and brick stitch the six beads that nest against it (the neighbours of the Technique's own geometry). */
export function touching(technique: Technique, position: GridPosition): GridPosition[] {
  if (isOffsetTechnique(technique)) {
    return neighborsOf(technique, undefined, position)
  }
  const { row, column } = position
  return [-1, 0, 1].flatMap((dRow) =>
    [-1, 0, 1].filter((dColumn) => dRow !== 0 || dColumn !== 0).map((dColumn) => ({ row: row + dRow, column: column + dColumn })),
  )
}

/** A position as one number, for sets that hold thousands of them: cheaper to make and compare than a string. Good for rows and columns within a million of the start. */
const KEY_SPAN = 2 ** 22
const KEY_OFFSET = 2 ** 21
function numericKey({ row, column }: GridPosition): number {
  return (row + KEY_OFFSET) * KEY_SPAN + column + KEY_OFFSET
}

const cache = new WeakMap<BeadMap, Map<Technique, Piece[]>>()

/**
 * Every Piece on the canvas, top to bottom and left to right by the top-left of its rectangle. The same beads give back
 * the same array, so a repaint that changes nothing costs nothing.
 */
export function piecesOf(beads: BeadMap, technique: Technique): Piece[] {
  const known = cache.get(beads)?.get(technique)
  if (known) {
    return known
  }

  const unvisited = new Set<number>()
  forEachBead(beads, (row, column) => unvisited.add(numericKey({ row, column })))

  const pieces: Piece[] = []
  forEachBead(beads, (row, column) => {
    if (!unvisited.has(numericKey({ row, column }))) {
      return
    }
    let top = row
    let bottom = row
    let left = column
    let right = column
    let count = 0
    const stack: GridPosition[] = [{ row, column }]
    unvisited.delete(numericKey({ row, column }))
    while (stack.length > 0) {
      const at = stack.pop()!
      count += 1
      top = Math.min(top, at.row)
      bottom = Math.max(bottom, at.row)
      left = Math.min(left, at.column)
      right = Math.max(right, at.column)
      for (const next of touching(technique, at)) {
        if (unvisited.delete(numericKey(next))) {
          stack.push(next)
        }
      }
    }
    pieces.push({ row: top, column: left, rows: bottom - top + 1, columns: right - left + 1, beads: count })
  })

  pieces.sort((a, b) => a.row - b.row || a.column - b.column)
  const byTechnique = cache.get(beads) ?? new Map<Technique, Piece[]>()
  byTechnique.set(technique, pieces)
  cache.set(beads, byTechnique)
  return pieces
}


/** Whether two rectangles overlap, one lies inside the other, or they touch: a cell of one is in the other's cell ring (side or corner, by the Technique's own neighbour geometry). */
function areasJoin(technique: Technique, a: Frame, b: Frame): boolean {
  const aBottom = a.row + a.rows - 1
  const aRight = a.column + a.columns - 1
  const bBottom = b.row + b.rows - 1
  const bRight = b.column + b.columns - 1
  // The ring lies within one cell of a's rectangle, so anything further off cannot touch it.
  if (b.row > aBottom + 1 || bBottom < a.row - 1 || b.column > aRight + 1 || bRight < a.column - 1) {
    return false
  }
  if (b.row <= aBottom && bBottom >= a.row && b.column <= aRight && bRight >= a.column) {
    return true
  }
  const inB = (at: GridPosition) => frameContains(b, at)
  for (let row = a.row; row <= aBottom; row += 1) {
    const edge = row === a.row || row === aBottom
    for (let column = a.column; column <= aRight; column += edge ? 1 : Math.max(1, a.columns - 1)) {
      if (touching(technique, { row, column }).some(inB)) {
        return true
      }
    }
  }
  return false
}

/** How far a Piece's area reaches past its own bounds when Pieces are joined: one bead, so Pieces with one empty bead between them join and two empty beads keep them apart (ticket 293). */
const JOIN_MARGIN = 1

/** Whether two Pieces' areas join: `areasJoin` once `a` is counted with the margin. The margin is a distance, so the answer is the same either way round. */
function areasJoinWithMargin(technique: Technique, a: Frame, b: Frame): boolean {
  return areasJoin(technique, {
    row: a.row - JOIN_MARGIN,
    column: a.column - JOIN_MARGIN,
    rows: a.rows + 2 * JOIN_MARGIN,
    columns: a.columns + 2 * JOIN_MARGIN,
  }, b)
}

const areaCache = new WeakMap<BeadMap, Map<Technique, Frame[]>>()

/**
 * Every Piece area (CONTEXT.md): the rectangle around one or more Pieces. A Piece's area, counted as everything within one
 * bead outside its bounds, that overlaps, lies inside or touches another's joins it, repeated until none do, so the area
 * is the bounding box of the group (the margin joins, it is not drawn). Top to bottom
 * and left to right. Cached per set of beads like `piecesOf`.
 */
export function pieceAreasOf(beads: BeadMap, technique: Technique): Frame[] {
  const known = areaCache.get(beads)?.get(technique)
  if (known) {
    return known
  }

  let areas: Frame[] = piecesOf(beads, technique).map(({ row, column, rows, columns }) => ({ row, column, rows, columns }))
  let merged = true
  while (merged) {
    merged = false
    const next: Frame[] = []
    for (const area of areas) {
      const at = next.findIndex((other) => areasJoinWithMargin(technique, other, area))
      if (at === -1) {
        next.push(area)
        continue
      }
      const other = next[at]
      const top = Math.min(other.row, area.row)
      const left = Math.min(other.column, area.column)
      const bottom = Math.max(other.row + other.rows, area.row + area.rows)
      const right = Math.max(other.column + other.columns, area.column + area.columns)
      next[at] = { row: top, column: left, rows: bottom - top, columns: right - left }
      merged = true
    }
    areas = next
  }

  areas.sort((a, b) => a.row - b.row || a.column - b.column)
  const byTechnique = areaCache.get(beads) ?? new Map<Technique, Frame[]>()
  byTechnique.set(technique, areas)
  areaCache.set(beads, byTechnique)
  return areas
}

import { forEachBead, type BeadMap, type Frame } from './canvas'
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


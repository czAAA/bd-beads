import { sortedKeys, type BeadMap, type Rect } from './canvas'
import { type GridPosition } from './grid'
import { columnCycle, neighborsOf, rowCycle, touchKey, type Weave } from './weave'

/** A Piece (CONTEXT.md): beads that touch by a side or a corner. Pieces merge and split as beads change, so they are
 * never stored; worked out on demand (cached per set of beads). */
export interface Piece extends Rect {
  /** How many beads it holds. */
  beads: number
}

/** The positions a bead touches: all eight around it on loom, whose rows stack; on peyote and brick stitch the six
 * beads beside it that its staggered lines meet (the neighbours of the weave's own geometry). */
export function touching(weave: Weave, position: GridPosition): GridPosition[] {
  if (rowCycle(weave) > 1 || columnCycle(weave) > 1) {
    return neighborsOf(weave, undefined, position)
  }
  const { row, column } = position
  return [-1, 0, 1].flatMap((dRow) =>
    [-1, 0, 1].filter((dColumn) => dRow !== 0 || dColumn !== 0).map((dColumn) => ({ row: row + dRow, column: column + dColumn })),
  )
}

/** A position as one number, for sets that hold thousands of them: cheaper to make and compare than a string. Good
 * for rows and columns within a million of the start. */
const KEY_SPAN = 2 ** 22
const KEY_OFFSET = 2 ** 21
export function numericKey({ row, column }: GridPosition): number {
  return (row + KEY_OFFSET) * KEY_SPAN + column + KEY_OFFSET
}

/** The beads of the Piece that holds the bead at `start`, as positions; empty when there is no bead there. */
export function pieceBeadsAt(beads: BeadMap, weave: Weave, start: GridPosition): GridPosition[] {
  if (beads[start.row]?.[start.column] === undefined) {
    return []
  }
  const seen = new Set<number>([numericKey(start)])
  const members: GridPosition[] = []
  const stack: GridPosition[] = [start]
  while (stack.length > 0) {
    const at = stack.pop()!
    members.push(at)
    for (const next of touching(weave, at)) {
      if (beads[next.row]?.[next.column] !== undefined && !seen.has(numericKey(next))) {
        seen.add(numericKey(next))
        stack.push(next)
      }
    }
  }
  return members
}

// Keyed by how beads touch, not the Technique: brick stitch's rows and peyote's columns with the same Drop do not touch alike.
const cache = new WeakMap<BeadMap, Map<number, Piece[]>>()

/** How many beads `piecesInSteps` visits between two yields: a few milliseconds of work (ticket 0716). */
const BEADS_PER_STEP = 2_000

/** What a walk over every bead finds: the Pieces, and the Piece each anchor asked about lies on. */
export interface WalkedPieces {
  pieces: Piece[]
  /** By the anchor's numeric key; an anchor on no bead is not in it. */
  anchored: Map<number, Piece>
}

/** Every Piece on the canvas worked out a step at a time (ticket 0716): it yields after each BEADS_PER_STEP beads, so
 * a layer too big to walk at once is walked in idle time, and returns what `piecesOf` would, with the Piece each of
 * `anchors` (the Piece names' beads) is on. The Pieces go into `piecesOf`'s cache. */
export function* piecesInSteps(beads: BeadMap, weave: Weave, anchors: readonly GridPosition[] = []): Generator<undefined, WalkedPieces> {
  const anchorKeys = new Set(anchors.map(numericKey))
  const unvisited = new Set<number>()
  let since = 0
  const rows = sortedKeys(beads)
  for (const row of rows) {
    for (const column of sortedKeys(beads[row]!)) {
      unvisited.add(numericKey({ row, column }))
      if (++since >= BEADS_PER_STEP) {
        since = 0
        yield
      }
    }
  }

  const pieces: Piece[] = []
  const anchoredAt = new Map<number, number>()
  for (const row of rows) {
    for (const column of sortedKeys(beads[row]!)) {
      if (!unvisited.has(numericKey({ row, column }))) continue
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
        if (anchorKeys.size > 0 && anchorKeys.has(numericKey(at))) anchoredAt.set(numericKey(at), pieces.length)
        top = Math.min(top, at.row)
        bottom = Math.max(bottom, at.row)
        left = Math.min(left, at.column)
        right = Math.max(right, at.column)
        for (const next of touching(weave, at)) {
          if (unvisited.delete(numericKey(next))) {
            stack.push(next)
          }
        }
        if (++since >= BEADS_PER_STEP) {
          since = 0
          yield
        }
      }
      pieces.push({ row: top, column: left, rows: bottom - top + 1, columns: right - left + 1, beads: count })
    }
  }

  const anchored = new Map([...anchoredAt].map(([key, index]) => [key, pieces[index]!]))
  pieces.sort((a, b) => a.row - b.row || a.column - b.column)
  const byCycle = cache.get(beads) ?? new Map<number, Piece[]>()
  byCycle.set(touchKey(weave), pieces)
  cache.set(beads, byCycle)
  return { pieces, anchored }
}

/** Every Piece on the canvas, top to bottom, left to right by its rectangle's top-left. The same beads give back the
 * same array, so a repaint that changes nothing costs nothing. */
export function piecesOf(beads: BeadMap, weave: Weave): Piece[] {
  const known = cache.get(beads)?.get(touchKey(weave))
  if (known) {
    return known
  }
  const walk = piecesInSteps(beads, weave)
  for (;;) {
    const step = walk.next()
    if (step.done) return step.value.pieces
  }
}

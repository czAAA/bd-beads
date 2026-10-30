import { changedRows, type BeadMap } from './canvas'
import type { GridPosition } from './grid'
import { numericKey, touching } from './pieces'
import { rowCycle, type Weave } from './weave'

// Which Piece the beads of a set of beads are on (ADR 0080), so the Piece-name checks of an edit look only at the beads
// it changed: a Piece is labelled the first time an edit touches it, and the labels are handed on to the next set of
// beads an edit makes; a set they were not handed to starts again with none.

/** What an edit did to where beads are: the positions it filled and the ones it emptied. A new color on a bead is in
 * neither, as it moves no Piece. */
export interface BeadPresence {
  added: GridPosition[]
  removed: GridPosition[]
}

/** The positions an edit filled and emptied, read from the rows it changed alone, in no order: a Fill's new colors
 * cost one lookup each (ticket 0731). */
export function presenceChanges(before: BeadMap, after: BeadMap): BeadPresence {
  const added: GridPosition[] = []
  const removed: GridPosition[] = []
  for (const row of changedRows(before, after)) {
    const [was, now] = [before[row] ?? {}, after[row] ?? {}]
    let kept = 0
    for (const key of Object.keys(now)) {
      if (was[Number(key)] === undefined) added.push({ row, column: Number(key) })
      else kept += 1
    }
    // Every bead of the row before still there is one of `kept`, so a row that lost none is not read again.
    if (kept === Object.keys(was).length) continue
    for (const key of Object.keys(was)) if (now[Number(key)] === undefined) removed.push({ row, column: Number(key) })
  }
  return { added, removed }
}

/** Each bead's Piece: a label per bead, and the labels merged as Pieces join (a union-find), with each Piece's size. */
interface PieceIndex {
  cycle: number
  labels: Map<number, number>
  parent: number[]
  size: number[]
}

const indexes = new WeakMap<BeadMap, PieceIndex>()

function find(index: PieceIndex, label: number): number {
  let root = label
  while (index.parent[root] !== root) root = index.parent[root]
  while (index.parent[label] !== root) {
    const next = index.parent[label]
    index.parent[label] = root
    label = next
  }
  return root
}

function newPiece(index: PieceIndex): number {
  index.parent.push(index.parent.length)
  index.size.push(0)
  return index.parent.length - 1
}

/** The Piece of the bead at `key`, undefined where there is none. */
function pieceOf(index: PieceIndex, key: number): number | undefined {
  const label = index.labels.get(key)
  return label === undefined ? undefined : find(index, label)
}

/** The labels of `beads` found so far: a Piece is labelled whole the first time a bead of it is asked about, and the
 * labels are handed on from edit to edit, so only the Pieces edits touch are ever flooded. */
function indexOf(beads: BeadMap, weave: Weave): PieceIndex {
  const cycle = rowCycle(weave)
  const known = indexes.get(beads)
  if (known?.cycle === cycle) return known
  const index: PieceIndex = { cycle, labels: new Map(), parent: [], size: [] }
  indexes.set(beads, index)
  return index
}

/** The Piece of the bead at `start` in `beads`, flooding and labelling it whole if no bead of it has a label yet;
 * undefined where there is no bead. */
function labelled(index: PieceIndex, beads: BeadMap, weave: Weave, start: GridPosition): number | undefined {
  const known = pieceOf(index, numericKey(start))
  if (known !== undefined || beads[start.row]?.[start.column] === undefined) return known
  const piece = newPiece(index)
  index.labels.set(numericKey(start), piece)
  const stack = [start]
  while (stack.length > 0) {
    const at = stack.pop()!
    index.size[piece] += 1
    for (const next of touching(weave, at)) {
      const key = numericKey(next)
      if (beads[next.row]?.[next.column] !== undefined && !index.labels.has(key)) {
        index.labels.set(key, piece)
        stack.push(next)
      }
    }
  }
  return piece
}

/** Which Piece the bead at `position` is on, as a label every bead of it shares; undefined where there is none. A Piece
 * is flooded the first time one of its beads is asked about and then known for that set of beads, so asking again
 * and again (the Name Piece control through a Select drag) floods it once (ticket 0674). */
export function pieceLabelAt(beads: BeadMap, weave: Weave, position: GridPosition): number | undefined {
  return labelled(indexOf(beads, weave), beads, weave, position)
}

/** Whether beads an edit only added join two Pieces that hold a name each, or the same named Piece twice over: each
 * new bead is put with the Pieces of `before` it touches, and with the new beads it touches. `anchors` are the names'
 * positions, every one on a bead of `before`. */
export function joinsNamedPieces(before: BeadMap, weave: Weave, anchors: GridPosition[], added: GridPosition[]): boolean {
  const touchesBefore = added.some((at) => touching(weave, at).some((next) => before[next.row]?.[next.column] !== undefined))
  if (!touchesBefore) return false
  const index = indexOf(before, weave)
  // Every Piece a new bead touches is labelled first, so a name whose bead has no label is on a Piece left alone.
  for (const at of added) for (const next of touching(weave, at)) labelled(index, before, weave, next)
  const named = new Map<number, number>()
  for (const anchor of anchors) {
    const piece = pieceOf(index, numericKey(anchor))
    if (piece !== undefined) named.set(piece, (named.get(piece) ?? 0) + 1)
  }
  if ([...named.values()].some((count) => count > 1)) return true
  // A new bead is a node of its key, a Piece of `before` one of minus its label and one, so the two never meet.
  const parent = new Map<number, number>()
  const root = (node: number): number => {
    let at = node
    while (parent.has(at) && parent.get(at) !== at) at = parent.get(at)!
    return at
  }
  const join = (a: number, b: number) => {
    const [x, y] = [root(a), root(b)]
    if (x !== y) parent.set(x, y)
  }
  const addedKeys = new Set(added.map(numericKey))
  for (const at of added) {
    const node = numericKey(at)
    parent.set(node, parent.get(node) ?? node)
    for (const next of touching(weave, at)) {
      const key = numericKey(next)
      if (addedKeys.has(key)) {
        parent.set(key, parent.get(key) ?? key)
        join(node, key)
      } else if (before[next.row]?.[next.column] !== undefined) {
        const piece = -(pieceOf(index, key)! + 1)
        parent.set(piece, parent.get(piece) ?? piece)
        join(node, piece)
      }
    }
  }
  const namesPerGroup = new Map<number, number>()
  for (const [piece, count] of named) {
    const node = -(piece + 1)
    if (!parent.has(node)) continue
    const group = root(node)
    namesPerGroup.set(group, (namesPerGroup.get(group) ?? 0) + count)
  }
  return [...namesPerGroup.values()].some((count) => count > 1)
}

/** How many beads the search that a Piece stays whole looks at before it gives up: a few, and more for each bead
 * left round the emptied ones, so a stroke step's run of them is still followed round. */
const SEARCH_BEADS = 256
const SEARCH_BEADS_PER_NEIGHBOUR = 64

/** Whether emptying `removed` leaves every Piece it touched in one piece: the beads round each run of emptied beads
 * still reach each other in `after`, found by a search that gives up (and says no) past a few beads per neighbour. */
export function piecesStayWhole(after: BeadMap, weave: Weave, removed: GridPosition[]): boolean {
  const keys = new Set(removed.map(numericKey))
  const done = new Set<number>()
  for (const start of removed) {
    if (done.has(numericKey(start))) continue
    // The run of emptied beads that touch each other, and the beads left round it.
    const run = [start]
    const seeds = new Map<number, GridPosition>()
    done.add(numericKey(start))
    for (let i = 0; i < run.length; i += 1) {
      for (const next of touching(weave, run[i])) {
        const key = numericKey(next)
        if (keys.has(key) && !done.has(key)) {
          done.add(key)
          run.push(next)
        } else if (after[next.row]?.[next.column] !== undefined) {
          seeds.set(key, next)
        }
      }
    }
    if (!reachEachOther(after, weave, [...seeds.values()], SEARCH_BEADS + SEARCH_BEADS_PER_NEIGHBOUR * seeds.size)) return false
  }
  return true
}

function reachEachOther(beads: BeadMap, weave: Weave, seeds: GridPosition[], budget: number): boolean {
  if (seeds.length <= 1) return true
  const targets = new Set(seeds.slice(1).map(numericKey))
  const seen = new Set([numericKey(seeds[0])])
  const queue = [seeds[0]]
  for (let i = 0; i < queue.length && i < budget; i += 1) {
    for (const next of touching(weave, queue[i])) {
      const key = numericKey(next)
      if (seen.has(key) || beads[next.row]?.[next.column] === undefined) continue
      seen.add(key)
      if (targets.delete(key) && targets.size === 0) return true
      queue.push(next)
    }
  }
  return false
}

/** Hands the labels of `before`, if it has any, on to `after`, which an edit made from it by `change` (no Piece of
 * which it split): its new beads join the Pieces they touch, its emptied ones leave theirs. `before` gives them up and
 * is labelled again if it is asked about later (Undo). */
export function carryPieceIndex(before: BeadMap, after: BeadMap, weave: Weave, change: BeadPresence): void {
  const index = indexes.get(before)
  if (!index || index.cycle !== rowCycle(weave) || before === after) return
  indexes.delete(before)
  for (const at of change.removed) {
    const key = numericKey(at)
    const piece = pieceOf(index, key)
    if (piece !== undefined) index.size[piece] -= 1
    index.labels.delete(key)
  }
  for (const at of change.added) {
    let piece: number | undefined
    for (const next of touching(weave, at)) {
      // A Piece of `before` the bead joins is labelled whole first, so a label always stands for a whole Piece.
      const other = before[next.row]?.[next.column] !== undefined ? labelled(index, before, weave, next) : pieceOf(index, numericKey(next))
      if (other === undefined || other === piece) continue
      if (piece === undefined) {
        piece = other
        continue
      }
      const [big, small] = index.size[piece] >= index.size[other] ? [piece, other] : [other, piece]
      index.parent[small] = big
      index.size[big] += index.size[small]
      piece = big
    }
    piece ??= newPiece(index)
    index.labels.set(numericKey(at), piece)
    index.size[piece] += 1
  }
  indexes.set(after, index)
}

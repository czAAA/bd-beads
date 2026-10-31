import { frameContains, type BeadMap, type Rect } from './canvas'
import type { GridPosition } from './grid'
import { piecesStayWhole, presenceChanges } from './pieceIndex'
import { numericKey, piecesOf, touching } from './pieces'
import { touchKey, type Weave } from './weave'

// Piece areas (CONTEXT.md), what the rulers hang from: counted from a set of beads once, then carried from the last set
// counted by the beads an edit filled and emptied (ticket 0731), so an edit costs the areas it touches, not the layer.

/** Whether two rectangles overlap, one lies inside the other, or they touch: a cell of one is in the other's cell
 * ring (side or corner, by the Technique's own neighbour geometry). */
function areasJoin(weave: Weave, a: Rect, b: Rect): boolean {
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
      if (touching(weave, { row, column }).some(inB)) {
        return true
      }
    }
  }
  return false
}

/** How far a Piece's area reaches past its own bounds when Pieces are joined: one bead, so Pieces with one empty
 * bead between them join and two empty beads keep them apart (ticket 293). */
const JOIN_MARGIN = 1

/** Whether two Pieces' areas join: each, counted with the margin, joins the other. On peyote and brick stitch a column's or
 * row's shift can bring one box's ring onto a bead two empty beads off that the other's misses; asking both keeps those apart
 * and the areas the same whichever Piece is met first (ticket 0731). */
function areasJoinWithMargin(weave: Weave, a: Rect, b: Rect): boolean {
  return areasJoin(weave, withMargin(a), b) && areasJoin(weave, withMargin(b), a)
}

function withMargin({ row, column, rows, columns }: Rect): Rect {
  return { row: row - JOIN_MARGIN, column: column - JOIN_MARGIN, rows: rows + 2 * JOIN_MARGIN, columns: columns + 2 * JOIN_MARGIN }
}

/** Past this many emptied beads an edit's areas are counted afresh: each is looked up among the areas, which a Remove
 * row/column shifting the whole layer would make dearer than the walk. */
const MOST_EMPTIED_TO_CARRY = 4_096

/** A set of beads' Piece areas, and which of them hold one Piece alone. */
interface CountedAreas {
  areas: Rect[]
  /** An area of one Piece: emptying beads that leave the Piece whole moves only its edges. */
  single: ReadonlySet<Rect>
}

const areaCache = new WeakMap<BeadMap, Map<number, CountedAreas>>()
/** The last set of beads whose areas were counted: an edit's next set is counted from it, as `beadBounds` grows its
 * box. */
let lastAreas: { beads: BeadMap; touch: number; counted: CountedAreas } | undefined

/** Every Piece area (CONTEXT.md): the rectangle round one or more Pieces. A Piece's area plus one bead outside its
 * bounds that overlaps or touches another's joins it, repeated until none do (the margin joins, it isn't drawn).
 * Top to bottom, left to right; kept per set of beads (an Undo finds it), else carried from the last set counted. */
export function pieceAreasOf(beads: BeadMap, weave: Weave): Rect[] {
  const touch = touchKey(weave)
  const counted = areaCache.get(beads)?.get(touch)
    ?? (lastAreas?.touch === touch ? carriedAreas(lastAreas.beads, lastAreas.counted, beads, weave) : undefined)
    ?? joinedAreas([], piecesOf(beads, weave).map(({ row, column, rows, columns }) => ({ box: { row, column, rows, columns } })),
      weave)
  const byTouch = areaCache.get(beads) ?? new Map<number, CountedAreas>()
  byTouch.set(touch, counted)
  areaCache.set(beads, byTouch)
  lastAreas = { beads, touch, counted }
  return counted.areas
}

/** A box that goes into the Piece areas: an area kept from the last count, whose box holds no other area's beads, or a
 * run of touching beads. */
interface Part {
  box: Rect
  /** On an area kept from the last count: whether it holds one Piece. */
  kept?: { single: boolean }
  /** On a run of new beads: the beads it touches that were there before. */
  touches?: GridPosition[]
}

/** The areas of `after` from those of `before`: an area a bead was emptied from is walked again (its Pieces may split
 * or shrink apart) unless it is one Piece that stays whole, the rest stay, and new beads join what they reach. Undefined
 * past MOST_EMPTIED_TO_CARRY, or if an emptied bead lies in no area of `before` (they are not its areas). */
function carriedAreas(before: BeadMap, counted: CountedAreas, after: BeadMap, weave: Weave): CountedAreas | undefined {
  const { added, removed } = presenceChanges(before, after)
  if (added.length === 0 && removed.length === 0) return counted
  if (removed.length > MOST_EMPTIED_TO_CARRY) return undefined
  const emptied = new Map<Rect, GridPosition[]>()
  let last: Rect | undefined
  for (const at of removed) {
    if (!last || !frameContains(last, at)) last = counted.areas.find((area) => frameContains(area, at))
    if (!last) return undefined
    const gone = emptied.get(last)
    if (gone) gone.push(at)
    else emptied.set(last, [at])
  }
  const addedKeys = new Set(added.map(numericKey))
  const isNew = (at: GridPosition) => addedKeys.has(numericKey(at))
  const stood = (at: GridPosition) => after[at.row]?.[at.column] !== undefined && !isNew(at)
  const kept: Part[] = counted.areas
    .filter((area) => !emptied.has(area))
    .map((box) => ({ box, kept: { single: counted.single.has(box) } }))
  const loose: Part[] = []
  for (const [area, gone] of emptied) {
    const shrunk = counted.single.has(area) && piecesStayWhole(after, weave, gone) ? shrunkArea(area, gone, stood) : undefined
    if (shrunk) kept.push({ box: shrunk, kept: { single: true } })
    else loose.push(...runsOf(weave, cellsOf(area), (at) => frameContains(area, at) && after[at.row]?.[at.column] !== undefined))
  }
  loose.push(...runsOf(weave, added, isNew, stood))
  return joinedAreas(kept, loose, weave)
}

/** The box of a one-Piece area once `gone` are emptied and the Piece stays whole: an edge that lost a bead moves in to
 * the next line holding one of the beads that `stood`. Undefined if none is left. */
function shrunkArea(area: Rect, gone: GridPosition[], stood: (at: GridPosition) => boolean): Rect | undefined {
  let [top, bottom, left, right] = [area.row, area.row + area.rows - 1, area.column, area.column + area.columns - 1]
  if (!gone.some(({ row, column }) => row === top || row === bottom || column === left || column === right)) return area
  const rowHolds = (row: number) => {
    for (let column = left; column <= right; column += 1) if (stood({ row, column })) return true
    return false
  }
  const columnHolds = (column: number) => {
    for (let row = top; row <= bottom; row += 1) if (stood({ row, column })) return true
    return false
  }
  while (top <= bottom && !rowHolds(top)) top += 1
  if (top > bottom) return undefined
  while (!rowHolds(bottom)) bottom -= 1
  while (!columnHolds(left)) left += 1
  while (!columnHolds(right)) right -= 1
  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

function* cellsOf({ row: top, column: left, rows, columns }: Rect): Generator<GridPosition> {
  for (let row = top; row < top + rows; row += 1) {
    for (let column = left; column < left + columns; column += 1) yield { row, column }
  }
}

/** Each run of touching positions that `holds`, from those of `starts` it holds, walked only through such positions;
 * with the positions round it that were `before`, when asked. */
function runsOf(weave: Weave, starts: Iterable<GridPosition>, holds: (at: GridPosition) => boolean,
  before?: (at: GridPosition) => boolean): Part[] {
  const runs: Part[] = []
  const walked = new Set<number>()
  for (const start of starts) {
    if (walked.has(numericKey(start)) || !holds(start)) continue
    walked.add(numericKey(start))
    let [top, bottom, left, right] = [start.row, start.row, start.column, start.column]
    const touches: GridPosition[] = []
    const stack = [start]
    while (stack.length > 0) {
      const at = stack.pop()!
      top = Math.min(top, at.row)
      bottom = Math.max(bottom, at.row)
      left = Math.min(left, at.column)
      right = Math.max(right, at.column)
      for (const next of touching(weave, at)) {
        if (walked.has(numericKey(next))) continue
        if (holds(next)) {
          walked.add(numericKey(next))
          stack.push(next)
        } else if (before?.(next)) {
          touches.push(next)
        }
      }
    }
    const box = { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
    runs.push(before ? { box, touches } : { box })
  }
  return runs
}

/** Parts joined into one area so far; `parts` is dropped once one of them could not tell that the area is one Piece. */
interface Joined {
  box: Rect
  parts: Part[] | undefined
}

/** The Piece areas made by joining the `loose` parts into the `kept` ones, which join none of each other: a box that
 * joins another takes the box round both and is tried again. Which joins first doesn't change the outcome, as a bigger
 * box joins all a smaller one did. */
function joinedAreas(kept: Part[], loose: Part[], weave: Weave): CountedAreas {
  const areas: Joined[] = kept.map((part) => ({ box: part.box, parts: [part] }))
  const pending: Joined[] = loose.map((part) => ({ box: part.box, parts: [part] }))
  while (pending.length > 0) {
    let joined = pending.pop()!
    for (;;) {
      const joins = (other: Joined) => areasJoinWithMargin(weave, other.box, joined.box)
      let list = areas
      let at = areas.findIndex(joins)
      if (at === -1) [list, at] = [pending, pending.findIndex(joins)]
      if (at === -1) break
      joined = joinedPair(joined, list[at]!)
      list[at] = list[list.length - 1]!
      list.pop()
    }
    areas.push(joined)
  }
  const single = new Set(areas.filter(({ parts }) => parts && onePiece(parts)).map(({ box }) => box))
  return { areas: areas.map(({ box }) => box).sort((a, b) => a.row - b.row || a.column - b.column), single }
}

/** Whether a part can be part of telling an area is one Piece: an area of one Piece, or a run of new beads. */
const joinable = (part: Part) => part.kept?.single || part.touches !== undefined

function joinedPair(a: Joined, b: Joined): Joined {
  const box = { row: Math.min(a.box.row, b.box.row), column: Math.min(a.box.column, b.box.column), rows: 0, columns: 0 }
  box.rows = Math.max(a.box.row + a.box.rows, b.box.row + b.box.rows) - box.row
  box.columns = Math.max(a.box.column + a.box.columns, b.box.column + b.box.columns) - box.column
  if (!a.parts || !b.parts || !a.parts.every(joinable) || !b.parts.every(joinable)) return { box, parts: undefined }
  const [big, small] = a.parts.length >= b.parts.length ? [a.parts, b.parts] : [b.parts, a.parts]
  for (const part of small) big.push(part)
  return { box, parts: big }
}

/** Whether parts joined into one area hold one Piece: a part alone does unless it is a kept area of several, and
 * several do when they are kept areas of one Piece and runs of new beads that link them all by beads they touch. */
function onePiece(parts: Part[]): boolean {
  if (parts.length === 1) return parts[0]!.kept?.single ?? true
  const root = parts.map((_, index) => index)
  const find = (index: number): number => (root[index] === index ? index : (root[index] = find(root[index]!)))
  const areas = parts.flatMap((part, index) => (part.kept ? [index] : []))
  parts.forEach((part, index) => {
    let last: number | undefined
    for (const at of part.touches ?? []) {
      if (last === undefined || !frameContains(parts[last]!.box, at)) {
        last = areas.find((area) => frameContains(parts[area]!.box, at))
      }
      if (last !== undefined) root[find(index)] = find(last)
    }
  })
  return parts.every((_, index) => find(index) === find(0))
}

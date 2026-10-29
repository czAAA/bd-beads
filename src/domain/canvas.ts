import type { GridDimensions, GridPosition } from './grid'
import type { FrameShapeId, FrameSettings, QuarterTurns } from './frameShape'
import type { Weave } from './weave'
import { beadsOfLayer, frameOf, type Layered } from './layerRecord'

// The painted beads of a Canvas (ADR 0026) by row, then column, then the color's hex. Only painted positions are
// stored; rows and columns may be negative. Nested plain objects, so an edit copies only the rows it touched and shares
// the rest (Undo's snapshots and the renderer rely on it, ADR 0019).
export type BeadMap = Record<number, Record<number, string>>

/** A rectangle of whole bead positions (ticket 0617): bead bounds, a Selection's box, Fill's limit, a Piece, and the
 * rectangle a Frame lies on. Not a Frame itself: that is `FrameSheet`, the glossary's Frame. */
export interface Rect {
  /** The top row and left column the rectangle covers; it covers `rows` rows and `columns` columns from there. */
  row: number
  column: number
  columns: number
  rows: number
}

/** The Frame as a Project holds it (ADR 0066): a rectangle laid on the Canvas that owns its own beads. The rectangle is
 * in Canvas positions; `beads` are counted from the Frame's own first row and column, so moving the Frame moves them
 * with it and changes nothing else. */
export interface FrameSheet extends Rect, Weave {
  /** The Frame's own beads, counted from its first row and column. Its Weave, a Technique and its settings, is its own
   * too (ticket 492): the Canvas is woven in another if the weaver likes. */
  beads: BeadMap
  /** Its Folded beads (ticket 0638): those it gave up when made smaller over a Canvas woven unlike it, beyond its edge
   * in the same own rows and columns, out of sight until it grows back over them. Absent when there are none. */
  folded?: BeadMap
  /** The name of the Piece the Frame was made from (ticket 489), drawn under the Frame. Absent: unnamed. */
  name?: string
  /** Its Frame shape (ticket 0591, ADR 0077, ADR 0079), which makes it a Custom frame. Absent on a Frame without one. */
  shape?: FrameShapeId
  /** A Custom frame's settings (ticket 0592): what its layout is built from. Absent on a Frame without a shape. */
  settings?: FrameSettings
  /** How many quarter turns clockwise Rotate Frame has given a Custom frame's layout (ticket 0594). Absent: none. */
  quarterTurns?: QuarterTurns
}

/** One bead's color at a position, or null where nothing is painted. */
export function colorAt(beads: BeadMap, row: number, column: number): string | null {
  return beads[row]?.[column] ?? null
}

/** A position and what to paint there: a hex, or null to leave it empty. */
export interface BeadChange extends GridPosition {
  color: string | null
}

// The beads after painting every change, as a new map sharing each untouched row; the same map back when nothing would
// differ. A row emptied by erasing is dropped, so a map never holds an empty row.
export function withColors(beads: BeadMap, changes: Iterable<BeadChange>): BeadMap {
  let next: BeadMap | undefined
  const copiedRows = new Set<number>()

  for (const { row, column, color } of changes) {
    if ((next ?? beads)[row]?.[column] === (color ?? undefined)) {
      continue
    }
    next ??= { ...beads }
    if (!copiedRows.has(row)) {
      next[row] = { ...beads[row] }
      copiedRows.add(row)
    }
    const copy = next[row]!
    if (color === null) {
      delete copy[column]
    } else {
      copy[column] = color
    }
  }

  if (!next) {
    return beads
  }
  for (const row of copiedRows) {
    if (Object.keys(next[row]!).length === 0) {
      delete next[row]
    }
  }
  return next
}

/** Calls `visit` for every painted bead, row by row and left to right within a row. */
export function forEachBead(beads: BeadMap, visit: (row: number, column: number, color: string) => void): void {
  for (const row of sortedKeys(beads)) {
    const cells = beads[row]!
    for (const column of sortedKeys(cells)) {
      visit(row, column, cells[column]!)
    }
  }
}

function sortedKeys(record: Record<number, unknown>): number[] {
  return Object.keys(record)
    .map(Number)
    .sort((a, b) => a - b)
}

/** Whether at least one bead is painted; stops at the first. */
export function hasBeads(beads: BeadMap): boolean {
  return Object.values(beads).some((row) => Object.keys(row).length > 0)
}

/** How many beads are painted.
 * @internal Tests count a map's beads with it; the app has needed no count since the size question went (0640). */
export function beadCount(beads: BeadMap): number {
  let count = 0
  for (const row of Object.values(beads)) {
    count += Object.keys(row).length
  }
  return count
}

/** The box of each set of beads asked about, and the last one worked out: an edit's next set shares every row it did
 * not touch, so its box is grown from that one's by the changed rows alone (ticket 0674). */
const boundsCache = new WeakMap<BeadMap, { box: Rect | undefined }>()
let lastBounds: { beads: BeadMap; box: Rect | undefined } | undefined

/** Past this many changed rows a set of beads is measured afresh rather than grown from the last. */
const MOST_ROWS_TO_GROW_BOUNDS = 64

/** The smallest rectangle round every painted bead, or undefined for an empty canvas. Worked out once per set of
 * beads. */
export function beadBounds(beads: BeadMap): Rect | undefined {
  const known = boundsCache.get(beads)
  if (known) {
    return known.box
  }
  const grown = lastBounds && grownBounds(lastBounds.beads, lastBounds.box, beads)
  const box = grown === undefined ? measuredBounds(beads) : grown.box
  boundsCache.set(beads, { box })
  lastBounds = { beads, box }
  return box
}

/** The box of `now` from that of `was`, reading only the rows the two do not share: a column at an edge that lost a
 * bead is looked up in every row. Undefined when that would not be cheaper than measuring afresh. */
function grownBounds(was: BeadMap, box: Rect | undefined, now: BeadMap): { box: Rect | undefined } | undefined {
  const rows = Object.keys(now)
  if (rows.length === 0) {
    return { box: undefined }
  }
  let changed = 0
  const changedRows = new Set<string>()
  for (const key of new Set([...Object.keys(was), ...rows])) {
    if (was[Number(key)] !== now[Number(key)]) {
      changed += 1
      changedRows.add(key)
    }
  }
  if (changed > MOST_ROWS_TO_GROW_BOUNDS) {
    return undefined
  }
  const oldLeft = box ? box.column : Infinity
  const oldRight = box ? box.column + box.columns - 1 : -Infinity
  let left = oldLeft
  let right = oldRight
  let leftLost = false
  let rightLost = false
  for (const key of changedRows) {
    const before = was[Number(key)]
    const after = now[Number(key)]
    for (const columnKey of Object.keys(after ?? {})) {
      left = Math.min(left, Number(columnKey))
      right = Math.max(right, Number(columnKey))
    }
    leftLost ||= before?.[oldLeft] !== undefined && after?.[oldLeft] === undefined
    rightLost ||= before?.[oldRight] !== undefined && after?.[oldRight] === undefined
  }
  const stillAt = (column: number) => rows.some((key) => now[Number(key)]![column] !== undefined)
  if ((leftLost && left === oldLeft && !stillAt(oldLeft)) || (rightLost && right === oldRight && !stillAt(oldRight))) {
    return undefined
  }
  let top = Infinity
  let bottom = -Infinity
  for (const key of rows) {
    top = Math.min(top, Number(key))
    bottom = Math.max(bottom, Number(key))
  }
  return { box: { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 } }
}

function measuredBounds(beads: BeadMap): Rect | undefined {
  let top = Infinity
  let bottom = -Infinity
  let left = Infinity
  let right = -Infinity
  forEachBead(beads, (row, column) => {
    top = Math.min(top, row)
    bottom = Math.max(bottom, row)
    left = Math.min(left, column)
    right = Math.max(right, column)
  })
  return top === Infinity ? undefined : { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** Whether a position lies inside a rectangle (a Frame's, or any other). */
export function frameContains(frame: Rect, { row, column }: GridPosition): boolean {
  return row >= frame.row && row < frame.row + frame.rows && column >= frame.column && column < frame.column + frame.columns
}

/** Whether two rectangles are the same place and size (either may be absent): an unchanged Frame is no change. */
export function sameFrame(a: Rect | undefined, b: Rect | undefined): boolean {
  return a === b || (!!a && !!b && a.row === b.row && a.column === b.column && a.rows === b.rows && a.columns === b.columns)
}

/** Something with a size in beads: plain dimensions, or a Project (a canvas with or without a Frame). */
export type Sized = GridDimensions | Layered

/** A Frame's size, or — with no Frame — the size of the box round the beads, or 0 × 0 for an empty canvas. */
export function sizeOf(sized: Sized): GridDimensions {
  if ('columns' in sized) {
    return { columns: sized.columns, rows: sized.rows }
  }
  const box = frameOf(sized) ?? beadBounds(beadsOfLayer(sized, 'canvas'))
  return box ? { columns: box.columns, rows: box.rows } : { columns: 0, rows: 0 }
}

/** A Frame's size, as the dimensions the grid-shaped helpers (adjacency, fit zoom) take. */
export function frameDimensions(frame: Rect): GridDimensions {
  return { columns: frame.columns, rows: frame.rows }
}

/** The painted colors inside a Frame as a dense rows × columns array of hex-or-null, top-left first.
 * @internal The test helpers' frame grid (`src/testUtils/frameGrid.ts`) reads the Frame with it. */
export function colorsInFrame(beads: BeadMap, frame: Rect): (string | null)[][] {
  return Array.from({ length: frame.rows }, (_row, rowOffset) =>
    Array.from({ length: frame.columns }, (_column, columnOffset) =>
      colorAt(beads, frame.row + rowOffset, frame.column + columnOffset),
    ),
  )
}

/** Beads from a dense rows × columns array of hex-or-null whose top-left sits at `origin` (0, 0 by default). */
export function beadsFromColors(colors: readonly (readonly (string | null)[])[], origin: GridPosition = { row: 0, column: 0 }): BeadMap {
  const beads: BeadMap = {}
  colors.forEach((cells, rowOffset) => {
    cells.forEach((color, columnOffset) => {
      if (color !== null) {
        const row = origin.row + rowOffset
        beads[row] ??= {}
        beads[row][origin.column + columnOffset] = color
      }
    })
  })
  return beads
}

/** The beads inside a Frame, and only those, as a new map. */
export function beadsInFrame(beads: BeadMap, frame: Rect): BeadMap {
  const inside: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    if (frameContains(frame, { row, column })) {
      inside[row] ??= {}
      inside[row][column] = color
    }
  })
  return inside
}

/** The beads moved by whole rows and columns, those that land outside `within` (rows × columns from 0, 0) dropped when
 * it is given. The same map back when nothing moves and nothing is dropped. */
export function shiftedBeads(beads: BeadMap, rows: number, columns: number, within?: GridDimensions): BeadMap {
  if (rows === 0 && columns === 0 && !within) {
    return beads
  }
  const shifted: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    const to = { row: row + rows, column: column + columns }
    if (within && (to.row < 0 || to.row >= within.rows || to.column < 0 || to.column >= within.columns)) {
      return
    }
    shifted[to.row] ??= {}
    shifted[to.row]![to.column] = color
  })
  return shifted
}

/** `beads` with every bead of `over` laid on top, at the same positions. */
export function beadsOver(beads: BeadMap, over: BeadMap): BeadMap {
  const changes: BeadChange[] = []
  forEachBead(over, (row, column, color) => changes.push({ row, column, color }))
  return withColors(beads, changes)
}

/** `beads` without the beads that lie inside `area`. */
export function beadsWithout(beads: BeadMap, area: Rect): BeadMap {
  const changes: BeadChange[] = []
  forEachBead(beads, (row, column) => {
    if (frameContains(area, { row, column })) {
      changes.push({ row, column, color: null })
    }
  })
  return withColors(beads, changes)
}

/** Every position whose color differs between two bead maps; a row both share is passed over unread. */
export function changedPositions(before: BeadMap, after: BeadMap): GridPosition[] {
  const changed: GridPosition[] = []
  for (const key of Object.keys(after)) {
    const row = Number(key)
    if (before[row] !== after[row]) changedInRow(row, before[row], after[row], changed)
  }
  for (const key of Object.keys(before)) {
    const row = Number(key)
    if (after[row] === undefined) changedInRow(row, before[row], undefined, changed)
  }
  return changed.sort((a, b) => a.row - b.row || a.column - b.column)
}

function changedInRow(
  row: number,
  was: Record<number, string> | undefined,
  now: Record<number, string> | undefined,
  changed: GridPosition[],
): void {
  for (const key of Object.keys(now ?? {})) {
    const column = Number(key)
    if (was?.[column] !== now![column]) changed.push({ row, column })
  }
  for (const key of Object.keys(was ?? {})) {
    const column = Number(key)
    if (now?.[column] === undefined) changed.push({ row, column })
  }
}

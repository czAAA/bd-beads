import { colorAt, frameContains, type BeadMap, type Rect } from './canvas'
import type { GridPosition } from './grid'
import type { LayerGeometry } from './layerGeometry'
import type { LayerSheet } from './layers'

// Fill (ADR 0026): the region of same-colored beads joined to the one pressed, and where it stops (Fill reach,
// ticket 0715).

/** The Fill cap (ticket 0715): the most positions one Fill tool press may paint on the open Canvas, about a 500 × 500
 * patch, so a Fill never grows a layer past what the app carries.
 * The perf check (`e2e/perf/fillReach.spec.ts`) fills a Piece as big as it; the Piece walk limit is it (ticket 0716). */
export const FILL_CAP = 250_000

/** Why a Fill on the open Canvas changed nothing (ticket 0715): the empty space pressed runs off the screen, so
 * nothing encloses it, or the Fill would paint more than the cap. */
export type FillRefusal = 'open' | 'too-big'

/** Whether a Fill was refused rather than made (ticket 0715). */
export function isFillRefusal(result: BeadMap | FillRefusal): result is FillRefusal {
  return typeof result === 'string'
}

/** What bounds a Fill on the open Canvas (Fill reach, ticket 0715); a Frame is bounded by its own edge alone. */
export interface FillReach {
  /** The Canvas positions on screen at the press, as the renderer counts them in view; none known encloses nothing. */
  onScreen?: Rect
  /** The most positions the press may paint: the Fill cap unless a test needs fewer. */
  cap?: number
}

/** The beads a Fill paints into as it floods (ticket 0677): a row is copied the first time it changes, the rest shared
 * with the layer's (ADR 0036). A painted bead no longer has the pressed one's color, so the colors say where the flood
 * has been and no set of visited positions is kept. */
interface Flood {
  /** Whether the bead at a position is one the flood takes and has not painted yet. */
  takes: (row: number, column: number) => boolean
  paint: (row: number, column: number) => void
  /** The beads painted, or the layer's own when nothing was. */
  beads: () => BeadMap
  /** Why the flood stopped before it was done, once it has: it ran off the screen or past the cap. */
  refusal: () => FillRefusal | undefined
}

function flood({ beads, geometry, edge, frame }: LayerSheet, start: GridPosition, color: string | null, reach: FillReach): Flood {
  const target = colorAt(beads, start.row, start.column)
  // On the open Canvas empty space is filled only where the screen holds it whole; beads are finite, so not bounded.
  const screen = edge || target !== null ? undefined : (reach.onScreen ?? { row: start.row, column: start.column, rows: 0, columns: 0 })
  const cap = edge ? Infinity : (reach.cap ?? FILL_CAP)
  let painted = 0
  let offScreen = false
  // A Frame without a shape holds its whole edge, asked without making a position (ticket 0677); a shaped or Custom
  // one, and the open Canvas, answer by their geometry.
  const holds =
    edge && !frame?.shape
      ? (row: number, column: number) => row >= edge.row && row < edge.row + edge.rows && column >= edge.column && column < edge.column + edge.columns
      : (row: number, column: number) => geometry.hasPosition({ row, column })
  let next: BeadMap | undefined
  const copied = new Set<number>()
  // The row a span is scanned along, looked up once for the span rather than once a bead.
  let atRow: number | undefined
  let rowBeads: Record<number, string> | undefined
  const beadsOf = (row: number) => {
    if (row !== atRow) {
      atRow = row
      rowBeads = (next ?? beads)[row]
    }
    return rowBeads
  }
  return {
    takes: (row, column) => {
      if ((beadsOf(row)?.[column] ?? null) !== target || !holds(row, column)) return false
      if (!screen || frameContains(screen, { row, column })) return true
      offScreen = true
      return false
    },
    paint: (row, column) => {
      painted += 1
      next ??= { ...beads }
      if (!copied.has(row)) {
        next[row] = { ...beads[row] }
        copied.add(row)
        atRow = undefined
      }
      if (color === null) delete next[row]![column]
      else next[row]![column] = color
    },
    beads: () => {
      if (!next) return beads
      // An erasing Fill can empty a row, and a map never holds an empty row.
      for (const row of copied) {
        if (Object.keys(next[row]!).length === 0) delete next[row]
      }
      return next
    },
    refusal: () => (offScreen ? 'open' : painted > cap ? 'too-big' : undefined),
  }
}

/** A flood over a Layer of rows or columns (tickets 0677, 0734): a seed spreads along its line as far as it goes, the span is
 * painted, and the lines either side are seeded once per run of beads the span touches in them. `along` names the line:
 * a column's span runs down it, and its positions are read as (column, row). */
function floodLines({ takes, paint, refusal }: Flood, start: GridPosition, { along, reach }: NonNullable<LayerGeometry['spans']>): void {
  const columns = along === 'column'
  // A position as (line, place along it).
  const takesAt = columns ? (line: number, place: number) => takes(place, line) : takes
  const paintAt = columns ? (line: number, place: number) => paint(place, line) : paint
  const seeds = columns ? [start.column, start.row] : [start.row, start.column]
  while (seeds.length > 0 && !refusal()) {
    const place = seeds.pop()!
    const line = seeds.pop()!
    if (!takesAt(line, place)) continue
    let first = place
    let last = place
    while (takesAt(line, first - 1)) first -= 1
    while (takesAt(line, last + 1)) last += 1
    for (let at = first; at <= last; at += 1) paintAt(line, at)
    for (const toLine of [line - 1, line + 1]) {
      const [before, after] = reach(line, toLine)
      let inRun = false
      for (let at = first + before; at <= last + after; at += 1) {
        const taken = takesAt(toLine, at)
        if (taken && !inRun) seeds.push(toLine, at)
        inRun = taken
      }
    }
  }
}

/** A flood from neighbour to neighbour, as the layer's geometry joins them: a Custom frame's beads touch across its
 * panels (ticket 0592). */
function floodNeighbors({ takes, paint, refusal }: Flood, start: GridPosition, geometry: LayerGeometry): void {
  const stack = [start]
  while (stack.length > 0 && !refusal()) {
    const position = stack.pop()!
    if (!takes(position.row, position.column)) continue
    paint(position.row, position.column)
    for (const neighbor of geometry.neighbors(position)) stack.push(neighbor)
  }
}

/** Bucket-fills the positions reachable from (row, column) through same-colored neighbours, as the layer's geometry
 * joins them; the same beads back if the pressed one is already that color. A Frame stops it at its edge; on the open
 * Canvas it keeps to Fill reach (ticket 0715), and otherwise paints nothing and says why. */
export function fillArea(sheet: LayerSheet, row: number, column: number, color: string | null, reach: FillReach = {}): BeadMap | FillRefusal {
  if (colorAt(sheet.beads, row, column) === color) {
    return sheet.beads
  }
  const start = { row, column }
  const painting = flood(sheet, start, color, reach)
  if (sheet.geometry.spans) floodLines(painting, start, sheet.geometry.spans)
  else floodNeighbors(painting, start, sheet.geometry)
  return painting.refusal() ?? painting.beads()
}

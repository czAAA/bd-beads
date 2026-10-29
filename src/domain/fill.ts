import { beadBounds, colorAt, frameContains, type BeadMap, type Rect } from './canvas'
import type { GridPosition } from './grid'
import type { LayerGeometry } from './layerGeometry'
import type { LayerSheet } from './layers'

// Fill (ADR 0026): the region of same-colored beads joined to the one pressed, and where it stops.

/** Where a Fill on the open Canvas stops (ADR 0026): the box round every bead and the one pressed, one position wider
 * each side, so filling open space stays a finite patch. A Frame stops it at its own edge. */
function openLimit(beads: BeadMap, start: GridPosition): Rect {
  const boxes = [beadBounds(beads), { row: start.row, column: start.column, rows: 1, columns: 1 }].filter((box): box is Rect => box !== undefined)
  const top = Math.min(...boxes.map((box) => box.row)) - 1
  const left = Math.min(...boxes.map((box) => box.column)) - 1
  const bottom = Math.max(...boxes.map((box) => box.row + box.rows)) + 1
  const right = Math.max(...boxes.map((box) => box.column + box.columns)) + 1
  return { row: top, column: left, rows: bottom - top, columns: right - left }
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
}

function flood({ beads, geometry, edge }: LayerSheet, start: GridPosition, color: string | null): Flood {
  const target = colorAt(beads, start.row, start.column)
  const limit = edge ? undefined : openLimit(beads, start)
  let next: BeadMap | undefined
  const copied = new Set<number>()
  return {
    takes: (row, column) =>
      ((next ?? beads)[row]?.[column] ?? null) === target &&
      (!limit || frameContains(limit, { row, column })) &&
      geometry.hasPosition({ row, column }),
    paint: (row, column) => {
      next ??= { ...beads }
      if (!copied.has(row)) {
        next[row] = { ...beads[row] }
        copied.add(row)
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
  }
}

/** A flood over a Layer of rows (ticket 0677): a seed spreads along its row as far as it goes, the span is painted, and
 * the rows above and below are seeded once per run of beads the span touches in them. */
function floodRows({ takes, paint }: Flood, start: GridPosition, reach: NonNullable<LayerGeometry['rowReach']>): void {
  const seeds = [start.row, start.column]
  while (seeds.length > 0) {
    const column = seeds.pop()!
    const row = seeds.pop()!
    if (!takes(row, column)) continue
    let first = column
    let last = column
    while (takes(row, first - 1)) first -= 1
    while (takes(row, last + 1)) last += 1
    for (let at = first; at <= last; at += 1) paint(row, at)
    for (const toRow of [row - 1, row + 1]) {
      const [before, after] = reach(row, toRow)
      let inRun = false
      for (let at = first + before; at <= last + after; at += 1) {
        const taken = takes(toRow, at)
        if (taken && !inRun) seeds.push(toRow, at)
        inRun = taken
      }
    }
  }
}

/** A flood from neighbour to neighbour, as the layer's geometry joins them: a Custom frame's beads touch across its
 * panels (ticket 0592). */
function floodNeighbors({ takes, paint }: Flood, start: GridPosition, geometry: LayerGeometry): void {
  const stack = [start]
  while (stack.length > 0) {
    const position = stack.pop()!
    if (!takes(position.row, position.column)) continue
    paint(position.row, position.column)
    for (const neighbor of geometry.neighbors(position)) stack.push(neighbor)
  }
}

/** Bucket-fills every position of a layer reachable from (row, column) through same-colored neighbours, as the layer's
 * geometry joins them, with the given color. The same beads back, unchanged, if the pressed one is already that color
 * or the layer has no bead there. */
export function fillArea(sheet: LayerSheet, row: number, column: number, color: string | null): BeadMap {
  if (colorAt(sheet.beads, row, column) === color) {
    return sheet.beads
  }
  const start = { row, column }
  const painting = flood(sheet, start, color)
  if (sheet.geometry.rowReach) floodRows(painting, start, sheet.geometry.rowReach)
  else floodNeighbors(painting, start, sheet.geometry)
  return painting.beads()
}

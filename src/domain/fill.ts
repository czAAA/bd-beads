import { beadBounds, colorAt, frameContains, withColors, type BeadMap, type Rect } from './canvas'
import { positionKey, type GridPosition } from './grid'
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

/** Every position reachable from `start` through same-colored neighbours, as the layer's geometry joins them (a
 * Custom frame's beads touch across its panels, ticket 0592): the flood region of a click. Used by Fill (fillArea). */
function floodRegion({ beads, geometry, edge }: LayerSheet, start: GridPosition): GridPosition[] {
  const targetColor = colorAt(beads, start.row, start.column)
  const limit = edge ? undefined : openLimit(beads, start)
  const visited = new Set<string>()
  const region: GridPosition[] = []
  const stack = [start]
  while (stack.length > 0) {
    const position = stack.pop()!
    const key = positionKey(position)
    if (visited.has(key)) {
      continue
    }
    visited.add(key)
    if ((limit && !frameContains(limit, position)) || !geometry.hasPosition(position) || colorAt(beads, position.row, position.column) !== targetColor) {
      continue
    }
    region.push(position)
    stack.push(...geometry.neighbors(position))
  }
  return region
}

/** Bucket-fills every position of a layer reachable from (row, column) through same-colored neighbours (see
 * floodRegion), with the given color. The same beads back, unchanged, if the pressed one is already that color. */
export function fillArea(sheet: LayerSheet, row: number, column: number, color: string | null): BeadMap {
  if (colorAt(sheet.beads, row, column) === color) {
    return sheet.beads
  }
  const region = floodRegion(sheet, { row, column })
  return region.length === 0 ? sheet.beads : withColors(sheet.beads, region.map((position) => ({ ...position, color })))
}

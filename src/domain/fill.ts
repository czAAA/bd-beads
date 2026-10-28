import { beadBounds, colorAt, frameContains, withColors, type Rect } from './canvas'
import { restoreBeads } from './drawing'
import { frameLayoutOf } from './frameKind'
import { layoutNeighbors, layoutPosition } from './frameLayout'
import { positionKey, type GridPosition } from './grid'
import type { Project } from './project'
import { describeWeave, neighborsOf } from './weave'

// Fill (ADR 0026): the region of same-colored beads joined to the one pressed, and where it stops.

/** Where a Fill stops (ADR 0026): the Frame when it starts inside one, else the box round the Frame and every bead,
 * one position wider each side, so filling open space stays a finite patch. */
function fillLimit(project: Pick<Project, 'beads' | 'frame'>, start: GridPosition): Rect {
  if (project.frame && frameContains(project.frame, start)) {
    return project.frame
  }
  const boxes = [project.frame, beadBounds(project.beads), { row: start.row, column: start.column, rows: 1, columns: 1 }].filter(
    (box): box is Rect => box !== undefined,
  )
  const top = Math.min(...boxes.map((box) => box.row)) - 1
  const left = Math.min(...boxes.map((box) => box.column)) - 1
  const bottom = Math.max(...boxes.map((box) => box.row + box.rows)) + 1
  const right = Math.max(...boxes.map((box) => box.column + box.columns)) + 1
  return { row: top, column: left, rows: bottom - top, columns: right - left }
}

/** Every cell reachable from `start` through same-colored neighbors (see neighborsOf): the flood region of a click.
 * Used by Fill (fillArea). */
function floodRegion(project: Pick<Project, 'beads' | 'frame' | 'technique'>, start: GridPosition): GridPosition[] {
  const targetColor = colorAt(project.beads, start.row, start.column)
  // A Custom frame's beads touch across its panels, not along rows and columns (ticket 0592).
  const layout = project.frame && frameLayoutOf(project.frame)
  if (layout) {
    const inside = (position: GridPosition) => layoutPosition(layout, position) !== undefined && colorAt(project.beads, position.row, position.column) === targetColor
    return reachable(start, inside, (position) => layoutNeighbors(layout, position))
  }
  const limit = fillLimit(project, start)
  const weave = describeWeave(project)
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

    if (!weave.hasPosition(position, project.frame) || colorAt(project.beads, position.row, position.column) !== targetColor) {
      continue
    }
    region.push(position)
    stack.push(...neighborsOf(project, limit, position))
  }

  return region
}

/** Every position joined to `start` through positions that are `inside`, one `next` step at a time. */
function reachable(start: GridPosition, inside: (position: GridPosition) => boolean, next: (position: GridPosition) => GridPosition[]): GridPosition[] {
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
    if (!inside(position)) {
      continue
    }
    region.push(position)
    stack.push(...next(position))
  }
  return region
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors (see floodRegion), with the
 * given color. Returns the same Project instance, unchanged, if the clicked cell is already that color. */
export function fillArea(project: Project, row: number, column: number, color: string | null): Project {
  if (colorAt(project.beads, row, column) === color) {
    return project
  }

  const region = floodRegion(project, { row, column })
  if (region.length === 0) {
    return project
  }
  return restoreBeads(project, withColors(project.beads, region.map((position) => ({ ...position, color }))))
}

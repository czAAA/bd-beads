import { CELL_SIZE_PX } from '../domain/grid'
import type { GridDimensions, GridPosition, Technique } from '../domain/grid'
import {
  projectExtentPx,
  beadRoundness,
  rowPitchPx,
  rowShiftPx,
  rowTopPx,
  type DrawnProject,
} from './projectRenderer'

/**
 * Which bead a point is on (ADR 0018): what "the element under the pointer" was when every bead was one. Worked out
 * from the Project's own geometry — the zoom, the rotation, the Technique's stagger and row packing — because a drawing
 * surface has no elements to ask.
 *
 * It answers as the DOM grid did, which is what the pointer tools were built against:
 *  - a bead is its whole 20 px box, rim included, so a point on its edge or its rim is on it;
 *  - where peyote's rows nest, the row drawn later is on top, so it wins the overlap — except in its rounded corners,
 *    which are not part of the bead, where the row underneath shows through;
 *  - brick stitch's seam between rows, and anything outside the beads (the gaps beside a shifted row, the outline),
 *    is on no bead at all.
 */

/**
 * The bead at a point of the displayed Project: `point` is in the displayed Project's px (zoomed, and turned when the
 * Project is rotated) measured from its first bead's top-left, which is where a surface's own coordinates start.
 */
export function beadAt(
  project: Pick<DrawnProject, 'technique' | 'rotation'> & GridDimensions,
  point: { x: number; y: number },
  zoom: number,
): GridPosition | undefined {
  const { technique, columns, rows } = project
  const extent = projectExtentPx(technique, columns, rows)

  // Back into the Project's own space: undo whichever quarter turn is on (see gridToRegion's own forward version).
  const [gridX, gridY] = ((): [number, number] => {
    const x = point.x / zoom
    const y = point.y / zoom
    switch (project.rotation) {
      case 90:
        return [y, extent.height - x]
      case 180:
        return [extent.width - x, extent.height - y]
      case 270:
        return [extent.width - y, x]
      default:
        return [x, y]
    }
  })()
  if (gridX < 0 || gridY < 0 || gridY >= extent.height) {
    return undefined
  }

  return beadInGrid(technique, gridX, gridY, { firstRow: 0, lastRow: rows - 1, columns })
}

/**
 * The bead under a point on an open canvas (ADR 0026), or undefined between beads: the same hit test with no edge, for
 * a point in displayed px (turned, zoomed, from the bead at row 0, column 0 — see canvasRenderer), so any position,
 * negative included, can be found.
 */
export function beadAtOpen(
  project: Pick<DrawnProject, 'technique' | 'rotation'>,
  point: { x: number; y: number },
  zoom: number,
): GridPosition | undefined {
  const x = point.x / zoom
  const y = point.y / zoom
  const [gridX, gridY] = ((): [number, number] => {
    switch (project.rotation) {
      case 90:
        return [y, -x]
      case 180:
        return [-x, -y]
      case 270:
        return [-y, x]
      default:
        return [x, y]
    }
  })()
  return beadInGrid(project.technique, gridX, gridY, {})
}

/**
 * The bead position nearest a point on an open canvas, gaps and rounded corners included (ADR 0026): what dragging a
 * Frame needs, where a pointer between two beads still means one of them. Same point as beadAtOpen takes.
 */
export function cellAtOpen(
  project: Pick<DrawnProject, 'technique' | 'rotation'>,
  point: { x: number; y: number },
  zoom: number,
): GridPosition {
  const x = point.x / zoom
  const y = point.y / zoom
  const [gridX, gridY] = ((): [number, number] => {
    switch (project.rotation) {
      case 90:
        return [y, -x]
      case 180:
        return [-x, -y]
      case 270:
        return [-y, x]
      default:
        return [x, y]
    }
  })()
  const row = Math.round((gridY - CELL_SIZE_PX / 2) / rowPitchPx(project.technique))
  return { row, column: Math.floor((gridX - rowShiftPx(project.technique, row)) / CELL_SIZE_PX) }
}

/** Where a point in grid space falls: the row the bead is in and its column, or undefined in the gap or a rounded corner. A bound left out is no bound. */
function beadInGrid(
  technique: Technique,
  gridX: number,
  gridY: number,
  limits: { firstRow?: number; lastRow?: number; columns?: number },
): GridPosition | undefined {
  // The rows whose beads reach this height: the one it falls in by the row pitch, and (where rows nest) the one above
  // it, whose bottom is under the next row's top. Later rows are drawn over earlier ones, so try the lowest first.
  const pitch = rowPitchPx(technique)
  const lowest = Math.min(limits.lastRow ?? Infinity, Math.floor(gridY / pitch))
  const highest = Math.max(limits.firstRow ?? -Infinity, Math.ceil((gridY - CELL_SIZE_PX) / pitch))
  const radius = beadRoundness(technique) * CELL_SIZE_PX

  for (let row = lowest; row >= highest; row -= 1) {
    const offsetY = gridY - rowTopPx(technique, row)
    const offsetX = gridX - rowShiftPx(technique, row)
    if (offsetY < 0 || offsetY >= CELL_SIZE_PX || (limits.columns !== undefined && offsetX < 0)) {
      continue
    }

    const column = Math.floor(offsetX / CELL_SIZE_PX)
    if (limits.columns !== undefined && column >= limits.columns) {
      continue
    }
    if (inRoundedCorner(offsetX - column * CELL_SIZE_PX, offsetY, radius)) {
      continue
    }
    return { row, column }
  }

  return undefined
}

function inRoundedCorner(x: number, y: number, radius: number): boolean {
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : x
  const cornerY = y < radius ? radius : y > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

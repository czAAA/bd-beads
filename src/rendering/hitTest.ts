import { CELL_SIZE_PX } from '../domain/grid'
import type { GridPosition } from '../domain/grid'
import {
  patternExtentPx,
  beadRoundness,
  rowPitchPx,
  rowShiftPx,
  rowTopPx,
  type DrawnPattern,
} from './patternRenderer'

/**
 * Which bead a point is on (ADR 0018): what "the element under the pointer" was when every bead was one. Worked out
 * from the Pattern's own geometry — the zoom, the rotation, the Technique's stagger and row packing — because a drawing
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
 * The bead at a point of the displayed Pattern: `point` is in the displayed Pattern's px (zoomed, and turned when the
 * Pattern is rotated) measured from its first bead's top-left, which is where a surface's own coordinates start.
 */
export function beadAt(
  pattern: Pick<DrawnPattern, 'technique' | 'columns' | 'rows' | 'rotation'>,
  point: { x: number; y: number },
  zoom: number,
): GridPosition | undefined {
  const { technique, columns, rows } = pattern
  const extent = patternExtentPx(technique, columns, rows)

  // Back into the Pattern's own space: undo whichever quarter turn is on (see gridToRegion's own forward version).
  const [gridX, gridY] = ((): [number, number] => {
    const x = point.x / zoom
    const y = point.y / zoom
    switch (pattern.rotation) {
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

  // The rows whose beads reach this height: the one it falls in by the row pitch, and (where rows nest) the one above
  // it, whose bottom is under the next row's top. Later rows are drawn over earlier ones, so try the lowest first.
  const pitch = rowPitchPx(technique)
  const lowest = Math.min(rows - 1, Math.floor(gridY / pitch))
  const highest = Math.max(0, Math.ceil((gridY - CELL_SIZE_PX) / pitch))
  const radius = beadRoundness(technique) * CELL_SIZE_PX

  for (let row = lowest; row >= highest; row -= 1) {
    const offsetY = gridY - rowTopPx(technique, row)
    const offsetX = gridX - rowShiftPx(technique, row)
    if (offsetY < 0 || offsetY >= CELL_SIZE_PX || offsetX < 0) {
      continue
    }

    const column = Math.floor(offsetX / CELL_SIZE_PX)
    if (column >= columns) {
      continue
    }
    if (inRoundedCorner(offsetX - column * CELL_SIZE_PX, offsetY, radius)) {
      continue
    }
    return { row, column }
  }

  return undefined
}

/** Whether a point of a bead's box is in one of its rounded-off corners, outside the bead's shape. */
function inRoundedCorner(x: number, y: number, radius: number): boolean {
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : x
  const cornerY = y < radius ? radius : y > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

import type { Rect } from '../domain/canvas'
import type { GridPosition, Layer } from '../domain/grid'
import { frameOf, type Layered } from '../domain/layerRecord'
import { frameGeometryOf, layerAt, positionInLayer } from '../domain/layers'
import { canvasWeave, frameScale, frameWeave } from '../domain/layerWeave'
import { pointOnPicture, turnedExtent, type ReferencePlace } from '../domain/referenceImage'
import { describeWeave, type Weave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { beadStepPx, frameOriginPx, inGridPx, positionBoxPx, type Region } from './surfaceView'

// What the reference image covers on the Canvas (ReferenceImage card, ticket 0883): the size the chip shows, the Frame
// Set Frame around the picture makes and the beads Convert to beads lays all start from the same positions.

/** A Canvas position whose centre lies on the picture, and where: fractions of the picture's width and height from its
 * own top-left. */
interface CoveredPosition extends GridPosition {
  u: number
  v: number
}

/** The positions a picture covers and the box round them, whose columns × rows is its size in beads. `listed` is false
 * for a picture too big to convert, whose box is worked out from its corners alone. */
export interface PictureCover {
  positions: CoveredPosition[]
  box: Rect | undefined
  listed: boolean
}

/** Past this many positions a side the positions aren't listed: far over what Convert to beads takes (300). */
const LIST_LIMIT = 600

/** Every Canvas position whose centre lies on the picture, a turned one as it lies (ReferenceImage card). */
export function pictureCover(weave: Weave, place: ReferencePlace, height: number): PictureCover {
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  const extent = turnedExtent(place.width, height, place.angle)
  const area = { left: place.x - extent.width / 2, right: place.x + extent.width / 2, top: place.y - extent.height / 2, bottom: place.y + extent.height / 2 }
  const step = beadStepPx(weave)
  if ((area.right - area.left) / step.across > LIST_LIMIT || (area.bottom - area.top) / step.down > LIST_LIMIT) {
    const first = description.nearestPosition(area.left + step.across / 2, area.top + step.down / 2, cell.width, cell.height)
    const last = description.nearestPosition(area.right - step.across / 2, area.bottom - step.down / 2, cell.width, cell.height)
    const box = { row: first.row, column: first.column, rows: last.row - first.row + 1, columns: last.column - first.column + 1 }
    return { positions: [], box, listed: false }
  }
  const seen = description.visible(area, cell.width, cell.height)
  const positions: CoveredPosition[] = []
  let [top, left, bottom, right] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let row = seen.firstRow; row <= seen.lastRow; row += 1) {
    const { first, last } = seen.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      const at = pointOnPicture(place, height, description.center({ row, column }, cell.width, cell.height))
      if (!at) continue
      positions.push({ row, column, ...at })
      top = Math.min(top, row)
      bottom = Math.max(bottom, row)
      left = Math.min(left, column)
      right = Math.max(right, column)
    }
  }
  const box = positions.length === 0 ? undefined : { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
  return { positions, box, listed: true }
}

/** Where the centre of the bead pressed at a Canvas position lies on the picture, on the layer the press landed on (a
 * Frame's bead where the Frame draws it, through its Bead's size and shape): what Pick color reads (ticket 1119). None
 * off the picture. */
export function pressOnPicture(project: Layered, position: GridPosition, layer: Layer | undefined, place: ReferencePlace, height: number): { u: number; v: number } | undefined {
  const frame = (layer ?? layerAt(project, position)) === 'frame' ? frameOf(project) : undefined
  const canvas = canvasWeave(project)
  if (!frame) return pointOnPicture(place, height, centreOf(positionBoxPx(canvas, position.row, position.column)))
  const local = positionInLayer(project, 'frame', position)
  const placed = frameGeometryOf(project).place(local)
  const box = placed ? inGridPx(placed.box) : positionBoxPx(frameWeave(project), local.row, local.column)
  const origin = frameOriginPx(canvas, frame)
  const scale = frameScale(project)
  const centre = centreOf(box)
  return pointOnPicture(place, height, { x: origin.x + centre.x * scale, y: origin.y + centre.y * scale })
}

function centreOf({ x, y, width, height }: Region): { x: number; y: number } {
  return { x: x + width / 2, y: y + height / 2 }
}

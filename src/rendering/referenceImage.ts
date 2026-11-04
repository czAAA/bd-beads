import { beadBounds, type Rect } from '../domain/canvas'
import { footprintOf } from '../domain/footprint'
import { beadsOfLayer, type Layered } from '../domain/layerRecord'
import { canvasWeave } from '../domain/layerWeave'
import { radians, type OpacityStep, type ReferenceBox, type ReferencePlace, type WidthLimits } from '../domain/referenceImage'
import type { DrawingContext } from './beadLook'
import { cellSizePx } from './cellSize'
import { gridBox } from './surfaceView'

// The reference image on the Canvas (ReferenceImage card, ticket 0790): where the renderer draws it and how big it may
// be. Only the editor's surface hands one in; an export, a thumbnail or a Homepage example never does, so none prints.

/** The picture as the renderer draws it: decoded, in its place, at its opacity step. */
export interface DrawnReference {
  image: CanvasImageSource
  place: ReferencePlace
  /** Its drawn height in grid px, its width in its own shape. */
  height: number
  opacity: OpacityStep
}

/** How opaque an empty bead's fill is drawn over the picture at each opacity step (ReferenceImage card): less as the
 * picture shows more, the rim always kept. */
export const EMPTY_BEAD_OPACITY: Readonly<Record<OpacityStep, number>> = { 25: 0.5, 50: 0.37, 75: 0.25, 100: 0.12 }

/** Draws the picture through the context's grid transform: at its centre, turned by its own angle, at its opacity. */
export function drawReference(context: DrawingContext, { image, place, height, opacity }: DrawnReference): void {
  context.save()
  context.translate(place.x, place.y)
  context.rotate(radians(place.angle))
  context.globalAlpha = opacity / 100
  // A picture is resampled as it is laid down, unlike the bead bitmaps.
  context.imageSmoothingEnabled = true
  context.drawImage(image, -place.width / 2, -height / 2, place.width, height)
  context.restore()
}

/** How many positions square the Canvas's box is with no beads, no Frame and no view to go by. */
const EMPTY_BOX_POSITIONS = 30

/** The Canvas's box in grid px (ReferenceImage card): the box round its beads and its Frame's, which a new picture is
 * fitted inside; for an empty Canvas without a Frame, the positions `inView`, or a 30-bead square at its first. */
export function referenceBoxPx(project: Layered, inView?: Rect): ReferenceBox {
  const weave = canvasWeave(project)
  const boxes = [beadBounds(beadsOfLayer(project, 'canvas')), footprintOf(project)].flatMap((rect) => (rect ? [gridBox(weave, rect)] : []))
  if (boxes.length === 0) return gridBox(weave, inView ?? { row: 0, column: 0, rows: EMPTY_BOX_POSITIONS, columns: EMPTY_BOX_POSITIONS })
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** How small and large the picture may be made (ReferenceImage card): no narrower than 4 beads, no wider than ten times
 * the Canvas's box. */
export function referenceWidthLimits(project: Layered, box: ReferenceBox): WidthLimits {
  const weave = canvasWeave(project)
  const min = 4 * cellSizePx(weave.technique, weave.cell).width
  return { min, max: Math.max(min, 10 * Math.max(box.width, box.height)) }
}

/** How far the Turn handle stands off the picture's edge in Adjust, in screen px: `--frame-control-offset`. */
export const REFERENCE_TURN_OFFSET_PX = 48

/** A point of the drawing area, in its px. */
interface ScreenPoint {
  x: number
  y: number
}

/** What Adjust reads of the surface's view: where a grid point is on screen. */
export interface ReferenceView {
  gridToPoint(x: number, y: number): ScreenPoint
}

/** The grid point under a point of the drawing area: the inverse of the view's `gridToPoint`, which turns and zooms. */
export function screenToGrid(view: ReferenceView, point: ScreenPoint): ScreenPoint {
  const origin = view.gridToPoint(0, 0)
  const along = view.gridToPoint(1, 0)
  const down = view.gridToPoint(0, 1)
  const [ax, ay, dx, dy] = [along.x - origin.x, along.y - origin.y, down.x - origin.x, down.y - origin.y]
  const det = ax * dy - ay * dx
  const [px, py] = [point.x - origin.x, point.y - origin.y]
  return { x: (px * dy - py * dx) / det, y: (ax * py - ay * px) / det }
}

/** How the picture lies on screen in Adjust: its centre, its size and its angle there in degrees (its own turn and the
 * Canvas's). */
export function placeOnScreen(view: ReferenceView, place: ReferencePlace, height: number): { centre: ScreenPoint; width: number; height: number; angle: number } {
  const centre = view.gridToPoint(place.x, place.y)
  const turn = radians(place.angle)
  const across = view.gridToPoint(place.x + Math.cos(turn) * place.width, place.y + Math.sin(turn) * place.width)
  const width = Math.hypot(across.x - centre.x, across.y - centre.y)
  return { centre, width, height: (width * height) / place.width, angle: (Math.atan2(across.y - centre.y, across.x - centre.x) * 180) / Math.PI }
}

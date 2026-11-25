import { nearestQuarterTurn, tiltOf } from '../domain/canvasOrientation'
import type { Rotation } from '../domain/grid'
import type { Size } from './cellSize'
import type { Affine } from './gestureView'
import type { Scroll } from './surfaceView'
import { tiltedView, type TiltedView } from './tiltedView'

// The editor's two stacked surfaces (spec 1182, ticket 1187): the Canvas and the Frame are each drawn at their own
// nearest quarter turn and leaned on their own about the screen's middle (`tiltedView`). Each layer lies on the Table
// on its own (spec 1234), so every Frame is drawn on its own surface; a turn of the Canvas alone leaves the Frame's
// drawing where it is (ticket 1188).

/** One layer's drawing: the quarter turn its surface is drawn at, how it leans on the screen, and the scroll it is shown
 * from. */
export interface LayerDrawing {
  /** The quarter turn the drawn Project's Canvas is at on this surface: the Frame's own is this plus its quarter turns
   * on the Canvas. */
  rotation: Rotation
  leaning: TiltedView
  /** Where the drawing's top-left is, in its displayed px: the view's scroll less how far the larger square a lean
   * draws on reaches past the screen. */
  scroll: Scroll
}

/** The Canvas's drawing on a screen, shown at `orientation` from the view's `scroll`. */
export function canvasDrawing(screen: Size, orientation: number, scroll: Scroll): LayerDrawing {
  const leaning = tiltedView(screen, tiltOf(orientation))
  const { offset } = leaning
  return { rotation: nearestQuarterTurn(orientation), leaning, scroll: offset.x === 0 && offset.y === 0 ? scroll : { x: scroll.x - offset.x, y: scroll.y - offset.y } }
}

/** Where the Frame's drawing is pinned: its centre in that drawing's displayed px at scroll 0, and where it shows on
 * the screen. Asked only where the Frame is drawn otherwise than the Canvas. */
export interface FramePin {
  displayed: Scroll
  onScreen: Scroll
}

/** The Frame's drawing (ticket 1187): leaning by its own `angle`, its Canvas drawn at `rotation`, and scrolled so its
 * centre shows where `pin` says. Where that is how the Canvas is drawn, the Canvas's very drawing, unless it is drawn
 * on its `own`: off the Canvas's grid, its place is not the Canvas's positions (ticket 1188). */
export function frameDrawing({ screen, angle, rotation, canvas, own = false, pin }: { screen: Size; angle: number; rotation: Rotation; canvas: LayerDrawing; own?: boolean; pin: () => FramePin }): LayerDrawing {
  const tilt = tiltOf(angle)
  if (!own && rotation === canvas.rotation && tilt === canvas.leaning.degrees) return canvas
  const leaning = tiltedView(screen, tilt)
  const { displayed, onScreen } = pin()
  const at = leaning.toDrawn(onScreen)
  return { rotation, leaning, scroll: { x: displayed.x - at.x, y: displayed.y - at.y } }
}

/** How a point of one leaning drawing lies in another's (ticket 1187): out to the screen by the first's lean, and in by
 * the second's. What the Canvas's view lays the Frame layer through. */
export function seamOf(from: TiltedView, to: TiltedView): Affine {
  const carried = (x: number, y: number) => to.toDrawn(from.toScreen({ x, y }))
  const [origin, across, down] = [carried(0, 0), carried(1, 0), carried(0, 1)]
  return { a: across.x - origin.x, b: across.y - origin.y, c: down.x - origin.x, d: down.y - origin.y, e: origin.x, f: origin.y }
}

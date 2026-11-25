import { nearestQuarterTurn } from '../domain/canvasOrientation'
import type { Rotation } from '../domain/grid'
import type { Scroll } from './surfaceView'
import type { TableTurnView } from './tableTurnView'

// The editor's one shared surface (spec 1182, ticket 1187, spec 1234): the Canvas and each Frame are drawn at their own
// nearest quarter turn on the one square the Table turn leans (`tableTurnView`). Layers differ by quarter turns alone,
// so they lean alike; a turn of the Canvas alone leaves the Frame's drawing where it is (ticket 1188).

/** One layer's drawing: the quarter turn its surface is drawn at, and the scroll it is shown from. */
export interface LayerDrawing {
  /** The quarter turn the drawn Project's Canvas is at on this surface: the Frame's own is this plus its quarter turns
   * on the Canvas. */
  rotation: Rotation
  /** Where the drawing's top-left is, in its displayed px: the view's scroll less how far the larger square the Table
   * turn draws on reaches past the screen. */
  scroll: Scroll
}

/** The Canvas's drawing, shown at `orientation` from the view's `scroll`, on the Table turn's square `view`. */
export function canvasDrawing(view: TableTurnView, orientation: number, scroll: Scroll): LayerDrawing {
  const { offset } = view
  return { rotation: nearestQuarterTurn(orientation), scroll: offset.x === 0 && offset.y === 0 ? scroll : { x: scroll.x - offset.x, y: scroll.y - offset.y } }
}

/** Where the Frame's drawing is pinned: its centre in that drawing's displayed px at scroll 0, and where it shows on
 * the screen. */
export interface FramePin {
  displayed: Scroll
  onScreen: Scroll
}

/** The Frame's drawing (ticket 1187): its Canvas drawn at `rotation`, and scrolled so its centre shows where `pin` says.
 * Every Frame has one, painted into the shared bitmap (ticket 1239). */
export function frameDrawing({ view, rotation, pin }: { view: TableTurnView; rotation: Rotation; pin: () => FramePin }): LayerDrawing {
  const { displayed, onScreen } = pin()
  const at = view.toDrawn(onScreen)
  return { rotation, scroll: { x: displayed.x - at.x, y: displayed.y - at.y } }
}

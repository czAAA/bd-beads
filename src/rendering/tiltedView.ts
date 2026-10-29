import { nearestQuarterTurn, tiltOf } from '../domain/canvasOrientation'
import type { Size } from './cellSize'
import type { Region, Scroll } from './surfaceView'

// A Canvas twisted off a quarter turn (ticket 0672) is drawn at that quarter turn, as ever, on a square as wide as the
// screen's diagonal, and the square is turned the rest about the screen's middle. So every point, box and bead keeps
// the quarter turn's own mapping, and only a point crossing between the screen and the drawing is turned here.

/** The screen of a view leaning `degrees` off its quarter turn, and its drawing. */
export interface TiltedView {
  /** The lean, under 45° either way, clockwise positive. */
  degrees: number
  /** The drawing's size: the screen's when upright, else a square that still covers the screen once turned. */
  drawn: Size
  /** How far the drawing's top-left lies above and left of the screen's, before it is turned. */
  offset: Scroll
  /** A point of the screen, in px from its top-left, on the drawing. */
  toDrawn(point: Scroll): Scroll
  /** A point of the drawing, on the screen. */
  toScreen(point: Scroll): Scroll
  /** A point of the screen in the view the scroll is measured in: the drawing less its offset. */
  toView(point: Scroll): Scroll
  /** A move on screen as a move across the drawing. */
  unturned(move: Scroll): Scroll
  /** The box on screen round a box of the drawing, turned. */
  screenBox(region: Region): Region
}

/** A vector turned `degrees` clockwise on a screen whose y runs down, exact at a quarter turn. */
function turned({ x, y }: Scroll, degrees: number): Scroll {
  const radians = (degrees * Math.PI) / 180
  const quarter = degrees % 90 === 0
  const cos = quarter ? Math.round(Math.cos(radians)) : Math.cos(radians)
  const sin = quarter ? Math.round(Math.sin(radians)) : Math.sin(radians)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/** The screen and drawing of a view `degrees` off its quarter turn (ticket 0672). */
export function tiltedView(screen: Size, degrees: number): TiltedView {
  const upright = degrees === 0
  const side = Math.ceil(Math.hypot(screen.width, screen.height))
  const drawn = upright ? { ...screen } : { width: side, height: side }
  const offset = upright ? { x: 0, y: 0 } : { x: (drawn.width - screen.width) / 2, y: (drawn.height - screen.height) / 2 }
  const middle = { x: screen.width / 2, y: screen.height / 2 }
  // Upright, a point is where it is: the screen is the drawing, whether or not it has been measured yet.
  const toDrawn = (point: Scroll): Scroll => {
    if (upright) return { ...point }
    const from = turned({ x: point.x - middle.x, y: point.y - middle.y }, -degrees)
    return { x: from.x + drawn.width / 2, y: from.y + drawn.height / 2 }
  }
  const toScreen = (point: Scroll): Scroll => {
    if (upright) return { ...point }
    const to = turned({ x: point.x - drawn.width / 2, y: point.y - drawn.height / 2 }, degrees)
    return { x: to.x + middle.x, y: to.y + middle.y }
  }
  return {
    degrees,
    drawn,
    offset,
    toDrawn,
    toScreen,
    toView: (point) => {
      const at = toDrawn(point)
      return { x: at.x - offset.x, y: at.y - offset.y }
    },
    unturned: (move) => (upright ? { ...move } : turned(move, -degrees)),
    screenBox: ({ x, y, width, height }) => {
      const corners = [toScreen({ x, y }), toScreen({ x: x + width, y }), toScreen({ x, y: y + height }), toScreen({ x: x + width, y: y + height })]
      const xs = corners.map((corner) => corner.x)
      const ys = corners.map((corner) => corner.y)
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
    },
  }
}

/** The scroll that keeps the bead under `anchor` (a point of the screen; its middle when left out) there as the Canvas
 * turns `from` one orientation `to` another, in degrees. The Canvas turns about its origin by quarters and the drawing
 * about the screen's middle by the rest (ticket 0672). */
export function scrollAfterTurn(scroll: Scroll, viewport: Size, { from, to, anchor }: { from: number; to: number; anchor?: Scroll }): Scroll {
  const middle = { x: viewport.width / 2, y: viewport.height / 2 }
  const at = anchor ?? middle
  const out = { x: at.x - middle.x, y: at.y - middle.y }
  // About the anchor: the middle swings round it by the whole turn, the Canvas's origin by the quarter turns.
  const swung = turned(out, to - from)
  const shift = turned({ x: swung.x - out.x, y: swung.y - out.y }, -tiltOf(to))
  const carried = turned({ x: scroll.x + middle.x, y: scroll.y + middle.y }, nearestQuarterTurn(to) - nearestQuarterTurn(from))
  return { x: shift.x + carried.x - middle.x, y: shift.y + carried.y - middle.y }
}

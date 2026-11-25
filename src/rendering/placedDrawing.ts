import type { DrawingContext } from './beadLook'
import type { Affine } from './gestureView'
import type { Scroll } from './surfaceView'

/** Whether a placement leaves every point where it is. */
function isIdentity({ a, b, c, d, e, f }: Affine): boolean {
  return a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0
}

/** The placement of one drawing's bitmap on the surface (ticket 1219): every layer shares the Table turn, so it is a shift
 * alone, the bitmap starting at `from` of the drawing's points, the surface's at `to` of its own, both `pixelRatio`
 * device px to a point. */
export function placementOf(pixelRatio: number, from: Scroll, to: Scroll): Affine {
  // `|| 0` keeps a zero shift +0, not -0.
  return { a: 1, b: 0, c: 0, d: 1, e: (from.x - to.x) * pixelRatio || 0, f: (from.y - to.y) * pixelRatio || 0 }
}

/** Draws through a placement (ticket 1219): every transform the drawing sets is laid after `placement`, from the
 * drawing's device px to the surface's, so a renderer that sets its own transforms draws one Frame of several where it
 * lies on their one surface, at its own angle. The context is as it was after. */
export function drawPlaced(context: Pick<DrawingContext, 'setTransform'>, placement: Affine, draw: () => void): void {
  if (isIdentity(placement)) {
    draw()
    return
  }
  const own = Object.prototype.hasOwnProperty.call(context, 'setTransform')
  const set = context.setTransform
  const setTo = set as (...matrix: number[]) => void
  const { a, b, c, d, e, f } = placement
  context.setTransform = ((m11: number, m12: number, m21: number, m22: number, dx: number, dy: number) =>
    setTo.call(context, a * m11 + c * m12, b * m11 + d * m12, a * m21 + c * m22, b * m21 + d * m22, a * dx + c * dy + e, b * dx + d * dy + f)) as typeof set
  try {
    draw()
  } finally {
    if (own) context.setTransform = set
    else delete (context as Partial<Pick<DrawingContext, 'setTransform'>>).setTransform
  }
}

/** How close to the canvas box's edge a dragged Frame's pointer must be before the view follows it, and the fastest
 * the view then moves, in px per frame. */
const EDGE_ZONE_PX = 16
const MAX_STEP_PX = 16
/** How far in (or past) the edge the pointer is when the view reaches its top speed. */
const FULL_SPEED_DEPTH_PX = 2 * EDGE_ZONE_PX

function axisStep(position: number, length: number): number {
  const depth = position < EDGE_ZONE_PX ? EDGE_ZONE_PX - position : position - (length - EDGE_ZONE_PX)
  if (depth <= 0) return 0
  const step = Math.max(1, Math.round(MAX_STEP_PX * Math.min(1, depth / FULL_SPEED_DEPTH_PX)))
  return position < EDGE_ZONE_PX ? -step : step
}

/** How far the view scrolls this frame while a Frame is dragged with the pointer at `point` in a box of `size`: toward
 * the edge it touches (or has gone past), faster the further in, none away from the edges. */
export function edgeScrollStep(point: { x: number; y: number }, size: { width: number; height: number }): { dx: number; dy: number } {
  return { dx: axisStep(point.x, size.width), dy: axisStep(point.y, size.height) }
}

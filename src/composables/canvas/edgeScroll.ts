/** How close to the canvas box's edge the pointer dragging a Frame or a Selection must be before the view follows it,
 * and the fastest the view then moves, in px per frame. */
const EDGE_ZONE_PX = 16
const MAX_STEP_PX = 16
/** How far in (or past) the edge the pointer is when the view reaches its top speed. */
const FULL_SPEED_DEPTH_PX = 2 * EDGE_ZONE_PX

/** The same for a finger or a Pencil (ticket 0805): on a tablet the canvas box's edges are the glass's, which they
 * cannot go past, so the zone is wider and the top speed comes this far short of the edge. */
const GLASS_ZONE_PX = 44
const GLASS_FULL_SPEED_INSET_PX = 8

function axisStep(position: number, length: number, onGlass: boolean): number {
  const zone = onGlass ? GLASS_ZONE_PX : EDGE_ZONE_PX
  const fullSpeedDepth = onGlass ? GLASS_ZONE_PX - GLASS_FULL_SPEED_INSET_PX : FULL_SPEED_DEPTH_PX
  const depth = position < zone ? zone - position : position - (length - zone)
  if (depth <= 0) return 0
  const step = Math.max(1, Math.round(MAX_STEP_PX * Math.min(1, depth / fullSpeedDepth)))
  return position < zone ? -step : step
}

/** How far the view scrolls this frame while a Frame or a Selection is dragged with the pointer at `point` in a box of
 * `size`: toward the edge it touches (or has gone past), faster the further in, none away from the edges. `onGlass`
 * for a finger or a Pencil, which cannot go past the edge. */
export function edgeScrollStep(point: { x: number; y: number }, size: { width: number; height: number }, onGlass = false): { dx: number; dy: number } {
  return { dx: axisStep(point.x, size.width, onGlass), dy: axisStep(point.y, size.height, onGlass) }
}

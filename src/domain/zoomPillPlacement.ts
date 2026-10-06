/**
 * Where the phone's Zoom pill rests (tickets 297, 321): anywhere inside the canvas box's drawing area. Kept as the share
 * of the room the pill has to move in, 0 at the left / top edge and 1 at the right / bottom edge, so it stays fully
 * visible, and keeps its relative place, however the box changes size.
 */
export interface ZoomPillPlacement {
  x: number
  y: number
}

export const DEFAULT_ZOOM_PILL_PLACEMENT: ZoomPillPlacement = { x: 1, y: 1 }

/** The gap kept between the pill and the drawing area's edges (CSS `--space-16`). */
const ZOOM_PILL_INSET_PX = 16

/** How far Alt + an arrow key moves the pill. */
export const ZOOM_PILL_NUDGE_PX = 24

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1)

/** `area` without the gap the pill keeps from its edges. */
function inner(area: Box): Box {
  return { left: area.left + ZOOM_PILL_INSET_PX, top: area.top + ZOOM_PILL_INSET_PX, width: area.width - 2 * ZOOM_PILL_INSET_PX, height: area.height - 2 * ZOOM_PILL_INSET_PX }
}

/** Moves `pill` by (dx, dy), but never past the edges of `area` (less the pill's gap): the pill stays fully inside it. */
export function clampOffset(pill: Box, area: Box, dx: number, dy: number): { x: number; y: number } {
  const room = inner(area)
  const minX = room.left - pill.left
  const maxX = room.left + room.width - (pill.left + pill.width)
  const minY = room.top - pill.top
  const maxY = room.top + room.height - (pill.top + pill.height)
  return {
    x: Math.min(Math.max(dx, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(dy, Math.min(minY, maxY)), Math.max(minY, maxY)),
  }
}

/** The placement of a pill resting at `pill` in `area`. A pill with no room to move on an axis sits at that axis's far end. */
export function placementOf(pill: Box, area: Box): ZoomPillPlacement {
  const room = inner(area)
  const freeX = room.width - pill.width
  const freeY = room.height - pill.height
  return {
    x: freeX > 0 ? clamp01((pill.left - room.left) / freeX) : 1,
    y: freeY > 0 ? clamp01((pill.top - room.top) / freeY) : 1,
  }
}

/** The placement after moving a pill resting at `pill` by (dx, dy), clamped to `area`. */
export function nudgedPlacement(pill: Box, area: Box, dx: number, dy: number): ZoomPillPlacement {
  const by = clampOffset(pill, area, dx, dy)
  return placementOf({ ...pill, left: pill.left + by.x, top: pill.top + by.y }, area)
}

const CORNER_PLACEMENTS: Record<string, ZoomPillPlacement> = {
  'top-left': { x: 0, y: 0 },
  'top-right': { x: 1, y: 0 },
  'bottom-left': { x: 0, y: 1 },
  'bottom-right': { x: 1, y: 1 },
}

/** Reads a stored placement: "x,y" shares, or a corner name from before ticket 321 (the corner becomes its placement). */
export function parsePlacement(raw: unknown): ZoomPillPlacement | undefined {
  if (typeof raw !== 'string') return undefined
  const corner = CORNER_PLACEMENTS[raw]
  if (corner) return { ...corner }
  const [x, y, ...rest] = raw.split(',')
  if (x === undefined || y === undefined || rest.length) return undefined
  const placement = { x: Number(x), y: Number(y) }
  return x.trim() && y.trim() && Number.isFinite(placement.x) && Number.isFinite(placement.y) ? { x: clamp01(placement.x), y: clamp01(placement.y) } : undefined
}

export function formatPlacement({ x, y }: ZoomPillPlacement): string {
  return `${Number(x.toFixed(4))},${Number(y.toFixed(4))}`
}

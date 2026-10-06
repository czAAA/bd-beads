/** Where the phone's Zoom pill rests (ticket 297): one of the canvas box's four corners. */
export type ZoomPillCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export const DEFAULT_ZOOM_PILL_CORNER: ZoomPillCorner = 'bottom-right'

const ZOOM_PILL_CORNERS: readonly ZoomPillCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Moves `pill` by (dx, dy), but never past the edges of `area`: the pill stays fully inside it. */
export function clampOffset(pill: Box, area: Box, dx: number, dy: number): { x: number; y: number } {
  const minX = area.left - pill.left
  const maxX = area.left + area.width - (pill.left + pill.width)
  const minY = area.top - pill.top
  const maxY = area.top + area.height - (pill.top + pill.height)
  return {
    x: Math.min(Math.max(dx, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(dy, Math.min(minY, maxY)), Math.max(minY, maxY)),
  }
}

/** The corner of `area` nearest to the pill's centre. */
export function nearestCorner(pill: Box, area: Box): ZoomPillCorner {
  const cx = pill.left + pill.width / 2
  const cy = pill.top + pill.height / 2
  const right = cx > area.left + area.width / 2
  const bottom = cy > area.top + area.height / 2
  return `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`
}

export function isZoomPillCorner(value: unknown): value is ZoomPillCorner {
  return ZOOM_PILL_CORNERS.includes(value as ZoomPillCorner)
}

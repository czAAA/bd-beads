import { normalizeHex } from './color'

/** The four edges of the drawing area the Tool pill can dock to (ticket 439, ADR 0059). */
export const PILL_POSITIONS = ['left', 'top', 'right', 'bottom'] as const
/** One of the four edges the pill docks to. */
export type PillPosition = (typeof PILL_POSITIONS)[number]

/** Where the pill is until it is moved (ADR 0059). */
export const DEFAULT_PILL_POSITION: PillPosition = 'bottom'

/** Whether the pill runs top to bottom: docked left or right. */
export function isVerticalPill(position: PillPosition): boolean {
  return position === 'left' || position === 'right'
}

/** Recent colours kept on the device. */
export const RECENT_COLORS_KEPT = 8
/** Recents the pill shows beside the chosen colour. */
export const RECENTS_IN_PILL = 3

/** The recent colours with `hex` moved to the front (added when new), capped at what the device keeps. */
export function pushRecentColor(recents: readonly string[], hex: string): string[] {
  const color = normalizeHex(hex)
  if (!color) return [...recents]
  return [color, ...recents.filter((recent) => recent !== color)].slice(0, RECENT_COLORS_KEPT)
}

/** The recents to show beside the chosen colour: the colours used before it, at most `count`. */
export function recentsBeside(recents: readonly string[], chosen: string | null | undefined, count: number): string[] {
  const current = chosen ? normalizeHex(chosen) : undefined
  return recents.filter((recent) => recent !== current).slice(0, count)
}

/** A rectangle in screen pixels. */
export interface PillRect {
  left: number
  top: number
  width: number
  height: number
}

/** The edge of `area` nearest to `point`: where a dragged pill snaps on release. */
export function nearestPillEdge(point: { x: number; y: number }, area: PillRect): PillPosition {
  const distances: Record<PillPosition, number> = {
    left: point.x - area.left,
    right: area.left + area.width - point.x,
    top: point.y - area.top,
    bottom: area.top + area.height - point.y,
  }
  return PILL_POSITIONS.reduce((best, edge) => (distances[edge] < distances[best] ? edge : best), DEFAULT_PILL_POSITION)
}

/** The position an arrow key sends the pill to, or undefined for any other key. */
export function pillPositionForKey(key: string): PillPosition | undefined {
  return key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : key === 'ArrowUp' ? 'top' : key === 'ArrowDown' ? 'bottom' : undefined
}

/** Where the colour popover goes (ticket 439; ToolPill card): beside the pill toward the canvas, `gap` away, clamped
 * `edge` in. */
export function popoverPlacement(
  tile: PillRect,
  pill: PillRect,
  size: { width: number; height: number },
  position: PillPosition,
  screen: { width: number; height: number },
  gap: number,
  edge: number,
): { left: number; top: number } {
  const onScreen = (value: number, extent: number, limit: number) => Math.max(edge, Math.min(value, limit - extent - edge))
  const centredX = tile.left + tile.width / 2 - size.width / 2
  const centredY = tile.top + tile.height / 2 - size.height / 2
  switch (position) {
    case 'bottom':
      return { left: onScreen(centredX, size.width, screen.width), top: onScreen(pill.top - gap - size.height, size.height, screen.height) }
    case 'top':
      return { left: onScreen(centredX, size.width, screen.width), top: onScreen(pill.top + pill.height + gap, size.height, screen.height) }
    case 'left':
      return { left: pill.left + pill.width + gap, top: onScreen(centredY, size.height, screen.height) }
    case 'right':
      return { left: pill.left - gap - size.width, top: onScreen(centredY, size.height, screen.height) }
  }
}

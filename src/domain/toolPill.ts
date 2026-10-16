import { normalizeHex } from './palette'

/** The four edges of the drawing area the Tool pill can dock to (ticket 439, ADR 0059). */
export const PILL_POSITIONS = ['left', 'top', 'right', 'bottom'] as const
export type PillPosition = (typeof PILL_POSITIONS)[number]

export const DEFAULT_PILL_POSITION: PillPosition = 'bottom'

/** Whether the pill runs top to bottom: docked left or right. */
export function isVerticalPill(position: PillPosition): boolean {
  return position === 'left' || position === 'right'
}

/** What the pill's colour control shows: the chosen colour alone, or it with the recent colours beside it (ticket 439). */
export const PILL_COLOR_MODES = ['one', 'recent'] as const
export type PillColorMode = (typeof PILL_COLOR_MODES)[number]

/** How many recent colours the device keeps, and how many the pill and the popover show beside the chosen one. */
export const RECENT_COLORS_KEPT = 8
export const RECENTS_IN_PILL = 3
export const RECENTS_IN_POPOVER = 6

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
  return PILL_POSITIONS.reduce((best, edge) => (distances[edge] < distances[best] ? edge : best), 'bottom' as PillPosition)
}

/** The position an arrow key sends the pill to, or undefined for any other key. */
export function pillPositionForKey(key: string): PillPosition | undefined {
  return key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : key === 'ArrowUp' ? 'top' : key === 'ArrowDown' ? 'bottom' : undefined
}

/**
 * Where the colour popover goes (ticket 439; ToolPill card): beside the pill toward the canvas, `gap` away from it,
 * centred on the tile that opened it, then clamped `edge` inside the screen. It never sits under the pill.
 */
export function popoverPlacement(
  tile: PillRect,
  pill: PillRect,
  size: { width: number; height: number },
  position: PillPosition,
  screen: { width: number; height: number },
  gap: number,
  edge: number,
): { left: number; top: number } {
  const clamp = (value: number, extent: number, limit: number) => Math.max(edge, Math.min(value, limit - extent - edge))
  const centredX = tile.left + tile.width / 2 - size.width / 2
  const centredY = tile.top + tile.height / 2 - size.height / 2
  switch (position) {
    case 'bottom':
      return { left: clamp(centredX, size.width, screen.width), top: pill.top - gap - size.height }
    case 'top':
      return { left: clamp(centredX, size.width, screen.width), top: pill.top + pill.height + gap }
    case 'left':
      return { left: pill.left + pill.width + gap, top: clamp(centredY, size.height, screen.height) }
    case 'right':
      return { left: pill.left - gap - size.width, top: clamp(centredY, size.height, screen.height) }
  }
}

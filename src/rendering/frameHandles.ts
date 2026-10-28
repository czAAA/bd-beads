import type { Rect } from '../domain/canvas'
import type { FrameEdge } from '../domain/frame'
import type { Rotation } from '../domain/grid'
import type { SurfaceView } from './surfaceView'

// The handles a Frame carries while being set (Frame card): eight with a mouse or pen (9px squares), four corners on
// touch (16px), named by where they stand on screen; what one drags is the Frame's own edge, which a turned view carries
// to another side. The Frame's sit in a gutter just outside its edge (ADR 0066); a Selection's straddle its own.
export type HandleId = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'

export interface Handle {
  id: HandleId
  /** The centre, and the side of the square. */
  x: number
  y: number
  size: number
}

/** @internal Tests find a handle by its size. */
export const HANDLE_PX = 9
/** @internal Tests find a touch handle by its size. */
export const TOUCH_HANDLE_PX = 16

const ALL: readonly HandleId[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left']
const CORNERS: readonly HandleId[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

/** The handles round a rectangle on screen (the Frame's line, not its beads), the eight or, for touch, the four
 * corners. */
export function frameHandles(box: { x: number; y: number; width: number; height: number }, touch: boolean): Handle[] {
  const size = touch ? TOUCH_HANDLE_PX : HANDLE_PX
  const left = box.x
  const centreX = box.x + box.width / 2
  const right = box.x + box.width
  const top = box.y
  const centreY = box.y + box.height / 2
  const bottom = box.y + box.height
  const places: Record<HandleId, [number, number]> = {
    'top-left': [left, top],
    top: [centreX, top],
    'top-right': [right, top],
    right: [right, centreY],
    'bottom-right': [right, bottom],
    bottom: [centreX, bottom],
    'bottom-left': [left, bottom],
    left: [left, centreY],
  }
  return (touch ? CORNERS : ALL).map((id) => ({ id, x: places[id][0], y: places[id][1], size }))
}

/** The air between the Frame's edge and a gutter handle's square, in screen px. */
const GUTTER_GAP_PX = 3

/** The Frame's handles in its gutter (ADR 0066): `frameHandles` each moved out from the edge by half its square and a
 * gap, in screen px at every zoom. A handle with no room outside, the canvas box's edge being in the way, flips to the
 * inside of the edge on that axis. */
export function gutterHandles(box: { x: number; y: number; width: number; height: number }, touch: boolean, viewport: { width: number; height: number }): Handle[] {
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const away = (value: number, middle: number, limit: number, size: number): number => {
    if (value === middle) return value
    const offset = size / 2 + GUTTER_GAP_PX
    const outward = value < middle ? value - offset : value + offset
    // A viewport not measured yet (0 by 0) has no edge to run into.
    const fits = !(limit > 0) || (outward - size / 2 >= 0 && outward + size / 2 <= limit)
    return fits ? outward : value < middle ? value + offset : value - offset
  }
  return frameHandles(box, touch).map((handle) => ({
    ...handle,
    x: away(handle.x, centre.x, viewport.width, handle.size),
    y: away(handle.y, centre.y, viewport.height, handle.size),
  }))
}

/** How far from a handle's centre a press still grabs it (ticket 414): the visible squares stay small, the target
 * does not. */
const HIT_RADIUS_PX = 14
const TOUCH_HIT_RADIUS_PX = 24

/** The reach of a handle on a rectangle: 14px for a mouse or pen, 24px for touch, never more than a third of the
 * shorter side so a small rectangle keeps an inside to move.
 * @internal Tests check a handle's reach on its own. */
export function hitRadius(box: { width: number; height: number }, touch: boolean): number {
  return Math.min(touch ? TOUCH_HIT_RADIUS_PX : HIT_RADIUS_PX, Math.min(box.width, box.height) / 3)
}

/** The handle a press grabs, if any: the nearest within `radius`, except that a corner in reach beats a nearer edge
 * handle.
 * @internal Tests check which handle a press grabs on its own. */
export function handleAt(handles: readonly Handle[], point: { x: number; y: number }, radius: number): Handle | undefined {
  const reached = handles
    .map((handle) => ({ handle, distance: Math.hypot(point.x - handle.x, point.y - handle.y) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
  return (reached.find(({ handle }) => CORNERS.includes(handle.id)) ?? reached[0])?.handle
}

/** The side of the displayed rectangle a handle sits on, as the side of the Frame it drags once the picture is
 * turned a quarter at a time. */
const GRID_SIDE: Record<Rotation, Record<'top' | 'bottom' | 'left' | 'right', FrameEdge>> = {
  0: { top: 'top', bottom: 'bottom', left: 'left', right: 'right' },
  90: { top: 'left', right: 'top', bottom: 'right', left: 'bottom' },
  180: { top: 'bottom', bottom: 'top', left: 'right', right: 'left' },
  270: { top: 'right', right: 'bottom', bottom: 'left', left: 'top' },
}

/** The edges of the Frame, in grid space, that dragging a handle moves: one for a side's handle, two for a corner's.
 * @internal Tests check which edges a handle moves, in every rotation. */
export function handleEdges(rotation: Rotation, id: HandleId): FrameEdge[] {
  const sides = id.split('-') as ('top' | 'bottom' | 'left' | 'right')[]
  return sides.map((side) => GRID_SIDE[rotation][side])
}

/** What a press grabbed: one of the Frame's handles (with the edges it drags), its Move handle (ticket 452), its
 * inside, or the Canvas. */
export type FramePress = { kind: 'handle'; edges: FrameEdge[] } | { kind: 'move' } | { kind: 'inside' } | { kind: 'outside' }

/** What a press at a point of the viewport grabs of a rectangle on screen, given its handles: a handle first, then its
 * inside, then the canvas round it. */
export function boxPressAt(box: { x: number; y: number; width: number; height: number }, rotation: Rotation, point: { x: number; y: number }, touch: boolean, handles: readonly Handle[] = frameHandles(box, touch)): FramePress {
  const handle = handleAt(handles, point, hitRadius(box, touch))
  if (handle) {
    return { kind: 'handle', edges: handleEdges(rotation, handle.id) }
  }
  return { kind: pointInBox(box, point) ? 'inside' : 'outside' }
}

/** Whether a point of the viewport lies within a rectangle on screen. */
export function pointInBox(box: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }): boolean {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
}

/** The handle of the Frame a point is within reach of (ticket 414), for the resize cursor a hover shows. */
export function frameHandleIdAt(frame: Rect | undefined, surface: Pick<SurfaceView, 'frameBox' | 'viewport'>, point: { x: number; y: number }, touch: boolean): HandleId | undefined {
  if (!frame) return undefined
  const box = surface.frameBox(frame)
  return handleAt(gutterHandles(box, touch, surface.viewport), point, hitRadius(box, touch))?.id
}

/** The handle of a Selection a point is within reach of (ticket 414), for the resize cursor a hover shows. */
export function handleIdAt(box: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }, touch: boolean): HandleId | undefined {
  return handleAt(frameHandles(box, touch), point, hitRadius(box, touch))?.id
}

/** The cursor that shows a handle is resizable: the diagonal pairs for corners, the straight arrows for sides. */
export const HANDLE_CURSORS: Record<HandleId, string> = {
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  top: 'ns-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
}

/** What a press at a point of the viewport grabs of the Frame: a handle in its gutter first, which wins over whatever
 * lies under it. */
export function framePressAt(frame: Rect | undefined, surface: Pick<SurfaceView, 'frameBox' | 'viewport'>, rotation: Rotation, point: { x: number; y: number }, touch: boolean): FramePress {
  if (!frame) return { kind: 'outside' }
  const box = surface.frameBox(frame)
  return boxPressAt(box, rotation, point, touch, gutterHandles(box, touch, surface.viewport))
}

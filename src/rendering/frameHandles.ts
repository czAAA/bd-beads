import type { Frame } from '../domain/canvas'
import type { FrameEdge } from '../domain/frame'
import type { Rotation } from '../domain/grid'
import type { SurfaceView } from './surfaceView'

/**
 * The handles a Frame carries while it is being set (Frame card): eight round it with a mouse or pen (9px squares), four
 * at the corners on touch (16px). A handle is named by where it stands on screen; what it drags is the Frame's own edge,
 * which a legacy turned view carries to another side.
 */
export type HandleId = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'

export interface Handle {
  id: HandleId
  /** The centre, and the side of the square. */
  x: number
  y: number
  size: number
}

export const HANDLE_PX = 9
export const TOUCH_HANDLE_PX = 16

const ALL: readonly HandleId[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left']
const CORNERS: readonly HandleId[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

/** The handles round a rectangle on screen (the Frame's line, not its beads), the eight or, for touch, the four corners. */
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

/** How far from a handle's centre a press still grabs it (ticket 414): the visible squares stay small, the target does not. */
const HIT_RADIUS_PX = 14
const TOUCH_HIT_RADIUS_PX = 24

/** The reach of a handle on a rectangle: 14px for a mouse or pen, 24px for touch, never more than a third of the shorter side so a small rectangle keeps an inside to move. */
export function hitRadius(box: { width: number; height: number }, touch: boolean): number {
  return Math.min(touch ? TOUCH_HIT_RADIUS_PX : HIT_RADIUS_PX, Math.min(box.width, box.height) / 3)
}

/**
 * The handle a press at a point grabs, if any: the nearest within `radius` of its centre, except that a corner within
 * reach beats an edge handle that is nearer. A press inside the rectangle near a corner is therefore that corner's.
 */
export function handleAt(handles: readonly Handle[], point: { x: number; y: number }, radius: number): Handle | undefined {
  const reached = handles
    .map((handle) => ({ handle, distance: Math.hypot(point.x - handle.x, point.y - handle.y) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
  return (reached.find(({ handle }) => CORNERS.includes(handle.id)) ?? reached[0])?.handle
}

/** The side of the displayed rectangle a handle sits on, as the side of the Frame it drags once the picture is turned a quarter at a time. */
const GRID_SIDE: Record<Rotation, Record<'top' | 'bottom' | 'left' | 'right', FrameEdge>> = {
  0: { top: 'top', bottom: 'bottom', left: 'left', right: 'right' },
  90: { top: 'left', right: 'top', bottom: 'right', left: 'bottom' },
  180: { top: 'bottom', bottom: 'top', left: 'right', right: 'left' },
  270: { top: 'right', right: 'bottom', bottom: 'left', left: 'top' },
}

/** The edges of the Frame, in grid space, that dragging a handle moves: one for a side's handle, two for a corner's. */
export function handleEdges(rotation: Rotation, id: HandleId): FrameEdge[] {
  const sides = id.split('-') as ('top' | 'bottom' | 'left' | 'right')[]
  return sides.map((side) => GRID_SIDE[rotation][side])
}

/** What a press while setting the Frame grabbed: one of its handles (with the edges it drags), its inside, or the open canvas. */
export type FramePress = { kind: 'handle'; edges: FrameEdge[] } | { kind: 'inside' } | { kind: 'outside' }

/** What a press at a point of the viewport grabs of a rectangle on screen: a handle first, then its inside, then the canvas round it. */
export function boxPressAt(box: { x: number; y: number; width: number; height: number }, rotation: Rotation, point: { x: number; y: number }, touch: boolean): FramePress {
  const handle = handleAt(frameHandles(box, touch), point, hitRadius(box, touch))
  if (handle) {
    return { kind: 'handle', edges: handleEdges(rotation, handle.id) }
  }
  const inside = point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
  return { kind: inside ? 'inside' : 'outside' }
}

/** The handle a point is within reach of (ticket 414), for the resize cursor a hover shows. */
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

/** What a press at a point of the viewport grabs of the Frame. */
export function framePressAt(frame: Frame | undefined, surface: Pick<SurfaceView, 'frameBox'>, rotation: Rotation, point: { x: number; y: number }, touch: boolean): FramePress {
  return frame ? boxPressAt(surface.frameBox(frame), rotation, point, touch) : { kind: 'outside' }
}

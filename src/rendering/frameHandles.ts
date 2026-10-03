import type { Frame } from '../domain/canvas'
import type { FrameEdge } from '../domain/frame'
import type { Rotation } from '../domain/grid'
import { boxOnScreen, FRAME_OUTSET_PX, type RulerView } from './rulers'

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

/** The handle under a point, if any: within its own square, or a little more where a finger is bigger than a pointer. */
export function handleAt(handles: readonly Handle[], point: { x: number; y: number }, slack = 3): Handle | undefined {
  return handles.find((handle) => Math.abs(point.x - handle.x) <= handle.size / 2 + slack && Math.abs(point.y - handle.y) <= handle.size / 2 + slack)
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

/** How the Frame is placed on screen: the same view the rulers are laid out in. */
export type FrameView = Pick<RulerView, 'technique' | 'rotation' | 'zoom' | 'scroll'>

/** The Frame's line on screen: its beads' rectangle with the line's outset, which is what the handles stand on. */
export function frameLineBox(frame: Frame, view: FrameView): { x: number; y: number; width: number; height: number } {
  const shown = boxOnScreen(frame, view)
  return { x: shown.x - FRAME_OUTSET_PX, y: shown.y - FRAME_OUTSET_PX, width: shown.width + FRAME_OUTSET_PX * 2, height: shown.height + FRAME_OUTSET_PX * 2 }
}

/** What a press at a point of the viewport grabs: a handle first, then the inside of the Frame, then the canvas round it. */
export function framePressAt(frame: Frame | undefined, view: FrameView, point: { x: number; y: number }, touch: boolean): FramePress {
  if (!frame) {
    return { kind: 'outside' }
  }
  const box = frameLineBox(frame, view)
  const handle = handleAt(frameHandles(box, touch), point)
  if (handle) {
    return { kind: 'handle', edges: handleEdges(view.rotation, handle.id) }
  }
  const inside = point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
  return { kind: inside ? 'inside' : 'outside' }
}

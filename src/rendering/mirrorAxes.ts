import axisCentreSvg from '../../docs/design/system/assets/Icons/axis-centre.svg?raw'
import axisLeftRightSvg from '../../docs/design/system/assets/Icons/axis-left-right.svg?raw'
import axisTopBottomSvg from '../../docs/design/system/assets/Icons/axis-top-bottom.svg?raw'
import { MIRROR_DIRECTIONS, type CanvasAxes, type MirrorAxis, type MirrorDirection, type RadialCentre } from '../domain/mirror'
import { describeWeave, type Weave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { beadStepPx, type SurfaceView } from './surfaceView'

// Mirror's Axes on the open Canvas (ticket 0704, spec 0702; MirrorPopover card): where an Axis's line lies in the
// Canvas's grid px, and the handle chip on it, a fixed size on screen like the Move handle; Radial's centre (ticket
// 0705) has a chip the same way. The surface draws the chips and asks them which one a press grabbed, from one list.

/** The chip's side on screen (`--mirror-handle`), at any zoom.
 * @internal Tests find a chip by its size. */
export const MIRROR_HANDLE_PX = 32
/** The icon inside the chip (`--mirror-handle-icon`). */
export const MIRROR_HANDLE_ICON_PX = 16
/** How far along its line from the view's edge a chip stands (`--mirror-handle-inset`): past the strip's and the
 * pill's reach at the corners, near enough to find. */
const MIRROR_HANDLE_INSET_PX = 56
/** The least room between the two chips (`--space-8`) when their lines would put them on one spot. */
const HANDLE_GAP_PX = 8
/** A finger's reach past the chip (the Frame handles' touch reach, frameHandles.ts). */
const TOUCH_HIT_RADIUS_PX = 24

/** A stroke of a chip's icon: one SVG path and the width it is stroked at, the icon's own unless the path sets one. */
export interface IconStroke {
  d: string
  width: number
}

/** The paths an icon's SVG holds, each with its stroke width (`axis-centre`'s dot is a short path stroked wider). */
function iconStrokes(svg: string): IconStroke[] {
  return [...svg.matchAll(/<path\b([^>]*)>/g)].map(([, attributes]) => ({
    d: / d="([^"]+)"/.exec(attributes)![1]!,
    width: Number(/stroke-width="([^"]+)"/.exec(attributes)?.[1] ?? AXIS_ICON_STROKE_PX),
  }))
}

/** The icons' own box and stroke, as the SVG files draw them. */
export const AXIS_ICON_BOX_PX = 24
const AXIS_ICON_STROKE_PX = 1.75

/** The chips' icons, the set's own `axis-left-right`, `axis-top-bottom` and `axis-centre` (never redrawn, DESIGN.md):
 * the paths each SVG holds, on its 24px box, for the overlay to stroke scaled to `MIRROR_HANDLE_ICON_PX`. */
export const AXIS_ICON_PATHS: Record<MirrorAxis, readonly IconStroke[]> = {
  leftRight: iconStrokes(axisLeftRightSvg),
  topBottom: iconStrokes(axisTopBottomSvg),
  radial: iconStrokes(axisCentreSvg),
}
/** How each direction's Axis lies in grid space: a Left–right Axis is a vertical line, so its place is an x and it
 * runs along y, a position apart being a bead's step across; Top–bottom the other way round. */
const LIE: Record<MirrorDirection, { place: 'x' | 'y'; along: { x: number; y: number }; step: 'across' | 'down' }> = {
  leftRight: { place: 'x', along: { x: 0, y: 1 }, step: 'across' },
  topBottom: { place: 'y', along: { x: 1, y: 0 }, step: 'down' },
}

/** Where position 0, 0's centre is and how far one position steps along a direction, in grid px. */
function lattice(weave: Weave, direction: MirrorDirection): { origin: number; step: number } {
  const cell = cellSizePx(weave.technique, weave.cell)
  const centre = describeWeave(weave).center({ row: 0, column: 0 }, cell.width, cell.height)
  const { place, step } = LIE[direction]
  return { origin: centre[place], step: beadStepPx(weave)[step] }
}

/** The grid px coordinate an Axis's line lies on: through position `at`'s centre at a whole number, its boundary with
 * the next at a half. */
export function axisGridPx(weave: Weave, direction: MirrorDirection, at: number): number {
  const { origin, step } = lattice(weave, direction)
  return origin + at * step
}

/** The Axis position, unsnapped, whose line would lie on a grid px coordinate: what a dragged handle is read as. */
export function axisAtGridPx(weave: Weave, direction: MirrorDirection, px: number): number {
  const { origin, step } = lattice(weave, direction)
  return (px - origin) / step
}

/** A handle chip on screen: its Axis (`radial` is the centre's chip), its centre in the viewport and its side. */
export interface AxisHandle {
  axis: MirrorAxis
  x: number
  y: number
  size: number
}

/** The grid px point Radial's centre is at: on the lattice the straight Axes lie on, both ways. */
export function centreGridPx(weave: Weave, centre: RadialCentre): { x: number; y: number } {
  return { x: axisGridPx(weave, 'leftRight', centre.column), y: axisGridPx(weave, 'topBottom', centre.row) }
}

/** The stretch of a line `point + t × direction` inside a box from the origin, as its two parameters, or none when it
 * misses the box. */
function stretchInBox(point: { x: number; y: number }, direction: { x: number; y: number }, box: { width: number; height: number }): [number, number] | undefined {
  let from = -Infinity
  let to = Infinity
  for (const [p, d, size] of [[point.x, direction.x, box.width], [point.y, direction.y, box.height]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < 0 || p > size) return undefined
      continue
    }
    const [near, far] = [-p / d, (size - p) / d].sort((a, b) => a - b) as [number, number]
    from = Math.max(from, near)
    to = Math.min(to, far)
  }
  return from <= to ? [from, to] : undefined
}

/** Whether two chips would stand on one spot: closer than a chip and the gap between them, either way. */
function sharesSpot(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const apart = MIRROR_HANDLE_PX + HANDLE_GAP_PX
  return Math.abs(a.x - b.x) < apart && Math.abs(a.y - b.y) < apart
}

/** The chips of the Canvas Axes in view: the centre's on the centre itself (ticket 0705); a straight Axis's on its
 * line, `MIRROR_HANDLE_INSET_PX` along it from the edge of the viewport the line enters at (the grid's top or left), or
 * at its middle when it is shorter than twice that, the Top–bottom chip stepping off the Left–right one. Out of view: none. */
export function axisHandles(axes: CanvasAxes, weave: Weave, surface: Pick<SurfaceView, 'gridToPoint' | 'gridDirection' | 'viewport'>): AxisHandle[] {
  const handles: AxisHandle[] = []
  if (axes.centre) {
    const { x, y } = centreGridPx(weave, axes.centre)
    const point = surface.gridToPoint(x, y)
    if (point.x >= 0 && point.x <= surface.viewport.width && point.y >= 0 && point.y <= surface.viewport.height) {
      handles.push({ axis: 'radial', x: point.x, y: point.y, size: MIRROR_HANDLE_PX })
    }
  }
  for (const direction of MIRROR_DIRECTIONS) {
    const at = axes[direction]
    if (at === undefined) continue
    const px = axisGridPx(weave, direction, at)
    const lie = LIE[direction]
    const point = lie.place === 'x' ? surface.gridToPoint(px, 0) : surface.gridToPoint(0, px)
    const along = surface.gridDirection(lie.along.x, lie.along.y)
    const length = Math.hypot(along.x, along.y)
    const unit = { x: along.x / length, y: along.y / length }
    const stretch = stretchInBox(point, unit, surface.viewport)
    if (!stretch) continue
    const [from, to] = stretch
    let t = to - from < 2 * MIRROR_HANDLE_INSET_PX ? (from + to) / 2 : from + MIRROR_HANDLE_INSET_PX
    const chip = (): AxisHandle => ({ axis: direction, x: point.x + t * unit.x, y: point.y + t * unit.y, size: MIRROR_HANDLE_PX })
    let placed = chip()
    while (handles.some((other) => sharesSpot(other, placed)) && t + MIRROR_HANDLE_PX + HANDLE_GAP_PX <= to) {
      t += MIRROR_HANDLE_PX + HANDLE_GAP_PX
      placed = chip()
    }
    handles.push(placed)
  }
  return handles
}

/** The chip a press at a point of the viewport grabs: within its own half side for a mouse or pen, a finger's reach
 * for touch; the nearest when two are in reach. */
export function axisHandleAt(handles: readonly AxisHandle[], point: { x: number; y: number }, touch: boolean): AxisHandle | undefined {
  const reach = touch ? TOUCH_HIT_RADIUS_PX : MIRROR_HANDLE_PX / 2
  return handles
    .map((handle) => ({ handle, distance: Math.hypot(point.x - handle.x, point.y - handle.y) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance)[0]?.handle
}

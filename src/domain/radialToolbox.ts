import type { Tool } from './tool'

// The Radial toolbox's rule (spec 1072, ADR 0098; RadialToolbox card): the ten items' places on the ring and which
// item a point picks. Angles are degrees clockwise from straight up; sizes come in as numbers, in the caller's px.

/** An item's place on the ring: the angle of its tile's centre and how wide its slice is. A tool names its Tool, a
 * recent colour its place among the Tool pill's recents; the id is the control registry's where the item has one. */
interface RadialPlace {
  id: string
  angle: number
  slice: number
  tool?: Tool
  recent?: number
}

/** The ten items, clockwise from the top left: the colours over the top and the tools under, both left to right in
 * the Tool pill's order, Redo at the right and Undo at the left. The one list the component and the tests read. */
export const RADIAL_PLACES = [
  { id: 'pick-color', angle: 309, slice: 34 },
  { id: 'recent-1', angle: 343, slice: 34, recent: 0 },
  { id: 'recent-2', angle: 17, slice: 34, recent: 1 },
  { id: 'recent-3', angle: 51, slice: 34, recent: 2 },
  { id: 'redo', angle: 90, slice: 44 },
  { id: 'tool-erase', angle: 129, slice: 34, tool: 'erase' },
  { id: 'tool-select', angle: 163, slice: 34, tool: 'select' },
  { id: 'tool-fill', angle: 197, slice: 34, tool: 'fill' },
  { id: 'tool-paint', angle: 231, slice: 34, tool: 'paint' },
  { id: 'undo', angle: 270, slice: 44 },
] as const satisfies readonly RadialPlace[]

/** One of the ring's ten items. */
export type RadialItemId = (typeof RADIAL_PLACES)[number]['id']

/** Where the dividers stand, parting the colours, Redo, the tools and Undo. */
export const RADIAL_DIVIDERS: readonly number[] = [68, 112, 248, 292]

/** The ring in the design system's px: `radial-radius`, from the centre to the tiles' centres, and its band,
 * `pill-thickness` across. A test keeps both equal to the tokens. */
export const RADIAL_RING = { radius: 84, band: 48 } as const
/** The ring's hole and its outer edge, from the centre, in the design system's px. */
export const RADIAL_HOLE = RADIAL_RING.radius - RADIAL_RING.band / 2
export const RADIAL_REACH = RADIAL_RING.radius + RADIAL_RING.band / 2

const FULL_TURN = 360
const inTurn = (angle: number) => ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN
const toRadians = (angle: number) => (angle * Math.PI) / 180

/** Where a point at `angle` and `distance` from the ring's centre is, x to the right and y down as on screen. */
function pointAt(angle: number, distance: number): { x: number; y: number } {
  return { x: distance * Math.sin(toRadians(angle)), y: -distance * Math.cos(toRadians(angle)) }
}

/** The item a point picks: the one whose slice it is in, by direction alone, however far out; none inside the hole.
 * The point is measured from the ring's centre (x right, y down) and `hole` is the hole's radius, in the same px. A
 * slice takes its first edge and leaves its last to the next, so no point belongs to two items. */
export function radialItemAt(point: { x: number; y: number }, hole: number): RadialItemId | undefined {
  if (Math.hypot(point.x, point.y) < hole) return undefined
  const angle = inTurn((Math.atan2(point.x, -point.y) * 180) / Math.PI)
  return RADIAL_PLACES.find((place) => inTurn(angle - (place.angle - place.slice / 2)) < place.slice)?.id
}

/** What decides which items are off: the Undo list, the Tool pill's recent colours and the pressed bead's colour. */
export interface RadialItemsState {
  canUndo: boolean
  canRedo: boolean
  recents: readonly string[]
  beadHex?: string | null
}

/** Whether an item is off (RadialToolbox card, States): Undo and Redo with nothing to undo or redo, a recent colour
 * that does not exist yet, Pick color from Canvas with no bead pressed. A tool is never off. */
export function radialItemOff(id: RadialItemId, state: RadialItemsState): boolean {
  const place: RadialPlace = RADIAL_PLACES.find((each) => each.id === id)!
  if (place.recent !== undefined) return !state.recents[place.recent]
  return id === 'undo' ? !state.canUndo : id === 'redo' ? !state.canRedo : id === 'pick-color' ? !state.beadHex : false
}

/** How many straight steps stand for a slice's arc: at the ring's size they stay within a tenth of a px of it. */
const ARC_STEPS = 8

/** An item's slice of the band as a closed outline, for its hit area: from `inner` to `outer` out from the centre,
 * along the outer arc and back along the inner one, as points from the centre in the caller's px. */
export function radialSliceOutline(id: RadialItemId, inner: number, outer: number): { x: number; y: number }[] {
  const place = RADIAL_PLACES.find((each) => each.id === id)!
  const angles = Array.from({ length: ARC_STEPS + 1 }, (_, step) => place.angle - place.slice / 2 + (place.slice * step) / ARC_STEPS)
  return [...angles.map((angle) => pointAt(angle, outer)), ...angles.reverse().map((angle) => pointAt(angle, inner))]
}

/** The room the ring's centre keeps from the screen (ticket 1076, RadialToolbox card's Edges), in the design system's
 * px: its reach and `float-edge` at the sides and the bottom, and 8 and the name's 30 more at the top. */
const RADIAL_EDGE = 12
const RADIAL_NAME_ROOM = 8 + 30
export const RADIAL_ROOM = { side: RADIAL_REACH + RADIAL_EDGE, top: RADIAL_REACH + RADIAL_EDGE + RADIAL_NAME_ROOM, edge: RADIAL_EDGE } as const

/** A place as near `wanted` as `from` and `to` allow; the middle of a span too short to hold both. */
function keptWithin(wanted: number, from: number, to: number): number {
  return from > to ? (from + to) / 2 : Math.min(Math.max(wanted, from), to)
}

/** Where the ring goes (spec 1072, ADR 0098): the centre nearest the pressed point that keeps the whole ring and its
 * name on the screen, so it moves by the least and only for the screen. `room` is how far the centre stays from the
 * sides and the bottom and from the top (`RADIAL_ROOM`), in the px of `pressed` and `screen`. */
export function radialCenterOnScreen(
  pressed: { x: number; y: number },
  screen: { width: number; height: number },
  room: { side: number; top: number },
): { x: number; y: number } {
  return { x: keptWithin(pressed.x, room.side, screen.width - room.side), y: keptWithin(pressed.y, room.top, screen.height - room.side) }
}

/** Where the name's middle goes along the screen (ticket 1076): over the ring's centre, moved by the least that keeps
 * a name `width` wide `edge` inside the screen at each side. All in one px. */
export function radialNameCenter(center: number, width: number, screenWidth: number, edge: number): number {
  return keptWithin(center, edge + width / 2, screenWidth - edge - width / 2)
}

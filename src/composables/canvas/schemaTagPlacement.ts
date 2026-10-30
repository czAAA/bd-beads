import type { Rect } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import type { BarBox } from '../tools/selectionBarPlacement'

// Where an unframed Schema's hang tag and its paper tag sit on the canvas box (SchemaTag card, ticket 0721), in screen
// px at every zoom. The numbers are the card's: `--schema-tag-drop` and the 9px across, the tag's hole in its cut end,
// the paper tag's width and its hole 18px in from its top-right corner.
const DROP_X = 9
const DROP_Y = 24
const TAG_HOLE_INSET = 4.5
const TAG_HALF_HEIGHT = 11
const CARD_WIDTH = 236
const CARD_HOLE_INSET = 18
/** The room kept between the paper tag and the canvas box's edge. */
const EDGE_GAP = 8

/** An unframed Schema as its tag needs it: its name, the bead the name is kept on, its rectangle in beads and its box
 * on the canvas box (the Piece outset included). */
export interface SchemaAnchor {
  name: string
  anchor: GridPosition
  piece: Rect
  box: BarBox
}

/** The unframed Schemas the surface shows, and how big the canvas box is: what the tags are placed in. */
export interface SchemaAnchors {
  schemas: SchemaAnchor[]
  viewport: { width: number; height: number }
}

export interface Point {
  x: number
  y: number
}

/** A tag's place: the Piece corner its thread starts from (the dot), the tag's hole and which side it hangs on. */
export interface TagPlacement {
  side: 'right' | 'left'
  corner: Point
  hole: Point
}

/** Where the tag hangs from `box` (the Piece's rectangle on screen, outset included): from its bottom-right corner, or
 * its bottom-left one where a tag `width` px wide would cross the box's right edge. None while that corner is out of
 * view. */
export function tagPlacement(box: BarBox, viewport: { width: number; height: number }, width: number): TagPlacement | undefined {
  const bottom = box.top + box.height
  const right = box.left + box.width
  const side = right + DROP_X - TAG_HOLE_INSET + width > viewport.width ? 'left' : 'right'
  const corner = { x: side === 'right' ? right : box.left, y: bottom }
  if (corner.x < 0 || corner.y < 0 || corner.x > viewport.width || corner.y > viewport.height) return undefined
  return { side, corner, hole: { x: corner.x + (side === 'right' ? DROP_X : -DROP_X), y: corner.y + DROP_Y } }
}

/** Where a tag's box goes for its hole to be at `hole`: the box's top-left corner. */
export function tagOrigin(hole: Point): { left: number; top: number } {
  return { left: hole.x - TAG_HOLE_INSET, top: hole.y - TAG_HALF_HEIGHT }
}

/** The paper tag's place: its top-left corner and its hole, and whether it opened above the Piece. */
export interface CardPlacement {
  above: boolean
  left: number
  top: number
  hole: Point
}

/** Where the paper tag `height` px tall opens: in the tag's place below the Piece, hanging by its hole, or above the
 * Piece where there is no room below; kept inside the canvas box, the hole moving with it. */
export function cardPlacement(tag: TagPlacement, box: BarBox, viewport: { width: number; height: number }, height: number): CardPlacement {
  const clamp = (value: number, size: number, room: number) => Math.max(EDGE_GAP, Math.min(value, room - EDGE_GAP - size))
  const gap = DROP_Y - CARD_HOLE_INSET
  const below = tag.hole.y - CARD_HOLE_INSET
  const above = below + height > viewport.height - EDGE_GAP
  const left = clamp(tag.hole.x + CARD_HOLE_INSET - CARD_WIDTH, CARD_WIDTH, viewport.width)
  const top = clamp(above ? box.top - gap - height : below, height, viewport.height)
  return { above, left, top, hole: { x: left + CARD_WIDTH - CARD_HOLE_INSET, y: top + CARD_HOLE_INSET } }
}

/** The thread from the corner's dot to a hole, curving out to the side the tag hangs on: an SVG path. */
export function threadPath(from: Point, to: Point, side: TagPlacement['side']): string {
  const out = side === 'right' ? 1 : -1
  const bend = Math.sign(to.y - from.y) || 1
  return `M ${from.x} ${from.y} C ${from.x + out * 8} ${from.y + bend * 8}, ${to.x + out * 6} ${to.y - bend * 10}, ${to.x} ${to.y}`
}

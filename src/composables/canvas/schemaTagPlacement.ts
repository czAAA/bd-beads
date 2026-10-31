import type { Rect } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import type { BarBox } from '../tools/selectionBarPlacement'

// Where an unframed Schema's tag and its paper tag sit on the canvas box (SchemaTag card, tickets 0721 and 0733), in
// screen px at every zoom. The numbers are the card's: `--schema-tag-height`, `--schema-tag-gap`,
// `--schema-tag-max-width` and the paper tag's width.
const TAG_HEIGHT = 28
const TAG_GAP = 4
const TAG_MAX_WIDTH = 184
const CARD_WIDTH = 236
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
  /** How far the column numbers stand above a Piece's line, and a little more: the tags rise over it, with the Rulers on or off so they never jump. */
  lift?: number
}

/** A tag's top-left corner on the canvas box. */
export interface TagPlacement {
  left: number
  top: number
}

/** Where the tag stands for `box` (the Piece's rectangle on screen, outset included): always above its top-left
 * corner, `lift` px higher, clear of where the Rulers' numbers stand, moving with the Piece and clipped by the canvas box as
 * the Piece is. None while neither the Piece nor its tag is in view. */
export function tagPlacement(box: BarBox, viewport: { width: number; height: number }, lift = 0): TagPlacement | undefined {
  const top = box.top - lift - TAG_GAP - TAG_HEIGHT
  const right = box.left + Math.max(box.width, TAG_MAX_WIDTH)
  const bottom = box.top + box.height
  if (box.left >= viewport.width || right <= 0 || top >= viewport.height || bottom <= 0) return undefined
  return { left: box.left, top }
}

/** The paper tag's place: its top-left corner, and whether it opened upwards. */
export interface CardPlacement {
  above: boolean
  left: number
  top: number
}

/** Where the paper tag `height` px tall opens: in the tag's place, down over the Piece, or up from the tag's foot where
 * there is no room below; kept inside the canvas box. */
export function cardPlacement(tag: TagPlacement, viewport: { width: number; height: number }, height: number): CardPlacement {
  const clamp = (value: number, size: number, room: number) => Math.max(EDGE_GAP, Math.min(value, room - EDGE_GAP - size))
  const above = tag.top + height > viewport.height - EDGE_GAP
  const top = above ? tag.top + TAG_HEIGHT - height : tag.top
  return { above, left: clamp(tag.left, CARD_WIDTH, viewport.width), top: clamp(top, height, viewport.height) }
}

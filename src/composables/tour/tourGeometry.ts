/** Where the Tour's card sits and how its pointer runs (ticket 80; TourStep card), as plain rectangles so none of it needs a screen. */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Size {
  w: number
  h: number
}

export type Side = 'right' | 'left' | 'above' | 'below'

export interface Placement {
  x: number
  y: number
  /** Which way the pointer leaves the card; none when the card is centred and points at nothing. */
  side?: Side
}

/** The viewport's margin the card keeps, and how far it stands from the control it points at. */
export const MARGIN = 12
export const GAP = 56
/** The phone's header, which the card docks under. */
export const PHONE_HEADER = 64
/** Below this width the card is docked under the header instead of placed beside its control. */
export const PHONE_MAX_WIDTH = 743
/** The hole is the control plus this much on every side. */
export const HOLE_PADDING = 5

export function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + by * 2, h: rect.h + by * 2 }
}

export function intersect(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.w, b.x + b.w)
  const bottom = Math.min(a.y + a.h, b.y + b.h)
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : undefined
}

export function overlaps(a: Rect, b: Rect): boolean {
  return intersect(a, b) !== undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * The card's place: docked under the header on a phone, centred when there is nothing to point at, otherwise beside the
 * hole on the side its position suggests (below a header control, above a bottom one, to the right of a left-column
 * control, clear of `beside` when the control sits in a column or a board whose whole width must stay visible), and
 * failing every side, in the corner under the header.
 */
export function placeCard(card: Size, hole: Rect | undefined, viewport: Size, beside?: Rect): Placement {
  if (viewport.w <= PHONE_MAX_WIDTH) {
    return { x: MARGIN, y: PHONE_HEADER + MARGIN, side: hole ? 'above' : undefined }
  }
  if (!hole) {
    return { x: (viewport.w - card.w) / 2, y: (viewport.h - card.h) / 2 }
  }

  const reach = beside ?? hole
  const centerY = hole.y + hole.h / 2
  const spots: Record<Side, Placement> = {
    right: { x: reach.x + reach.w + (beside ? 40 : GAP), y: clamp(centerY - card.h / 2 - 20, PHONE_HEADER + MARGIN, viewport.h - card.h - MARGIN), side: 'right' },
    left: { x: reach.x - (beside ? 40 : GAP) - card.w, y: clamp(centerY - card.h / 2 - 20, PHONE_HEADER + MARGIN, viewport.h - card.h - MARGIN), side: 'left' },
    below: { x: clamp(hole.x + hole.w / 2 - card.w / 2 - 40, MARGIN, viewport.w - card.w - MARGIN), y: hole.y + hole.h + GAP, side: 'below' },
    above: { x: clamp(hole.x + hole.w / 2 - card.w / 2 - 60, MARGIN, viewport.w - card.w - MARGIN), y: hole.y - GAP - card.h, side: 'above' },
  }

  const order: Side[] =
    hole.y + hole.h <= PHONE_HEADER + MARGIN * 2
      ? ['below', 'right', 'left']
      : hole.y + hole.h / 2 > viewport.h * 0.6
        ? ['above', 'right', 'left']
        : ['right', 'left', 'below', 'above']

  for (const side of order) {
    const spot = spots[side]
    const fits = spot.x >= MARGIN && spot.y >= MARGIN && spot.x + card.w <= viewport.w - MARGIN && spot.y + card.h <= viewport.h - MARGIN
    if (fits && !overlaps({ x: spot.x, y: spot.y, w: card.w, h: card.h }, hole)) {
      return spot
    }
  }

  return { x: viewport.w - card.w - MARGIN, y: PHONE_HEADER + MARGIN }
}

/** The dotted pointer from a card to its hole: the two ends and the control points of one curve. */
export interface Pointer {
  from: { x: number; y: number }
  to: { x: number; y: number }
  c1: { x: number; y: number }
  c2: { x: number; y: number }
}

/** How far short of the hole the pointer stops, for its end dot. */
const POINTER_STOP = 8

/** The curve from the card's nearest edge to the hole's, leaving the card straight out of that edge. */
export function pointerBetween(card: Rect, hole: Rect): Pointer {
  const cardCenter = { x: card.x + card.w / 2, y: card.y + card.h / 2 }
  const holeCenter = { x: hole.x + hole.w / 2, y: hole.y + hole.h / 2 }
  const dx = holeCenter.x - cardCenter.x
  const dy = holeCenter.y - cardCenter.y
  const reach = 30

  if (Math.abs(dx) * card.h >= Math.abs(dy) * card.w) {
    const right = dx > 0
    const from = { x: right ? card.x + card.w : card.x, y: clamp(holeCenter.y, card.y + 18, card.y + card.h - 18) }
    const to = { x: right ? hole.x - POINTER_STOP : hole.x + hole.w + POINTER_STOP, y: holeCenter.y }
    return { from, to, c1: { x: from.x + (right ? reach : -reach), y: from.y }, c2: { x: to.x + (right ? -reach : reach), y: to.y } }
  }

  const below = dy > 0
  const from = { x: clamp(holeCenter.x, card.x + 18, card.x + card.w - 18), y: below ? card.y + card.h : card.y }
  const to = { x: holeCenter.x, y: below ? hole.y - POINTER_STOP : hole.y + hole.h + POINTER_STOP }
  return { from, to, c1: { x: from.x, y: from.y + (below ? reach : -reach) }, c2: { x: to.x, y: to.y + (below ? -reach : reach) } }
}

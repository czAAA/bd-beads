import type { Insets } from '../domain/toolPill'
import type { Size } from './cellSize'
import { MARGIN_PX } from './marginSizes'

/** What the expanded Frame lies in (Calmer sheet 3; tickets 1194, 1259, 1260), screen px: the sides the rails, Row
 * progress and the Tool pill's place take (`chrome`), the same without that place (`round`), the numbers' thickness on
 * the left and top as seen (0 where none) and their size. `compact` is under bp-tablet. */
export interface ExpandedContent {
  compact: boolean
  chrome: Insets
  round: Insets
  numbers: { left: number; top: number }
  fontPx: number
}

/** The room round the expanded Frame's line: its numbers on the top and left as seen, else the inset. */
export function expandedSides({ compact, numbers }: Pick<ExpandedContent, 'compact' | 'numbers'>): Insets {
  const inset = MARGIN_PX.expanded.inset[compact ? 'compact' : 'full']
  const gap = MARGIN_PX.expanded.numbers
  return { top: numbers.top ? gap + numbers.top + gap : inset, left: numbers.left ? inset + numbers.left + gap : inset, right: inset, bottom: inset }
}

/** The bead pitch an expanded Frame's rows are woven at, where the whole Frame would be drawn smaller. */
export function expandedPitch(width: number): number {
  const { pitch, narrowAt } = MARGIN_PX.expanded
  return width > narrowAt ? pitch.wide : pitch.narrow
}

/** The expanded fit's zoom, from the zoom each axis alone fits at: the whole Frame where that is large enough, else
 * `comfort` with the rows running on along the longer way, never past what the other way holds (ticket 1260). */
export function expandedZoom({ across, down, comfort }: { across: number; down: number; comfort: number }): number {
  return Math.max(Math.min(across, down), Math.min(Math.max(across, down), comfort))
}

/** Narrower than this, the drawing area has no room for two rails beside the rows; narrower than `NARROW_PX` the band
 * parts in two. */
const RAILS_FROM_PX = 800
const NARROW_PX = 600

/** How the expanded sheet lies: two rails beside the rows, or, for a Frame wider for its height than the drawing area
 * (its rows would be squeezed between them) or an area too narrow for them, a band along the top. */
export function expandedLayout(frame: Size, area: Size): 'rails' | 'band' | 'narrow' {
  if (area.width < NARROW_PX) return 'narrow'
  const wide = frame.width * area.height > frame.height * area.width
  return wide || area.width < RAILS_FROM_PX ? 'band' : 'rails'
}

/** One axis of the expanded Frame on screen: where its beads start and how long they are, and the room it is seen in. */
export interface ExpandedAxis {
  start: number
  length: number
  room: { start: number; end: number }
}

/** Whether the Frame runs past its room along an axis, so there is something to scroll along. */
export function runsOn({ length, room }: ExpandedAxis): boolean {
  return length > room.end - room.start + 0.5
}

/** How far the Frame may be carried along an axis, of a move `by` on screen: no further than its ends reaching the
 * room's, and never jumping back where it already stands past one. */
export function carryAlong({ start, length, room }: ExpandedAxis, by: number): number {
  const least = Math.min(0, room.end - (start + length))
  const most = Math.max(0, room.start - start)
  return Math.max(least, Math.min(most, by))
}

/** Where along an axis (0 to 1) the room's middle should look, for the Frame to start at the room's start when
 * `fraction` is near it and to end at its end: the move on screen that gets it there. */
export function lookAlong(axis: ExpandedAxis, fraction: number): number {
  const middle = (axis.room.start + axis.room.end) / 2
  return carryAlong(axis, middle - (axis.start + fraction * axis.length))
}

/** The drawing area less the room round the Frame, never nothing. */
export function areaInside(viewport: Size, insets: Insets): Size {
  return { width: Math.max(1, viewport.width - insets.left - insets.right), height: Math.max(1, viewport.height - insets.top - insets.bottom) }
}

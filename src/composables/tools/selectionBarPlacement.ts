import { areaSheetOutset } from '../../rendering/frameHandles'
import type { TitleCorner } from '../../rendering/marginForm'

/** A rectangle in the canvas box's own pixels. */
export interface BarBox {
  left: number
  top: number
  width: number
  height: number
}

/** Where the Selection is on the canvas box, and how big that box is: what the bar anchors to (ticket 415). */
export interface SelectionAnchor {
  box: BarBox
  viewport: { width: number; height: number }
}

/** Where the Selection bar goes and which side of the Selection it is on. */
export interface BarPlacement {
  left: number
  top: number
  below: boolean
}

/** The gap kept between the bar and the Selection's edge, and between the bar and the canvas box's edge (ticket
 * 415). */
const BAR_GAP_PX = 6
export const BAR_EDGE_PX = 8
/** How far across the bar keeps over its Selection while the clamp holds it on screen (ticket 0779): past that it goes
 * out of view with the Selection. */
const BAR_STICK_PX = 24

/** Whether two boxes of the canvas box overlap: the Selection bar against the Tool pill. */
const boxesOverlap = (a: BarBox, b: BarBox) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

// Where the Selection bar sits (tickets 415, 0779): centred above the Selection, flipped below with no room above, held
// inside the canvas box only while it stays beside the Selection. The Tool pill (`obstacle`, ticket 439) acts as an edge
// while the bar is wholly in the box: it flips or slides clear the way it overlaps least (with `keepSide` only slides).
export function selectionBarPlacement(
  selection: BarBox,
  bar: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacle?: BarBox,
  { keepSide = false }: { keepSide?: boolean } = {},
): BarPlacement {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const onScreen = (value: number, size: number, limit: number) => clamp(value, BAR_EDGE_PX, limit - size - BAR_EDGE_PX)
  const stick = Math.min(BAR_STICK_PX, selection.width / 2)
  const above = selection.top - BAR_GAP_PX - bar.height
  const left = clamp(
    onScreen(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width),
    selection.left + stick - bar.width,
    selection.left + selection.width - stick,
  )
  const underneath = selection.top + selection.height + BAR_GAP_PX
  const below = above < BAR_EDGE_PX
  const at = (isBelow: boolean): BarPlacement => ({
    left,
    top: clamp(onScreen(isBelow ? underneath : above, bar.height, viewport.height), above, underneath),
    below: isBelow,
  })
  const preferred = at(below)
  const hits = (placement: BarPlacement) => !!obstacle && boxesOverlap({ ...placement, ...bar }, obstacle)
  // A bar going out of view with its Selection goes, under the pill if need be, rather than hop clear of it on screen.
  const leaving = preferred.left < 0 || preferred.top < 0 || preferred.left + bar.width > viewport.width || preferred.top + bar.height > viewport.height
  if (leaving || !hits(preferred)) return preferred
  const flipped = at(!below)
  if (!keepSide && !hits(flipped)) return flipped
  // Neither side is clear: slide the preferred spot off the pill, the shorter way, and keep it inside the box.
  const pill = obstacle!
  const slides: BarPlacement[] = [
    { ...preferred, left: onScreen(pill.left - BAR_GAP_PX - bar.width, bar.width, viewport.width) },
    { ...preferred, left: onScreen(pill.left + pill.width + BAR_GAP_PX, bar.width, viewport.width) },
    { ...preferred, top: onScreen(pill.top - BAR_GAP_PX - bar.height, bar.height, viewport.height) },
    { ...preferred, top: onScreen(pill.top + pill.height + BAR_GAP_PX, bar.height, viewport.height) },
  ]
  const clear = slides.filter((placement) => !hits(placement))
  const distance = (placement: BarPlacement) => Math.abs(placement.left - preferred.left) + Math.abs(placement.top - preferred.top)
  return clear.sort((a, b) => distance(a) - distance(b))[0] ?? preferred
}

/** The two areas that wear an Area sheet with their bar docked in it (ContextBar card, ticket 0808). */
export type DockedArea = 'selection' | 'mirror'

/** Where a docked bar is in its sheet's top band and how wide it is: as wide as the band unless its own width is more. */
export interface DockedPlacement {
  left: number
  top: number
  /** The least the bar is wide: the band's width less its insets, as much of it as is in the canvas box; none where
   * the bar is wider than the band and keeps its own width. */
  minWidth?: number
}

/** How far in from the band's left and right edges, and down from its top, the docked bar sits (ContextBar card). */
const DOCK_INSET_PX = 8
const DOCK_TOP_PX = 6

/** A docked bar (ContextBar card, Area sheet, ticket 0808): in the top band, 8px in and 6px down, as wide as the part of
 * the band in the canvas box. A bar wider than the band keeps its width, centred on it, held on screen only while it
 * still sits over the area (ticket 0779); one narrower slides along the band to stay in view, never out of it. */
export function dockedBarPlacement(
  area: BarBox,
  bar: { width: number },
  viewport: { width: number },
  outset: { top: number; right: number; left: number },
): DockedPlacement {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const onScreen = (left: number, width: number) => clamp(left, BAR_EDGE_PX, viewport.width - width - BAR_EDGE_PX)
  const start = area.left - outset.left + DOCK_INSET_PX
  const end = area.left + area.width + outset.right - DOCK_INSET_PX
  const top = area.top - outset.top + DOCK_TOP_PX
  if (bar.width > end - start + 0.5) {
    const stick = Math.min(BAR_STICK_PX, area.width / 2)
    const left = clamp(onScreen((start + end) / 2 - bar.width / 2, bar.width), area.left + stick - bar.width, area.left + area.width - stick)
    return { left, top }
  }
  const minWidth = Math.max(0, Math.min(end, viewport.width - BAR_EDGE_PX) - Math.max(start, BAR_EDGE_PX))
  const shown = Math.min(end - start, Math.max(minWidth, bar.width))
  return { left: clamp(onScreen(start, shown), start, end - shown), top, minWidth }
}

/** Where the Frame is on screen (tickets 427, 473, 0657): its line's box, its margin sheet's box and the canvas box
 * they sit in, in the canvas box's pixels. The sheet's tools and title block are placed from it. */
export interface FrameAnchor extends SelectionAnchor {
  /** The margin sheet round the Frame (MarginSheet card), the Frame's tools on its paper. */
  sheet: BarBox
  /** How tall the sheet's narrowest band is in screen px: what its form follows (ticket 0658). */
  band: number
  /** The Canvas's first bead cell on screen, whatever the Frame is: it moves with pan and zoom only, so what is carried with the view follows it (ticket 500). */
  origin?: BarBox
  /** The sheet's corner that holds the title block, the Frame's own bottom-right on a turned Canvas (ticket 0728): as
   * drawn before it leans. None, bottom-right. */
  titleCorner?: TitleCorner
  /** How far the Canvas leans off its quarter turn, in degrees clockwise (ticket 0672): the boxes above are as drawn
   * before it leans, and the sheet's tools lean with it about the viewport's middle. None upright. */
  tilt?: number
}

/** How far a Selection's handles reach past its edge, in screen px (a finger's 35), and over its top, where its Area
 * sheet's top band (48px at most, with the docked bar) carries them out (ticket 0808). */
const SELECTION_HANDLE_REACH_PX = 35
const SELECTION_TOP_REACH_PX = areaSheetOutset(true).top + 24

/** Whether a control's hit area lies where a Selection's handles or docked bar can be pressed, so they win the press
 * (tickets 498, 0657, 0808): over the reach round its edge, not well inside it. */
export function overlapsSelectionHandles(hit: BarBox, selection: BarBox): boolean {
  const reach = SELECTION_HANDLE_REACH_PX
  const above = SELECTION_TOP_REACH_PX
  const handles: BarBox = { left: selection.left - reach, top: selection.top - above, width: selection.width + 2 * reach, height: selection.height + reach + above }
  const inside: BarBox = { left: selection.left + reach, top: selection.top + reach, width: selection.width - 2 * reach, height: selection.height - 2 * reach }
  const coveredWhole = inside.width > 0 && inside.height > 0 && hit.left >= inside.left && hit.top >= inside.top && hit.left + hit.width <= inside.left + inside.width && hit.top + hit.height <= inside.top + inside.height
  return boxesOverlap(hit, handles) && !coveredWhole
}

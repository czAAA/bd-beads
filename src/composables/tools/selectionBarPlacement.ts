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

const overlaps = (a: BarBox, b: BarBox) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

// Where the Selection bar sits (ticket 415): centred above the Selection's top edge, clamped inside the canvas box,
// flipped below when there is no room above. The Tool pill's rectangle (`obstacle`, ticket 439) acts like a canvas
// edge: the bar flips sides or slides clear of the pill the way it overlaps least.
export function selectionBarPlacement(
  selection: BarBox,
  bar: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacle?: BarBox,
): BarPlacement {
  const onScreen = (value: number, size: number, limit: number) => Math.max(BAR_EDGE_PX, Math.min(value, limit - size - BAR_EDGE_PX))
  const left = onScreen(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width)
  const above = selection.top - BAR_GAP_PX - bar.height
  const below = above < BAR_EDGE_PX
  const at = (isBelow: boolean): BarPlacement => ({
    left,
    top: onScreen(isBelow ? selection.top + selection.height + BAR_GAP_PX : above, bar.height, viewport.height),
    below: isBelow,
  })
  const preferred = at(below)
  const hits = (placement: BarPlacement) => !!obstacle && overlaps({ ...placement, ...bar }, obstacle)
  if (!hits(preferred)) return preferred
  const flipped = at(!below)
  if (!hits(flipped)) return flipped
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

/** Where the Frame is on screen (tickets 427, 473): its line's box and the canvas box it sits in, in the canvas box's
 * pixels. The Move handle and the edit pencil are placed from it. */
export interface FrameAnchor extends SelectionAnchor {
  /** The Canvas's first bead cell on screen, whatever the Frame is: it moves with pan and zoom only, so what is carried with the view follows it (ticket 500). */
  origin?: BarBox
}

/** The Move handle's hit area, mirroring the `--frame-handle-hit-*` values (ticket 473). */
const HANDLE_HIT_HEIGHT_PX = 44
const HANDLE_HIT_WIDTH_PX = 56
/** The edit pencil's hit area, mirroring `--frame-edit-hit`. */
const PENCIL_HIT_PX = 44
/** How far from the Frame's line the Move handle and the pencil stand, in screen px at every zoom (ADR 0066): past the
 * resize handles' reach (a mouse's 24px from the line; a finger's corners reach 35) and their own half hit area. */
const CONTROL_OFFSET_PX = 48 // `--frame-control-offset`

const around = (centre: { x: number; y: number }, width: number, height: number): BarBox => ({ left: centre.x - width / 2, top: centre.y - height / 2, width, height })

/** The height a gutter control of hit height `size` stands at: above the Frame, or below it when the canvas box has no room above. */
function gutterY({ box }: FrameAnchor, size: number): number {
  return box.top - CONTROL_OFFSET_PX - size / 2 >= 0 ? box.top - CONTROL_OFFSET_PX : box.top + box.height + CONTROL_OFFSET_PX
}

/** `value` kept inside the canvas box along one axis, by a hit area of `size` centred on it. */
const within = (value: number, size: number, limit: number) => Math.max(size / 2, Math.min(value, limit - size / 2))

/** Where the edit pencil goes (ticket 473, ADR 0066): in the gutter above the Frame's top-right corner, or below its
 * bottom-right corner when there is no room above; kept inside the canvas box. */
export function editPencilCentre(anchor: FrameAnchor): { x: number; y: number } {
  const { box, viewport } = anchor
  return { x: within(box.left + box.width, PENCIL_HIT_PX, viewport.width), y: within(gutterY(anchor, PENCIL_HIT_PX), PENCIL_HIT_PX, viewport.height) }
}

/** Where Remove Frame goes (ticket 498): right after the edit pencil, one hit area to its right, or to its left when
 * the canvas box has no room there or the Tool pill (`obstacle`) would cover it; kept inside the canvas box. */
export function removeFrameCentre(anchor: FrameAnchor, obstacle?: BarBox): { x: number; y: number } {
  const pencil = editPencilCentre(anchor)
  const at = (x: number) => ({ x: within(x, PENCIL_HIT_PX, anchor.viewport.width), y: pencil.y })
  const right = at(pencil.x + PENCIL_HIT_PX)
  const left = at(pencil.x - PENCIL_HIT_PX)
  const fits = (point: { x: number; y: number }) => !overlaps(around(point, PENCIL_HIT_PX, PENCIL_HIT_PX), around(pencil, PENCIL_HIT_PX, PENCIL_HIT_PX)) && !(obstacle && overlaps(around(point, PENCIL_HIT_PX, PENCIL_HIT_PX), obstacle))
  return [right, left].find(fits) ?? (right.x - pencil.x >= PENCIL_HIT_PX ? right : left)
}

/** How far a Selection's handles reach past its edge, in screen px (a finger's 35). */
const SELECTION_HANDLE_REACH_PX = 35

/** Whether a control's hit area (`centre`, `size` square) lies where a Selection's handles can be pressed, so the
 * handle wins the press (ticket 498). */
export function overlapsSelectionHandles(centre: { x: number; y: number }, size: number, selection: BarBox): boolean {
  const reach = SELECTION_HANDLE_REACH_PX
  const handles: BarBox = { left: selection.left - reach, top: selection.top - reach, width: selection.width + 2 * reach, height: selection.height + 2 * reach }
  const inside: BarBox = { left: selection.left + reach, top: selection.top + reach, width: selection.width - 2 * reach, height: selection.height - 2 * reach }
  const hit = around(centre, size, size)
  const coveredWhole = inside.width > 0 && inside.height > 0 && hit.left >= inside.left && hit.top >= inside.top && hit.left + hit.width <= inside.left + inside.width && hit.top + hit.height <= inside.top + inside.height
  return overlaps(hit, handles) && !coveredWhole
}

/** Where the Move handle goes (ticket 473, ADR 0066): in the gutter above the Frame, centred on its top edge, or below
 * it when there is no room above; kept inside the canvas box. Only its centre moves with the zoom; it slides clear of
 * the edit pencil and the Frame panel (`bar`) where they would cover it. */
export function moveHandleCentre(anchor: FrameAnchor, bar?: BarBox, pill?: BarBox): { x: number; y: number } {
  const { box, viewport } = anchor
  const pos = (x: number, y: number) => ({ x: within(x, HANDLE_HIT_WIDTH_PX, viewport.width), y: within(y, HANDLE_HIT_HEIGHT_PX, viewport.height) })
  const natural = pos(box.left + box.width / 2, gutterY(anchor, HANDLE_HIT_HEIGHT_PX))
  const obstacles = [around(editPencilCentre(anchor), PENCIL_HIT_PX, PENCIL_HIT_PX), around(removeFrameCentre(anchor, pill), PENCIL_HIT_PX, PENCIL_HIT_PX), ...(bar ? [bar] : []), ...(pill ? [pill] : [])]
  const hits = (point: { x: number; y: number }) => obstacles.some((obstacle) => overlaps(around(point, HANDLE_HIT_WIDTH_PX, HANDLE_HIT_HEIGHT_PX), obstacle))
  if (!hits(natural)) return natural
  const halfW = HANDLE_HIT_WIDTH_PX / 2
  const halfH = HANDLE_HIT_HEIGHT_PX / 2
  const slides = obstacles.flatMap((o) => [
    pos(o.left - halfW, natural.y),
    pos(o.left + o.width + halfW, natural.y),
    pos(natural.x, o.top - halfH),
    pos(natural.x, o.top + o.height + halfH),
  ])
  const distance = (at: { x: number; y: number }) => Math.abs(at.x - natural.x) + Math.abs(at.y - natural.y)
  return slides.filter((at) => !hits(at)).sort((a, b) => distance(a) - distance(b))[0] ?? natural
}


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
  const clamp = (value: number, size: number, limit: number) => Math.max(BAR_EDGE_PX, Math.min(value, limit - size - BAR_EDGE_PX))
  const left = clamp(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width)
  const above = selection.top - BAR_GAP_PX - bar.height
  const below = above < BAR_EDGE_PX
  const at = (isBelow: boolean): BarPlacement => ({
    left,
    top: clamp(isBelow ? selection.top + selection.height + BAR_GAP_PX : above, bar.height, viewport.height),
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
    { ...preferred, left: clamp(pill.left - BAR_GAP_PX - bar.width, bar.width, viewport.width) },
    { ...preferred, left: clamp(pill.left + pill.width + BAR_GAP_PX, bar.width, viewport.width) },
    { ...preferred, top: clamp(pill.top - BAR_GAP_PX - bar.height, bar.height, viewport.height) },
    { ...preferred, top: clamp(pill.top + pill.height + BAR_GAP_PX, bar.height, viewport.height) },
  ]
  const clear = slides.filter((placement) => !hits(placement))
  const distance = (placement: BarPlacement) => Math.abs(placement.left - preferred.left) + Math.abs(placement.top - preferred.top)
  return clear.sort((a, b) => distance(a) - distance(b))[0] ?? preferred
}

/** Where the Frame is on screen (tickets 427, 473): its line's box and the margin's outer edge, in the canvas box's
 * pixels. The Margin handle and the edit pencil are placed from it. */
export interface FrameAnchor extends SelectionAnchor {
  /** The margin's outer edge, in the canvas box's pixels. */
  outer: BarBox
}

/** The Margin handle's hit area, mirroring the `--frame-handle-hit-*` values (ticket 473). */
const HANDLE_HIT_HEIGHT_PX = 44
/** The edit pencil's hit area and how far in and down its centre sits from the margin outline's top-right corner,
 * mirroring `--frame-edit-hit`. */
const PENCIL_HIT_PX = 44
const PENCIL_OFFSET_PX = 26

const HANDLE_HIT_WIDTH_PX = 56
const around = (centre: { x: number; y: number }, width: number, height: number): BarBox => ({ left: centre.x - width / 2, top: centre.y - height / 2, width, height })

/** Where the Margin handle goes (ticket 473): halfway down the top margin, centred on it however much is in view. It
 * is not pulled into the canvas box, so a Frame dragged over the edge takes it along. Only its centre moves with the
 * zoom; it slides clear of the edit pencil and the Frame bar (`bar`) where they would cover it. */
export function marginHandleCentre(anchor: FrameAnchor, bar?: BarBox): { x: number; y: number } {
  const { box, outer } = anchor
  const pos = (x: number, y: number) => ({ x, y })
  const natural = pos(outer.left + outer.width / 2, (box.top + outer.top) / 2)
  const obstacles = [around(editPencilCentre(anchor), PENCIL_HIT_PX, PENCIL_HIT_PX), ...(bar ? [bar] : [])]
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

/** Where the edit pencil goes (ticket 473): inside the margin, its hit area 4px in from the outline's top-right corner,
 * pinned to it. Not pulled into the canvas box: a Frame dragged over the edge takes it along. */
export function editPencilCentre(anchor: FrameAnchor): { x: number; y: number } {
  const { outer } = anchor
  return { x: outer.left + outer.width - PENCIL_OFFSET_PX, y: outer.top + PENCIL_OFFSET_PX }
}

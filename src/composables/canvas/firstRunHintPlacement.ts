import type { PillPosition } from '../../domain/toolPill'
import type { BarBox } from '../tools/selectionBarPlacement'

// Where the first-run hints sit over an empty Project (FirstRunHints card, ticket 0725), in px on the drawing area.
// Each note tries a few distances from its control on the drawing-area side and takes the first that covers nothing;
// a step that finds none keeps its nearest place, a quiet note that finds none is left out.

/** The four steps on the way to a first Pattern, in order, then the quiet notes in the order they are kept. */
export const STEP_HINTS = ['paint', 'select', 'frame', 'export'] as const
export const QUIET_HINTS = ['color', 'mirror', 'menu', 'project'] as const
export type HintId = (typeof STEP_HINTS)[number] | (typeof QUIET_HINTS)[number]

/** The controls in the Canvas strip, above the drawing area; the rest are Tool pill tiles. */
const STRIP_HINTS: readonly HintId[] = ['menu', 'project', 'frame', 'export']
/** The notes that sit before their control (Paint's left of its tile, Export's ending under it); the others after. */
const BEFORE: readonly HintId[] = ['paint', 'export']

/** How far a note sits from its control, nearest first: a step 40 to 110px (the card's), a quiet note further out
 * when the steps took the near places, so the notes along the pill stack instead of dropping. */
const STEP_DISTANCES = [40, 52, 64, 76, 88, 100, 110]
const QUIET_DISTANCES = [...STEP_DISTANCES, 125, 140, 155, 170]
/** The room kept between a note and the drawing area's edge, and round every note and obstacle. */
const EDGE = 8
const GAP = 6
/** How far a note slides along its edge, away from its control, to clear another note or arrow. */
const SHIFTS = [0, 40, 80, 120, 160, 200, 240]
/** How far a note sits along from its control's middle, and how far from the control an arrow stops. */
const ALONG = 4
const ARROW_STOP = 6
const HEAD = 6
/** How far an arrow bows, as a share of its length, to either side: the first that crosses nothing is drawn. */
const BOWS = [0.25, -0.25, 0.1, -0.1]

export interface Size {
  width: number
  height: number
}

/** What the hints are placed in: the drawing area, the controls they point at and the notes' own sizes, all measured
 * on the drawing area, the Tool pill's edge, and the boxes no note may cover (the pill, the CanvasHint line, the welcome). */
export interface HintLayout {
  area: Size
  targets: Partial<Record<HintId, BarBox>>
  notes: Partial<Record<HintId, Size>>
  pillPosition: PillPosition
  obstacles: BarBox[]
}

/** A note's place and its hand-drawn arrow, an SVG path on the drawing area. */
export interface PlacedHint {
  id: HintId
  note: { left: number; top: number }
  arrow: string
}

interface Point {
  x: number
  y: number
}

/** The orders the notes are tried in: steps first, and a staircase where the notes further along the pill go before
 * step 2's, so its note can sit above theirs and every arrow reach its tile. */
const ORDERS: readonly HintId[][] = [
  [...STEP_HINTS, ...QUIET_HINTS],
  ['paint', 'frame', 'export', 'color', 'mirror', 'select', 'menu', 'project'],
]
const CANONICAL: readonly HintId[] = ORDERS[0]

/** The notes that fit: each placed where it covers no obstacle, other note or arrow, and its arrow crosses no obstacle
 * or other note. Of the orders tried, the one that places most notes with every step in a free place wins. */
export function placeFirstRunHints(layout: HintLayout): PlacedHint[] {
  const tries = ORDERS.map((order) => placeInOrder(layout, order))
  const fair = tries.filter((attempt) => !attempt.crowdedStep)
  const best = (fair.length ? fair : tries).reduce((a, b) => (b.placed.length > a.placed.length ? b : a))
  return [...best.placed].sort((a, b) => CANONICAL.indexOf(a.id) - CANONICAL.indexOf(b.id))
}

function placeInOrder(layout: HintLayout, order: readonly HintId[]): { placed: PlacedHint[]; crowdedStep: boolean } {
  const taken: BarBox[] = [...layout.obstacles]
  const arrows: Point[][] = []
  const placed: PlacedHint[] = []
  let crowdedStep = false
  for (const id of order) {
    const target = layout.targets[id]
    const size = layout.notes[id]
    if (!target || !size) continue
    const step = (STEP_HINTS as readonly HintId[]).includes(id)
    const end = arrowEnd(id, target, layout.pillPosition)
    const candidates = (step ? STEP_DISTANCES : QUIET_DISTANCES)
      .flatMap((distance) => SHIFTS.map((shift) => noteBox(id, target, size, distance, shift, layout)))
      .flatMap((box) => BOWS.map((bow) => ({ box, arrow: arrowOf(box, end, bow) })))
    const free = candidates.find(
      ({ box, arrow }) =>
        inside(box, layout.area) &&
        !taken.some((other) => overlaps(box, other)) &&
        !arrows.some((points) => points.some((point) => covers(box, point))) &&
        !taken.some((other) => along(arrow).some((point) => covers(other, point, 0))),
    )
    // A step always shows: with no free place it keeps its nearest.
    if (!free && step) crowdedStep = true
    const chosen = free ?? (step ? candidates[0] : undefined)
    if (!chosen) continue
    taken.push(chosen.box)
    arrows.push(along(chosen.arrow))
    placed.push({ id, note: { left: chosen.box.left, top: chosen.box.top }, arrow: arrowPath(chosen.arrow) })
  }
  return { placed, crowdedStep }
}

/** The note's box `distance` px from its control on the drawing-area side and `shift` px further along, away from it,
 * pulled inside the area's edges. */
function noteBox(id: HintId, target: BarBox, size: Size, distance: number, shift: number, layout: HintLayout): BarBox {
  const { width, height } = size
  const before = BEFORE.includes(id)
  const slide = before ? -shift : shift
  const middle = { x: target.left + target.width / 2, y: target.top + target.height / 2 }
  const beside = (start: number, length: number) => (before ? start - ALONG - length : start + ALONG) + slide
  let left: number
  let top: number
  if (STRIP_HINTS.includes(id)) {
    top = Math.max(0, target.top + target.height) + distance
    left = slide + (id === 'menu' ? EDGE : id === 'frame' ? target.left + target.width + 2 * ALONG : id === 'export' ? target.left + target.width - width : target.left)
  } else {
    switch (layout.pillPosition) {
      case 'bottom':
        top = target.top - distance - height
        left = beside(middle.x, width)
        break
      case 'top':
        top = target.top + target.height + distance
        left = beside(middle.x, width)
        break
      case 'left':
        left = target.left + target.width + distance
        top = beside(middle.y, height)
        break
      case 'right':
        left = target.left - distance - width
        top = beside(middle.y, height)
        break
    }
  }
  return {
    left: Math.round(clamp(left, EDGE, layout.area.width - EDGE - width)),
    top: Math.round(clamp(top, EDGE, layout.area.height - EDGE - height)),
    width,
    height,
  }
}

/** Where a note's arrow stops: 6px off its control's edge on the drawing-area side. */
function arrowEnd(id: HintId, target: BarBox, pillPosition: PillPosition): Point {
  const middle = { x: target.left + target.width / 2, y: target.top + target.height / 2 }
  if (STRIP_HINTS.includes(id)) return { x: middle.x, y: target.top + target.height + ARROW_STOP }
  switch (pillPosition) {
    case 'bottom':
      return { x: middle.x, y: target.top - ARROW_STOP }
    case 'top':
      return { x: middle.x, y: target.top + target.height + ARROW_STOP }
    case 'left':
      return { x: target.left + target.width + ARROW_STOP, y: middle.y }
    case 'right':
      return { x: target.left - ARROW_STOP, y: middle.y }
  }
}

/** A hand-drawn arrow: one curve from the note's nearest edge to `end`, bowed to one side. */
interface Arrow {
  start: Point
  control: Point
  end: Point
}

function arrowOf(note: BarBox, end: Point, bowing: number): Arrow {
  const nearest = { x: clamp(end.x, note.left, note.left + note.width), y: clamp(end.y, note.top, note.top + note.height) }
  const away = unit({ x: end.x - nearest.x, y: end.y - nearest.y })
  const start = { x: nearest.x + away.x * GAP, y: nearest.y + away.y * GAP }
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const bow = { x: -away.y * length * bowing, y: away.x * length * bowing }
  return { start, control: { x: (start.x + end.x) / 2 + bow.x, y: (start.y + end.y) / 2 + bow.y }, end }
}

/** Points along the curve, short of its head (which stops just off the control, beside the pill or strip). */
function along({ start, control, end }: Arrow): Point[] {
  return Array.from({ length: 37 }, (_, index) => {
    const t = index / 40
    const [a, b, c] = [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2]
    return { x: a * start.x + b * control.x + c * end.x, y: a * start.y + b * control.y + c * end.y }
  })
}

/** The curve and an open head of two 6px strokes, as an SVG path. */
function arrowPath({ start, control, end }: Arrow): string {
  const back = unit({ x: control.x - end.x, y: control.y - end.y })
  const wing = (turn: number) => ({
    x: end.x + HEAD * (back.x * Math.cos(turn) - back.y * Math.sin(turn)),
    y: end.y + HEAD * (back.x * Math.sin(turn) + back.y * Math.cos(turn)),
  })
  const [one, two] = [wing(Math.PI / 6), wing(-Math.PI / 6)]
  const at = ({ x, y }: Point) => `${round(x)} ${round(y)}`
  return `M ${at(start)} Q ${at(control)} ${at(end)} M ${at(one)} L ${at(end)} L ${at(two)}`
}

function unit({ x, y }: Point): Point {
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 0, y: -1 } : { x: x / length, y: y / length }
}

function inside(box: BarBox, area: Size): boolean {
  return box.left >= EDGE && box.top >= EDGE && box.left + box.width <= area.width - EDGE && box.top + box.height <= area.height - EDGE
}

function covers(box: BarBox, { x, y }: Point, gap = GAP): boolean {
  return x > box.left - gap && x < box.left + box.width + gap && y > box.top - gap && y < box.top + box.height + gap
}

function overlaps(a: BarBox, b: BarBox): boolean {
  return a.left < b.left + b.width + GAP && b.left < a.left + a.width + GAP && a.top < b.top + b.height + GAP && b.top < a.top + a.height + GAP
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

const round = (value: number) => Math.round(value * 10) / 10

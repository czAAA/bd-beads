import { clamp } from '../../domain/clamp'
import type { PillPosition } from '../../domain/toolPill'
import type { BarBox } from '../tools/selectionBarPlacement'

// Where the first-run captions sit over an empty Project (FirstRunHints card, ticket 0738), in px on the drawing area.
// Each caption sits beside its own control, with no arrow: a strip caption under its button in its own column, a tile
// caption on the drawing-area side of its tile, stacked further out rather than cover another.

/** The captions that always show (the ringed path's Select and Export, and Frame), then the quiet ones in the order
 * they are kept: Project's drops first, colour's last. */
export const KEPT_HINTS = ['select', 'frame', 'export'] as const
export const QUIET_HINTS = ['color', 'mirror', 'menu', 'project'] as const
export type HintId = (typeof KEPT_HINTS)[number] | (typeof QUIET_HINTS)[number]
const ORDER: readonly HintId[] = [...KEPT_HINTS, ...QUIET_HINTS]

/** The captions in the larger step face: Select's and Export's, on the two ringed controls they name. */
export const isStepHint = (id: HintId): boolean => id === 'select' || id === 'export'

/** The controls in the Canvas strip, above the drawing area, left to right; the rest are Tool pill tiles. */
type StripHint = 'menu' | 'project' | 'frame' | 'export'
const STRIP_HINTS: readonly StripHint[] = ['menu', 'project', 'frame', 'export']
/** Whether a caption names a Canvas strip button, so it wraps in a column from `captionColumns`. */
export const isStripHint = (id: HintId): id is StripHint => (STRIP_HINTS as readonly HintId[]).includes(id)
const isKept = (id: HintId): boolean => (KEPT_HINTS as readonly HintId[]).includes(id)

/** A strip caption's column: the room under its button up to the next one, at most COLUMN_MAX; a quiet caption with
 * less than COLUMN_MIN is left out, a kept one wraps in COLUMN_MIN. */
const COLUMN_MAX = 192
const COLUMN_MIN = 64
/** The room kept between a caption and the drawing area's edge, and round every caption and obstacle. */
const EDGE = 8
const GAP = 6
/** How far under its button a strip caption sits, nearest first; it moves down only to clear an obstacle. */
const STRIP_DISTANCES = [8, 28, 48, 72]
/** How far from its tile a tile caption sits (clear of the pill's edge and the ring), and how far it slides along the
 * pill: it stays centred on its tile and stacks further out before it slides. */
const TILE_DISTANCES = [10, 22, 36, 52, 70, 90, 112]
const SHIFTS = [0, 24, -24, 48, -48, 96, -96, 160, -160]

export interface Size {
  width: number
  height: number
}

/** What the captions are placed in: the drawing area, their controls and their own sizes, all measured on the drawing
 * area, the Tool pill's edge, and the boxes no caption may cover (the pill, the CanvasHint line, the welcome). */
export interface HintLayout {
  area: Size
  targets: Partial<Record<HintId, BarBox>>
  notes: Partial<Record<HintId, Size>>
  pillPosition: PillPosition
  obstacles: BarBox[]
}

/** A caption's place on the drawing area. */
export interface PlacedHint {
  id: HintId
  note: { left: number; top: number }
}

/** The width each strip caption wraps in, so it stays under its own button and never runs under the next one's. */
export function captionColumns(targets: Partial<Record<HintId, BarBox>>): Partial<Record<StripHint, number>> {
  const present = STRIP_HINTS.filter((id) => targets[id])
  const columns: Partial<Record<StripHint, number>> = {}
  present.forEach((id, index) => {
    const target = targets[id]!
    const previous = targets[present[index - 1]]
    const next = targets[present[index + 1]]
    const room =
      id === 'export'
        ? target.left + target.width - (previous ? previous.left + previous.width + GAP : EDGE)
        : next
          ? next.left - GAP - Math.max(EDGE, target.left)
          : COLUMN_MAX
    if (room >= COLUMN_MIN) columns[id] = Math.min(COLUMN_MAX, room)
    else if (isKept(id)) columns[id] = COLUMN_MIN
  })
  return columns
}

/** The captions that fit, each where it covers no obstacle or other caption. Select, Frame and Export always show,
 * in their nearest place when none is free; a quiet caption with no free place is left out. */
export function placeFirstRunHints(layout: HintLayout): PlacedHint[] {
  const taken: BarBox[] = [...layout.obstacles]
  const placed: PlacedHint[] = []
  for (const id of ORDER) {
    const target = layout.targets[id]
    const size = layout.notes[id]
    if (!target || !size) continue
    const candidates = isStripHint(id)
      ? STRIP_DISTANCES.map((distance) => stripBox(id, target, size, distance, layout.area))
      : SHIFTS.flatMap((shift) => TILE_DISTANCES.map((distance) => tileBox(target, size, distance, shift, layout)))
    const free = candidates.find((box) => inside(box, layout.area) && !taken.some((other) => overlaps(box, other)))
    const chosen = free ?? (isKept(id) ? candidates[0] : undefined)
    if (!chosen) continue
    taken.push(chosen)
    placed.push({ id, note: { left: chosen.left, top: chosen.top } })
  }
  return placed
}

/** A strip caption `distance` px under its button: Export's right-aligned under it, Menu's no nearer the edge than EDGE. */
function stripBox(id: StripHint, target: BarBox, size: Size, distance: number, area: Size): BarBox {
  const left = id === 'export' ? target.left + target.width - size.width : Math.max(EDGE, target.left)
  return within({ left, top: Math.max(0, target.top + target.height) + distance, ...size }, area)
}

/** A tile caption `distance` px off its tile on the drawing-area side, centred on the tile and `shift` px along. */
function tileBox(target: BarBox, size: Size, distance: number, shift: number, layout: HintLayout): BarBox {
  const { width, height } = size
  const across = (start: number, length: number, extent: number) => start + length / 2 - extent / 2 + shift
  let left: number
  let top: number
  switch (layout.pillPosition) {
    case 'bottom':
      top = target.top - distance - height
      left = across(target.left, target.width, width)
      break
    case 'top':
      top = target.top + target.height + distance
      left = across(target.left, target.width, width)
      break
    case 'left':
      left = target.left + target.width + distance
      top = across(target.top, target.height, height)
      break
    case 'right':
      left = target.left - distance - width
      top = across(target.top, target.height, height)
      break
  }
  return within({ left, top, width, height }, layout.area)
}

/** The box pulled inside the area's edges, on whole px. */
function within(box: BarBox, area: Size): BarBox {
  return {
    ...box,
    left: Math.round(clamp(box.left, EDGE, Math.max(EDGE, area.width - EDGE - box.width))),
    top: Math.round(clamp(box.top, EDGE, Math.max(EDGE, area.height - EDGE - box.height))),
  }
}

function inside(box: BarBox, area: Size): boolean {
  return box.left >= EDGE && box.top >= EDGE && box.left + box.width <= area.width - EDGE && box.top + box.height <= area.height - EDGE
}

function overlaps(a: BarBox, b: BarBox): boolean {
  return a.left < b.left + b.width + GAP && b.left < a.left + a.width + GAP && a.top < b.top + b.height + GAP && b.top < a.top + a.height + GAP
}

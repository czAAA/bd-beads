import type { Rect } from '../domain/canvas'
import { frameShapeOf } from '../domain/frameShape'
import { laidRect } from '../domain/frameOrientation'
import { describeWeave, type Weave } from '../domain/weave'
import type { GridPosition } from '../domain/grid'
import { canvasWeave, frameScale, frameWeave } from '../domain/layerWeave'
import type { NamedPiece } from '../domain/pieceNames'
import { hasGuides, type Selection } from '../domain/selection'
import type { MarginForm } from './marginForm'
import { rulerScale, type RulerScale } from './rulerScale'
import { ruledPieces, type RuledPieces } from './ruledPieces'
import { cellSizePx } from './cellSize'
import { frameOriginPx, gridBox, beadStepPx, type SurfaceView, type ViewLayer } from './surfaceView'
import { frameOf, type Layered } from '../domain/layerRecord'

// The rulers and their lines on the Canvas (ADR 0026): row and column numbers on the Frame's sides but the bottom one
// (ticket 0657), or each Piece's top and left. Plain geometry in viewport px, so tests find numbers and dots as a pointer would (ADR 0033).
// Numbers are display-only (ticket 447).

// From this column number a ruler number is turned a quarter and read upward, so three digits take no more width than
// two (Rulers card).
const TURNED_FROM = 100
/** DM Mono's advance, as a share of its size: what a number's box is worked out from. */
const MONO_ADVANCE = 0.6
// The most half the band of numbers counts for when the dots stand on its line, as a share of the numbers' size: a
// 2-digit row number's, so only wider ones (3 digits, or turned) are held back.
const DOT_BAND_HALF_MAX = 0.6
/** The clear space kept between two neighbouring numbers when the Ruler step is chosen (ADR 0033). */
const RULER_NUMBER_GAP_PX = 4
// Below this zoom a ruler drops the Ruler step and shows only its last number (ADR 0033, ticket 303); from it up the
// step applies.
const LAST_NUMBER_ONLY_BELOW_ZOOM = 0.5

/** Something rulers hang from: a rectangle of beads, the line round it, and which of its sides carry numbers. */
export interface RuledBox extends Rect {
  kind: 'frame' | 'piece'
  /** How far outside its beads its line sits. */
  outset: number
  /** The Frame's sides but the one shown at the bottom (`sheet`, ticket 0657), or only above and to the left (a Piece). */
  sides: 'sheet' | 'start'
}

/** One number on a ruler, where it is in the viewport and what a click on it selects. */
export interface RulerLabel {
  text: string
  /** The centre of the number's box in viewport px, and its size; a turned number's box is already turned. */
  x: number
  y: number
  width: number
  height: number
  turned: boolean
  /** Every 5th number. */
  fifth: boolean
  axis: 'row' | 'column'
  /** Zero-based along its ruler: the row or column of the ruled box it numbers. */
  index: number
  /** The row or column of beads a click on it marks out, over the whole ruled box. */
  selection: Selection
  /** The absolute position of that row or column, for the current row and the cursor. */
  position: number
}

/** What decides which boxes carry rulers. */
export type RuledProject = Layered

// The boxes that carry rulers: the Frame alone once set, as it lies (ticket 0667), else every Piece area of more than 4
// beads (the caller picks those near the viewport), with the Rulers on only, as a Piece's line goes with its numbers.
// A Custom frame has none: its beads lie in rounds, not its rectangle's rows and columns (ticket 0592).
function ruledBoxes(project: RuledProject, scale: RulerScale, pieces: RuledPieces): RuledBox[] {
  const frame = frameOf(project)
  if (frame) {
    if (frameShapeOf(frame)) return []
    const { row, column, rows, columns } = laidRect({ ...frame, cell: frameWeave(project).cell })
    return [{ row, column, rows, columns, kind: 'frame', outset: scale.frameOutset, sides: 'sheet' }]
  }
  return (pieces.areas ?? [])
    .filter(hasGuides)
    .map((piece) => ({ ...piece, kind: 'piece' as const, outset: scale.pieceOutset, sides: 'start' as const }))
}

/** The Ruler steps in order: every bead, then 5, 10, 50, 100, 500... (ADR 0033). */
function* rulerSteps(): Generator<number> {
  yield 1
  yield 5
  let step = 10
  let fiveNext = true
  for (;;) {
    yield step
    step *= fiveNext ? 5 : 2
    fiveNext = !fiveNext
  }
}

// The Ruler step (ADR 0033): the smallest of 1, 5, 10, 50... beads between numbers that keeps each clear of the next
// along its own axis.
function rulerStep(spacing: { x: number; y: number }, sizes: readonly { width: number; height: number }[]): number {
  for (const step of rulerSteps()) {
    const clear = sizes.every(
      (size) => step * Math.abs(spacing.x) >= size.width + RULER_NUMBER_GAP_PX || step * Math.abs(spacing.y) >= size.height + RULER_NUMBER_GAP_PX,
    )
    if (clear || step >= 1e7) {
      return step
    }
  }
  return 1
}

function labelBox(text: string, turned: boolean, fontPx: number): { width: number; height: number } {
  const width = text.length * fontPx * MONO_ADVANCE
  return turned ? { width: fontPx, height: width } : { width, height: fontPx }
}


/** How far outside the viewport a box still counts as near it. */
const NEAR_VIEWPORT_PX = 40

// Below this bead pitch (px) a dot per bead would run together into a line, so only every 5th bead keeps its dot (ADR
// 0033).
const DOT_EVERY_BEAD_FROM_PX = 6

/** A bead's mark on a ruler: where it sits in the viewport, and what a press on it selects. */
export interface RulerDot {
  x: number
  y: number
  /** Every 5th bead: drawn bolder. */
  fifth: boolean
  /** Whether this bead already carries a number at the current Ruler step. */
  numbered: boolean
  axis: 'row' | 'column'
  index: number
  selection: Selection
  position: number
  /** The unit direction away from the ruled box, in the viewport, and the bead pitch along the ruler in px. */
  normal: [number, number]
  pitch: number
  // Half the thickness of the band the ruler's numbers fill, across the ruler: where the dot's line sits and how far a
  // press on the ruler reaches.
  half: number
}

export interface RulerLayoutOptions {
  /** The numbers' size in px at zoom 1: 11, or 12 on a phone. It grows or shrinks with the zoom (`RulerScale`). */
  fontPx: number
  /** Whether the numbers and dots are drawn (the Rulers toggle). The Frame's line and picking do not depend on it. */
  numbers: boolean
  /** The form of the Frame's margin sheet, which its numbers hang on: only the full form has room for them and their
   * dots (MarginSheet card, ticket 0658). Full when left out. */
  sheet?: MarginForm
  /** The margin sheet's scale (`marginScale`, ticket 0698): a Frame's numbers stand on its sheet and are drawn at it in
   * place of the zoom's own rule. Left out, the zoom's rule. */
  sheetScale?: number
  /** The Pieces to rule, when the caller holds them through a stroke (`ruledPieces`, ticket 0674); counted from the
   * beads otherwise. */
  pieces?: RuledPieces
}

/** What the rulers of one view are: what to draw, and what a point of the viewport selects. */
export interface RulerLayout {
  /** What the parts of the rulers measure at this zoom: the numbers' size, their gap to the line and the dots'
   * radii. */
  scale: RulerScale
  /** Whether the numbers and dots are drawn (the Rulers toggle). */
  numbers: boolean
  /** The boxes near the viewport that carry rulers, for their lines. */
  boxes: RuledBox[]
  /** The named Pieces, whose names are drawn under them whether the Rulers are on or not (ADR 0050). */
  named: NamedPiece[]
  /** The coarsest Ruler step among the boxes: beads between numbers, 1 with none. */
  step: number
  /** Whether the current pass is marked: the margin sheet is there, not in the bare form (tickets 0682, 0685). */
  passMark: boolean
  /** The margin sheet's scale, which the current pass's mark is drawn at too (ticket 0698). */
  sheetScale: number
  /** The numbers to draw: none while `numbers` is off. */
  labels: RulerLabel[]
  // The dots to draw: the beads without a number, all of them or only every 5th below DOT_EVERY_BEAD_FROM_PX of pitch;
  // none while `numbers` is off.
  dots: RulerDot[]
}

interface BoxLayout {
  labels: RulerLabel[]
  beads: RulerDot[]
  /** The Ruler step of the box's coarser ruler, in beads between numbers. */
  step: number
}

// Numbers and bead marks of one ruled box touching the viewport. Each number is pushed off the line by half the widest
// number's size so it stands RULER_GAP_PX clear on one line at any rotation; numbers stay upright, only column numbers
// from 100 up turn. The Ruler step is worked out once per axis.
function layBox(box: RuledBox, weave: Weave, place: { origin: { x: number; y: number }; offset: GridPosition; layer: ViewLayer; size?: number }, surface: SurfaceView, viewport: { width: number; height: number }, scale: RulerScale): BoxLayout {
  const { fontPx, gap } = scale
  // The box counted from the layer's first position, and where that sits in grid px (ticket 492).
  const start = { row: box.row - place.offset.row, column: box.column - place.offset.column }
  const margin = fontPx * 4
  const labels: RulerLabel[] = []
  const beads: RulerDot[] = []

  const description = describeWeave(weave)
  const count = { columns: box.columns, rows: box.rows }
  const cell = cellSizePx(weave.technique, weave.cell)
  // A bead's step across and a row's down in grid px, and where a bead's middle sits.
  const { across: beadAcross, down: rowDown } = beadStepPx(weave)
  const middle = { x: cell.width / 2, y: cell.height / 2 }
  const area = gridBox(weave, { ...box, ...start })
  const lastRow = start.row + box.rows - 1
  const bottom = area.y + area.height
  const right = area.x + area.width
  const left = area.x

  // The widest column numbers: the longest upright one (under 100) and the longest turned one.
  const columnSizes = [labelBox(String(Math.min(count.columns, TURNED_FROM - 1)), false, fontPx)]
  if (count.columns >= TURNED_FROM) {
    columnSizes.push(labelBox(String(count.columns), true, fontPx))
  }
  const rowSize = labelBox(String(count.rows), false, fontPx)
  // Every number is centred on the line the dots stand on, so a 1-digit row number is as far from the beads as a
  // 2-digit one.
  const columnBand = { width: Math.max(...columnSizes.map((size) => size.width)), height: Math.max(...columnSizes.map((size) => size.height)) }
  const { column: columnStepOnScreen, row: rowStepOnScreen } = surface.beadStep(place.layer)
  const lastOnly = surface.zoom < LAST_NUMBER_ONLY_BELOW_ZOOM
  const columnStep = lastOnly ? count.columns : rulerStep(columnStepOnScreen, columnSizes)
  const rowStep = lastOnly ? count.rows : rulerStep(rowStepOnScreen, [rowSize])
  const columnPitch = Math.hypot(columnStepOnScreen.x, columnStepOnScreen.y)
  const rowPitch = Math.hypot(rowStepOnScreen.x, rowStepOnScreen.y)

  // A step outward from a side, from the layer's own px (`size` grid px each, its Bead's, ticket 0665) and then once
  // turned.
  const size = place.size ?? 1
  const outward = (gridX: number, gridY: number, normal: [number, number]) => {
    const { x, y } = surface.gridToPoint(place.origin.x + gridX * size, place.origin.y + gridY * size)
    const { x: nx, y: ny } = surface.gridDirection(normal[0], normal[1])
    return { x, y, nx, ny }
  }
  const seen = (label: { x: number; y: number; width: number; height: number }) =>
    label.x + label.width / 2 > -margin && label.x - label.width / 2 < viewport.width + margin && label.y + label.height / 2 > -margin && label.y - label.height / 2 < viewport.height + margin
  const dotSeen = (spot: { x: number; y: number }) => spot.x > -margin && spot.x < viewport.width + margin && spot.y > -margin && spot.y < viewport.height + margin

  /** One bead of a ruler: its number if the Ruler step reaches it, and its mark. */
  const along = (
    axis: 'row' | 'column',
    index: number,
    gridX: number,
    gridY: number,
    normal: [number, number],
    selection: Selection,
    position: number,
  ) => {
    const column = axis === 'column'
    const text = String(index + 1)
    const turned = column && index + 1 >= TURNED_FROM
    const band = column ? columnBand : rowSize
    const half = column ? columnBand.height / 2 : rowSize.width / 2
    // Below the zoom where only the last number is drawn the dots hug the line, as there is no row of numbers for them
    // to line up with (ticket 378); above it they stand no further out than a 2-digit number's half, so a turned
    // 3-digit number or a wide row number does not push them off the line (ticket 377).
    const dotHalf = lastOnly ? scale.dotRadius : Math.min(half, fontPx * DOT_BAND_HALF_MAX)
    const step = column ? columnStep : rowStep
    const { x, y, nx, ny } = outward(gridX, gridY, normal)

    const dotAway = box.outset + gap + dotHalf
    const dot = { x: x + nx * dotAway, y: y + ny * dotAway }
    if (dotSeen(dot)) {
      beads.push({ ...dot, fifth: (index + 1) % 5 === 0, numbered: (index + 1) % step === 0, axis, index, selection, position, normal: [nx, ny], pitch: column ? columnPitch : rowPitch, half: dotHalf })
    }
    if ((index + 1) % step === 0) {
      const size = labelBox(text, turned, fontPx)
      const reach = gap + (Math.abs(nx) * (column ? band.width : rowSize.width) + Math.abs(ny) * (column ? band.height : rowSize.height)) / 2
      const spot = { x: x + nx * (box.outset + reach), y: y + ny * (box.outset + reach), ...size }
      if (seen(spot)) {
        labels.push({ text, ...spot, turned, fifth: (index + 1) % 5 === 0, axis, index, selection, position })
      }
    }
  }

  // A row of numbers stands over the beads of the row it runs along, shifted with them.
  const columnsAt = (alongRow: number, gridY: number, normal: [number, number]) => {
    for (let index = 0; index < count.columns; index += 1) {
      const gridX = area.x + description.rowOffset(alongRow, cell.width) + index * beadAcross + middle.x
      const marked = { top: box.row, left: box.column + index, rows: box.rows, columns: 1 }
      along('column', index, gridX, gridY, normal, marked, box.column + index)
    }
  }
  const rowsAt = (gridX: number, normal: [number, number]) => {
    for (let index = 0; index < count.rows; index += 1) {
      const gridY = area.y + index * rowDown + middle.y
      const first = box.row + index
      const marked = { top: first, left: box.column, rows: 1, columns: box.columns }
      along('row', index, gridX, gridY, normal, marked, first)
    }
  }

  // A Frame's sides are the ones its margin sheet shows on screen above, left and right of it: the one at the bottom
  // holds the title block (MarginSheet card, ticket 0657), whichever way the view is turned.
  const shownBelow = (normal: [number, number]) => surface.gridDirection(normal[0], normal[1]).y > 0.5
  const side = (normal: [number, number], lay: () => void) => {
    if (box.sides === 'start' ? normal[0] + normal[1] < 0 : !shownBelow(normal)) lay()
  }
  side([0, -1], () => columnsAt(start.row, area.y, [0, -1]))
  side([-1, 0], () => rowsAt(left, [-1, 0]))
  side([0, 1], () => columnsAt(lastRow, bottom, [0, 1]))
  side([1, 0], () => rowsAt(right, [1, 0]))
  return { labels, beads, step: Math.max(columnStep, rowStep) }
}

// The rulers of one Canvas view (`surface` must be one); drawing and picking read this one value. A 0 by 0 viewport has
// no edge to cut at.
export function rulerLayout(project: RuledProject, surface: SurfaceView, { fontPx, numbers, sheet = 'full', sheetScale, pieces = ruledPieces(undefined, project, { numbers, stroking: false }) }: RulerLayoutOptions): RulerLayout {
  const measured = surface.viewport.width > 0 && surface.viewport.height > 0
  const viewport = measured ? surface.viewport : { width: Infinity, height: Infinity }
  const zoomed = rulerScale(surface.zoom, fontPx)
  // Once there is a Frame its numbers are the only ones, on its sheet, and grow and shrink with it (ticket 0698).
  const scale = frameOf(project) && sheetScale !== undefined ? { ...zoomed, fontPx: fontPx * sheetScale } : zoomed
  const reach = scale.fontPx * 4 + scale.frameOutset + NEAR_VIEWPORT_PX
  const boxes = ruledBoxes(project, scale, pieces).filter((box) => {
    const shown = surface.beadBox(box, box.kind === 'frame' ? 'frame' : 'canvas')
    return shown.x + shown.width > -reach && shown.x < viewport.width + reach && shown.y + shown.height > -reach && shown.y < viewport.height + reach
  })
  const laid = boxes.map((box) => ({
    kind: box.kind,
    ...(box.kind === 'frame' && frameOf(project)
      ? layBox(box, frameWeave(project), { origin: frameOriginPx(canvasWeave(project), frameOf(project)!), offset: frameOf(project)!, layer: 'frame', size: frameScale(project) }, surface, viewport, scale)
      : layBox(box, canvasWeave(project), { origin: { x: 0, y: 0 }, offset: { row: 0, column: 0 }, layer: 'canvas' }, surface, viewport, scale)),
  }))
  const numbered = laid.filter((box) => box.kind !== 'frame' || sheet === 'full')
  const everyLabel = numbered.flatMap((box) => box.labels)
  const everyBead = numbered.flatMap((box) => box.beads)

  return {
    scale,
    numbers,
    boxes,
    named: pieces.named,
    step: Math.max(1, ...laid.map((box) => box.step)),
    passMark: sheet !== 'bare',
    sheetScale: sheetScale ?? 1,
    labels: numbers ? everyLabel : [],
    dots: numbers ? everyBead.filter((dot) => !dot.numbered && (dot.fifth || dot.pitch >= DOT_EVERY_BEAD_FROM_PX)) : [],
  }
}

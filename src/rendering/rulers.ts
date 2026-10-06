import type { Frame } from '../domain/canvas'
import type { Technique } from '../domain/grid'
import { pieceAreasOf, PIECE_AREA_MIN_BEADS } from '../domain/pieces'
import type { Selection } from '../domain/selection'
import { CELL_SIZE_PX, FRAME_OUTSET_PX, rowShiftPx, rowTopPx, type SurfaceView } from './surfaceView'

/**
 * The rulers and the lines they hang from on the open canvas (Rulers and BeadBoard cards, ADR 0026): every row and
 * column number of the Frame on all four sides, or, until a Frame is set, of each Piece above and to the left of its
 * rectangle, counted from 1 at its top-left bead.
 *
 * The Ruler layout is plain geometry in viewport px, worked out once per view: the numbers and dots that are drawn are
 * the ones a press is tested against, and a test can find a number the way a pointer does (ADR 0033).
 */

/** How far a piece's rectangle and the Frame's line sit outside their outermost beads (BeadBoard and Frame cards). */
const PIECE_OUTSET_PX = 5
/** The gap between a ruler number and the line it hangs from (Rulers card). */
const RULER_GAP_PX = 3
/** From this column number a ruler number is turned a quarter and read upward, so three digits take no more width than two (Rulers card). */
const TURNED_FROM = 100
/** DM Mono's advance, as a share of its size: what a number's box is worked out from. */
const MONO_ADVANCE = 0.6
/** The clear space kept between two neighbouring numbers when the Ruler step is chosen (ADR 0033). */
const RULER_NUMBER_GAP_PX = 4
/** Below this zoom a ruler drops the Ruler step and shows only its last number (ADR 0033, ticket 303); from it up the step applies. */
const LAST_NUMBER_ONLY_BELOW_ZOOM = 0.5

/** Something rulers hang from: a rectangle of beads, the line round it, and which of its sides carry numbers. */
export interface RuledBox extends Frame {
  kind: 'frame' | 'piece'
  /** How far outside its beads its line sits. */
  outset: number
  /** Every side (the Frame), or only above and to the left (a Piece). */
  sides: 'all' | 'start'
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
export type RuledProject = { frame?: Frame; beads: Parameters<typeof pieceAreasOf>[0]; technique: Technique }

/** The boxes that carry rulers: the Frame alone once it is set, otherwise every Piece area of at least 3x3 beads (those near the viewport are chosen by the caller). */
function ruledBoxes(project: RuledProject): RuledBox[] {
  if (project.frame) {
    return [{ ...project.frame, kind: 'frame', outset: FRAME_OUTSET_PX, sides: 'all' }]
  }
  return pieceAreasOf(project.beads, project.technique)
    .filter((area) => area.rows >= PIECE_AREA_MIN_BEADS && area.columns >= PIECE_AREA_MIN_BEADS)
    .map((piece) => ({ ...piece, kind: 'piece' as const, outset: PIECE_OUTSET_PX, sides: 'start' as const }))
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

/**
 * The Ruler step (ADR 0033): the smallest of 1, 5, 10, 50, 100... beads between numbers that keeps every number clear
 * of the next. `spacing` is how far apart two neighbouring beads' numbers sit on screen, `sizes` the biggest numbers'
 * boxes; two numbers are clear when one box's width or height fits in the gap along its own axis, so a ruler running
 * sideways, up or at any turn is measured the same way.
 */
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

/** How far past the band of a ruler's numbers a press still counts as on the ruler, and a quarter of it along the ruler. */
const PICK_SLACK_PX = 2

/** Below this bead pitch (px) a dot per bead would run together into a line, so only every 5th bead keeps its dot (ADR 0033). */
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
  /** Half the thickness of the band the ruler's numbers fill, across the ruler: where the dot's line sits and how far a press on the ruler reaches. */
  half: number
}

export interface RulerLayoutOptions {
  /** The numbers' size in px: 11, or 12 on a phone. */
  fontPx: number
  /** Whether the numbers and dots are drawn (the Rulers toggle). Lines and picking do not depend on it. */
  numbers: boolean
}

/** What the rulers of one view are: what to draw, and what a point of the viewport selects. */
export interface RulerLayout {
  /** Whether the numbers and dots are drawn (the Rulers toggle). */
  numbers: boolean
  /** The boxes near the viewport that carry rulers, for their lines. */
  boxes: RuledBox[]
  /** The numbers to draw: none while `numbers` is off. */
  labels: RulerLabel[]
  /** The dots to draw: the beads without a number, all of them or only every 5th below DOT_EVERY_BEAD_FROM_PX of pitch; none while `numbers` is off. */
  dots: RulerDot[]
  /**
   * The row or column a press selects, by the nearest bead on a ruler: the point is on a ruler when it is within the
   * band of its dots (the width of a number) and no further than half a bead pitch from a bead's mark. A number under
   * the point wins, so a press on it picks its own bead; everywhere else on the ruler, at 2px of pitch too, the
   * nearest bead is picked. Works whether or not the numbers are drawn.
   */
  pick(point: { x: number; y: number }): Selection | undefined
}

interface BoxLayout {
  labels: RulerLabel[]
  beads: RulerDot[]
}

/**
 * The numbers and bead marks of one ruled box that touch the viewport. Each number is placed where a grid-space point
 * just outside the box's line lands once turned and zoomed, then pushed away from the line by half the widest number's
 * size across the ruler, so the numbers stand clear of it by RULER_GAP_PX and on one line whichever way the picture is
 * turned. Dots stand on that same line. Numbers stay upright; only a column number from 100 up turns. The Ruler step
 * is worked out here once per axis.
 */
function layBox(box: RuledBox, technique: Technique, surface: SurfaceView, viewport: { width: number; height: number }, fontPx: number): BoxLayout {
  const margin = fontPx * 4
  const labels: RulerLabel[] = []
  const beads: RulerDot[] = []

  const lastRow = box.row + box.rows - 1
  const bottom = rowTopPx(technique, lastRow) + CELL_SIZE_PX
  const right = box.column * CELL_SIZE_PX + box.columns * CELL_SIZE_PX + (technique === 'loom' ? 0 : CELL_SIZE_PX / 2)
  const left = box.column * CELL_SIZE_PX

  // The widest column numbers: the longest upright one (under 100) and the longest turned one.
  const columnSizes = [labelBox(String(Math.min(box.columns, TURNED_FROM - 1)), false, fontPx)]
  if (box.columns >= TURNED_FROM) {
    columnSizes.push(labelBox(String(box.columns), true, fontPx))
  }
  const rowSize = labelBox(String(box.rows), false, fontPx)
  // Every number is centred on the line the dots stand on, so a 1-digit row number is as far from the beads as a 2-digit one.
  const columnBand = { width: Math.max(...columnSizes.map((size) => size.width)), height: Math.max(...columnSizes.map((size) => size.height)) }
  const { column: columnStepOnScreen, row: rowStepOnScreen } = surface.beadStep()
  const lastOnly = surface.zoom < LAST_NUMBER_ONLY_BELOW_ZOOM
  const columnStep = lastOnly ? box.columns : rulerStep(columnStepOnScreen, columnSizes)
  const rowStep = lastOnly ? box.rows : rulerStep(rowStepOnScreen, [rowSize])
  const columnPitch = Math.hypot(columnStepOnScreen.x, columnStepOnScreen.y)
  const rowPitch = Math.hypot(rowStepOnScreen.x, rowStepOnScreen.y)

  // Unit step outward from a side, in grid space and then once turned.
  const outward = (gridX: number, gridY: number, normal: [number, number]) => {
    const { x, y } = surface.gridToPoint(gridX, gridY)
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
    const step = column ? columnStep : rowStep
    const { x, y, nx, ny } = outward(gridX, gridY, normal)

    const dotAway = box.outset + RULER_GAP_PX + half
    const dot = { x: x + nx * dotAway, y: y + ny * dotAway }
    if (dotSeen(dot)) {
      beads.push({ ...dot, fifth: (index + 1) % 5 === 0, numbered: (index + 1) % step === 0, axis, index, selection, position, normal: [nx, ny], pitch: column ? columnPitch : rowPitch, half })
    }
    if ((index + 1) % step === 0) {
      const size = labelBox(text, turned, fontPx)
      const reach = RULER_GAP_PX + (Math.abs(nx) * (column ? band.width : rowSize.width) + Math.abs(ny) * (column ? band.height : rowSize.height)) / 2
      const spot = { x: x + nx * (box.outset + reach), y: y + ny * (box.outset + reach), ...size }
      if (seen(spot)) {
        labels.push({ text, ...spot, turned, fifth: (index + 1) % 5 === 0, axis, index, selection, position })
      }
    }
  }

  const columnsAt = (rowForShift: number, gridY: number, normal: [number, number]) => {
    for (let index = 0; index < box.columns; index += 1) {
      const gridX = rowShiftPx(technique, rowForShift) + (box.column + index) * CELL_SIZE_PX + CELL_SIZE_PX / 2
      along('column', index, gridX, gridY, normal, { top: box.row, left: box.column + index, rows: box.rows, columns: 1 }, box.column + index)
    }
  }
  const rowsAt = (gridX: number, normal: [number, number]) => {
    for (let index = 0; index < box.rows; index += 1) {
      const gridY = rowTopPx(technique, box.row + index) + CELL_SIZE_PX / 2
      along('row', index, gridX, gridY, normal, { top: box.row + index, left: box.column, rows: 1, columns: box.columns }, box.row + index)
    }
  }

  columnsAt(box.row, rowTopPx(technique, box.row), [0, -1])
  rowsAt(left, [-1, 0])
  if (box.sides === 'all') {
    columnsAt(lastRow, bottom, [0, 1])
    rowsAt(right, [1, 0])
  }
  return { labels, beads }
}

/** The label under a point of the viewport, if any: the last drawn wins where two boxes crowd. */
function labelAt(labels: readonly RulerLabel[], point: { x: number; y: number }): RulerLabel | undefined {
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const label = labels[i]!
    if (Math.abs(point.x - label.x) <= label.width / 2 + 1 && Math.abs(point.y - label.y) <= label.height / 2 + 1) {
      return label
    }
  }
  return undefined
}

/**
 * The rulers of one view of the open canvas (`surface` must be one): the boxes near the viewport that carry them, their
 * numbers and dots, and what a press selects. Drawing and picking read this one value, so they cannot disagree.
 * A surface not yet measured (a 0 by 0 viewport) has no edge to cut the numbers at.
 */
export function rulerLayout(project: RuledProject, surface: SurfaceView, { fontPx, numbers }: RulerLayoutOptions): RulerLayout {
  const measured = surface.viewport.width > 0 && surface.viewport.height > 0
  const viewport = measured ? surface.viewport : { width: Infinity, height: Infinity }
  const reach = fontPx * 4 + FRAME_OUTSET_PX + NEAR_VIEWPORT_PX
  const boxes = ruledBoxes(project).filter((box) => {
    const shown = surface.beadBox(box)
    return shown.x + shown.width > -reach && shown.x < viewport.width + reach && shown.y + shown.height > -reach && shown.y < viewport.height + reach
  })
  const laid = boxes.map((box) => layBox(box, project.technique, surface, viewport, fontPx))
  const everyLabel = laid.flatMap((box) => box.labels)
  const everyBead = laid.flatMap((box) => box.beads)

  return {
    numbers,
    boxes,
    labels: numbers ? everyLabel : [],
    dots: numbers ? everyBead.filter((dot) => !dot.numbered && (dot.fifth || dot.pitch >= DOT_EVERY_BEAD_FROM_PX)) : [],
    pick: (point) => {
      const label = labelAt(everyLabel, point)
      if (label) {
        return label.selection
      }
      let best: { along: number; selection: Selection } | undefined
      for (const dot of everyBead) {
        const dx = point.x - dot.x
        const dy = point.y - dot.y
        const [nx, ny] = dot.normal
        const across = Math.abs(dx * nx + dy * ny)
        const alongRuler = Math.abs(-dx * ny + dy * nx)
        if (across <= dot.half + RULER_GAP_PX + PICK_SLACK_PX && alongRuler <= dot.pitch / 2 + PICK_SLACK_PX / 4 && (!best || alongRuler < best.along)) {
          best = { along: alongRuler, selection: dot.selection }
        }
      }
      return best?.selection
    },
  }
}

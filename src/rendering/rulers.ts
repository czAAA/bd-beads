import type { Frame } from '../domain/canvas'
import { CELL_SIZE_PX, type Rotation, type Technique } from '../domain/grid'
import { pieceAreasOf } from '../domain/pieces'
import type { Selection } from '../domain/selection'
import type { ProjectTheme } from './beadLook'
import { displayedBox, gridToDisplayed, type Scroll, type Size } from './canvasView'
import { rowPitchPx, rowShiftPx, rowTopPx } from './projectRenderer'

/**
 * The rulers and the lines they hang from on the open canvas (Rulers and BeadBoard cards, ADR 0026): every row and
 * column number of the Frame on all four sides, or, until a Frame is set, of each Piece above and to the left of its
 * rectangle, counted from 1 at its top-left bead.
 *
 * The layout is plain geometry in viewport px, so the same labels that are drawn are the ones a click is tested
 * against, and a test can find a number the way a pointer does.
 */

/** How far a piece's rectangle and the Frame's line sit outside their outermost beads (BeadBoard and Frame cards). */
export const PIECE_OUTSET_PX = 5
export const FRAME_OUTSET_PX = 7
/** The gap between a ruler number and the line it hangs from (Rulers card). */
export const RULER_GAP_PX = 3
/** From this column number a ruler number is turned a quarter and read upward, so three digits take no more width than two (Rulers card). */
export const TURNED_FROM = 100
/** DM Mono's advance, as a share of its size: what a number's box is worked out from. */
const MONO_ADVANCE = 0.6
/** The clear space kept between two neighbouring numbers when the Ruler step is chosen (ADR 0033). */
export const RULER_NUMBER_GAP_PX = 4
/** Below this zoom a ruler drops the Ruler step and shows only its last number (ADR 0033, ticket 303); from it up the step applies. */
export const LAST_NUMBER_ONLY_BELOW_ZOOM = 0.5

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

export interface RulerView {
  technique: Technique
  rotation: Rotation
  zoom: number
  scroll: Scroll
  viewport: Size
  /** The numbers' size in px: 11, or 12 on a phone. */
  fontPx: number
}

/** The boxes that carry rulers: the Frame alone once it is set, otherwise every Piece area (those near the viewport are chosen by the caller). */
export function ruledBoxes(project: { frame?: Frame; beads: Parameters<typeof pieceAreasOf>[0]; technique: Technique }): RuledBox[] {
  if (project.frame) {
    return [{ ...project.frame, kind: 'frame', outset: FRAME_OUTSET_PX, sides: 'all' }]
  }
  return pieceAreasOf(project.beads, project.technique).map((piece) => ({ ...piece, kind: 'piece' as const, outset: PIECE_OUTSET_PX, sides: 'start' as const }))
}

/** A box's rectangle in viewport px: where its beads are, without the outset. */
export function boxOnScreen(box: Frame, view: Pick<RulerView, 'technique' | 'rotation' | 'zoom' | 'scroll'>) {
  const shown = displayedBox(view.technique, view.rotation, box, view.zoom)
  return { x: shown.x - view.scroll.x, y: shown.y - view.scroll.y, width: shown.width, height: shown.height }
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
export function rulerStep(spacing: { x: number; y: number }, sizes: readonly { width: number; height: number }[]): number {
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

/**
 * The numbers of one ruled box that touch the viewport. Each is placed where a grid-space point just outside the box's
 * line lands once turned and zoomed, then pushed away from the line by half its own size, so the number stands clear of
 * it by RULER_GAP_PX whichever way the picture is turned. Numbers stay upright; only a column number from 100 up turns.
 */
export function rulerLabels(box: RuledBox, view: RulerView): RulerLabel[] {
  const { technique, rotation, zoom, scroll, viewport, fontPx } = view
  const labels: RulerLabel[] = []
  const margin = fontPx * 4

  // Unit step outward from a side, in grid space and then once turned.
  const place = (gridX: number, gridY: number, normal: [number, number], text: string, turned: boolean) => {
    const [dx, dy] = gridToDisplayed(rotation, gridX, gridY, zoom)
    const [nx, ny] = gridToDisplayed(rotation, normal[0], normal[1], 1)
    const size = labelBox(text, turned, fontPx)
    const reach = RULER_GAP_PX + (Math.abs(nx) * size.width + Math.abs(ny) * size.height) / 2
    const x = dx - scroll.x + nx * (box.outset + reach)
    const y = dy - scroll.y + ny * (box.outset + reach)
    return { x, y, ...size }
  }
  const visible = (label: { x: number; y: number; width: number; height: number }) =>
    label.x + label.width / 2 > -margin &&
    label.x - label.width / 2 < viewport.width + margin &&
    label.y + label.height / 2 > -margin &&
    label.y - label.height / 2 < viewport.height + margin

  const lastRow = box.row + box.rows - 1
  const bottom = rowTopPx(technique, lastRow) + CELL_SIZE_PX
  const right = box.column * CELL_SIZE_PX + box.columns * CELL_SIZE_PX + (technique === 'loom' ? 0 : CELL_SIZE_PX / 2)
  const left = box.column * CELL_SIZE_PX

  const columnSelection = (column: number): Selection => ({ top: box.row, left: column, rows: box.rows, columns: 1 })
  const rowSelection = (row: number): Selection => ({ top: row, left: box.column, rows: 1, columns: box.columns })

  // The widest column numbers: the longest upright one (under 100) and the longest turned one.
  const columnSizes = [labelBox(String(Math.min(box.columns, TURNED_FROM - 1)), false, fontPx)]
  if (box.columns >= TURNED_FROM) {
    columnSizes.push(labelBox(String(box.columns), true, fontPx))
  }
  const [beadX, beadY] = gridToDisplayed(rotation, CELL_SIZE_PX, 0, zoom)
  const [rowX, rowY] = gridToDisplayed(rotation, 0, rowPitchPx(technique), zoom)
  const lastOnly = zoom < LAST_NUMBER_ONLY_BELOW_ZOOM
  const columnStep = lastOnly ? box.columns : rulerStep({ x: beadX, y: beadY }, columnSizes)
  const rowStep = lastOnly ? box.rows : rulerStep({ x: rowX, y: rowY }, [labelBox(String(box.rows), false, fontPx)])

  const columnsAt = (rowForShift: number, gridY: number, normal: [number, number]) => {
    for (let index = columnStep - 1; index < box.columns; index += columnStep) {
      const text = String(index + 1)
      const turned = index + 1 >= TURNED_FROM
      const gridX = rowShiftPx(technique, rowForShift) + (box.column + index) * CELL_SIZE_PX + CELL_SIZE_PX / 2
      const spot = place(gridX, gridY, normal, text, turned)
      if (visible(spot)) {
        labels.push({ text, ...spot, turned, fifth: (index + 1) % 5 === 0, axis: 'column', index, selection: columnSelection(box.column + index), position: box.column + index })
      }
    }
  }
  const rowsAt = (gridX: number, normal: [number, number]) => {
    for (let index = rowStep - 1; index < box.rows; index += rowStep) {
      const text = String(index + 1)
      const gridY = rowTopPx(technique, box.row + index) + CELL_SIZE_PX / 2
      const spot = place(gridX, gridY, normal, text, false)
      if (visible(spot)) {
        labels.push({ text, ...spot, turned: false, fifth: (index + 1) % 5 === 0, axis: 'row', index, selection: rowSelection(box.row + index), position: box.row + index })
      }
    }
  }

  columnsAt(box.row, rowTopPx(technique, box.row), [0, -1])
  rowsAt(left, [-1, 0])
  if (box.sides === 'all') {
    columnsAt(lastRow, bottom, [0, 1])
    rowsAt(right, [1, 0])
  }
  return labels
}

/** The label under a point of the viewport, if any: the last drawn wins where two boxes crowd. */
export function labelAt(labels: readonly RulerLabel[], point: { x: number; y: number }): RulerLabel | undefined {
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const label = labels[i]!
    if (Math.abs(point.x - label.x) <= label.width / 2 + 1 && Math.abs(point.y - label.y) <= label.height / 2 + 1) {
      return label
    }
  }
  return undefined
}

/** Every ruler number in view, for all the boxes that carry rulers and are near the viewport. */
export function visibleRulerLabels(
  project: { frame?: Frame; beads: Parameters<typeof pieceAreasOf>[0]; technique: Technique },
  view: RulerView,
): RulerLabel[] {
  const reach = view.fontPx * 4 + FRAME_OUTSET_PX + 40
  return ruledBoxes(project).flatMap((box) => {
    const shown = boxOnScreen(box, view)
    const near =
      shown.x + shown.width > -reach &&
      shown.x < view.viewport.width + reach &&
      shown.y + shown.height > -reach &&
      shown.y < view.viewport.height + reach
    return near ? rulerLabels(box, view) : []
  })
}

/** What the rulers are drawn in: the numbers and the lines. */
export type RulerTheme = Pick<ProjectTheme, 'ruler' | 'rulerStrong' | 'marker' | 'cursor' | 'frameLine' | 'pieceLine'>

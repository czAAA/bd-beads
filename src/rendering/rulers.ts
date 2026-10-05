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

/** What decides which boxes carry rulers. */
export type RuledProject = { frame?: Frame; beads: Parameters<typeof pieceAreasOf>[0]; technique: Technique }

/** The boxes that carry rulers: the Frame alone once it is set, otherwise every Piece area (those near the viewport are chosen by the caller). */
export function ruledBoxes(project: RuledProject): RuledBox[] {
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
  const columnStep = rulerStep({ x: beadX, y: beadY }, columnSizes)
  const [rowX, rowY] = gridToDisplayed(rotation, 0, rowPitchPx(technique), zoom)
  const rowStep = rulerStep({ x: rowX, y: rowY }, [labelBox(String(box.rows), false, fontPx)])

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

/** How far outside the viewport a box still counts as near it. */
const NEAR_VIEWPORT_PX = 40

/** How far past the band of a ruler's numbers a press still counts as on the ruler, and a quarter of it along the ruler. */
const PICK_SLACK_PX = 2

/** Below this bead pitch (px) a dot per bead would run together into a line, so only every 5th bead keeps its dot (ADR 0033). */
export const DOT_EVERY_BEAD_FROM_PX = 6

/** A bead's mark on a ruler: where it sits in the viewport, and what a click on it selects. */
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

/**
 * Every bead of one ruled box that touches the viewport, as a mark on each of its rulers, with the Ruler step's numbered
 * ones flagged. Dots stand on the line the numbers' centres follow. The pick walks all of them; the drawing keeps the
 * unnumbered ones (see `rulerDots`).
 */
export function rulerBeads(box: RuledBox, view: RulerView): RulerDot[] {
  const { technique, rotation, zoom, scroll, viewport, fontPx } = view
  const margin = fontPx * 4
  const dots: RulerDot[] = []

  const lastRow = box.row + box.rows - 1
  const bottom = rowTopPx(technique, lastRow) + CELL_SIZE_PX
  const right = box.column * CELL_SIZE_PX + box.columns * CELL_SIZE_PX + (technique === 'loom' ? 0 : CELL_SIZE_PX / 2)
  const left = box.column * CELL_SIZE_PX

  const [beadX, beadY] = gridToDisplayed(rotation, CELL_SIZE_PX, 0, zoom)
  const columnSizes = [labelBox(String(Math.min(box.columns, TURNED_FROM - 1)), false, fontPx)]
  if (box.columns >= TURNED_FROM) {
    columnSizes.push(labelBox(String(box.columns), true, fontPx))
  }
  const columnStep = rulerStep({ x: beadX, y: beadY }, columnSizes)
  const columnPitch = Math.hypot(beadX, beadY)
  const [rowX, rowY] = gridToDisplayed(rotation, 0, rowPitchPx(technique), zoom)
  const rowStep = rulerStep({ x: rowX, y: rowY }, [labelBox(String(box.rows), false, fontPx)])
  const rowPitch = Math.hypot(rowX, rowY)

  // The band the numbers fill across each ruler: a row number's width, a turned column number's height, else the font size.
  const columnHalf = Math.max(...columnSizes.map((size) => size.height)) / 2
  const rowHalf = labelBox(String(box.rows), false, fontPx).width / 2

  const dotAt = (gridX: number, gridY: number, normal: [number, number], half: number) => {
    const [dx, dy] = gridToDisplayed(rotation, gridX, gridY, zoom)
    const [nx, ny] = gridToDisplayed(rotation, normal[0], normal[1], 1)
    const away = box.outset + RULER_GAP_PX + half
    return { x: dx - scroll.x + nx * away, y: dy - scroll.y + ny * away, normal: [nx, ny] as [number, number] }
  }
  const visible = (spot: { x: number; y: number }) => spot.x > -margin && spot.x < viewport.width + margin && spot.y > -margin && spot.y < viewport.height + margin

  const columnsAt = (rowForShift: number, gridY: number, normal: [number, number]) => {
    for (let index = 0; index < box.columns; index += 1) {
      const gridX = rowShiftPx(technique, rowForShift) + (box.column + index) * CELL_SIZE_PX + CELL_SIZE_PX / 2
      const spot = dotAt(gridX, gridY, normal, columnHalf)
      if (visible(spot)) {
        const selection: Selection = { top: box.row, left: box.column + index, rows: box.rows, columns: 1 }
        dots.push({ ...spot, fifth: (index + 1) % 5 === 0, numbered: (index + 1) % columnStep === 0, axis: 'column', index, selection, position: box.column + index, pitch: columnPitch, half: columnHalf })
      }
    }
  }
  const rowsAt = (gridX: number, normal: [number, number]) => {
    for (let index = 0; index < box.rows; index += 1) {
      const spot = dotAt(gridX, rowTopPx(technique, box.row + index) + CELL_SIZE_PX / 2, normal, rowHalf)
      if (visible(spot)) {
        const selection: Selection = { top: box.row + index, left: box.column, rows: 1, columns: box.columns }
        dots.push({ ...spot, fifth: (index + 1) % 5 === 0, numbered: (index + 1) % rowStep === 0, axis: 'row', index, selection, position: box.row + index, pitch: rowPitch, half: rowHalf })
      }
    }
  }

  columnsAt(box.row, rowTopPx(technique, box.row), [0, -1])
  rowsAt(left, [-1, 0])
  if (box.sides === 'all') {
    columnsAt(lastRow, bottom, [0, 1])
    rowsAt(right, [1, 0])
  }
  return dots
}

/** The boxes' beads without a number that are drawn as a Ruler dot: all of them, or only every 5th below DOT_EVERY_BEAD_FROM_PX of pitch. */
export function rulerDots(box: RuledBox, view: RulerView): RulerDot[] {
  return rulerBeads(box, view).filter((dot) => !dot.numbered && (dot.fifth || dot.pitch >= DOT_EVERY_BEAD_FROM_PX))
}

/** The boxes near the viewport that carry rulers. */
function nearBoxes(project: RuledProject, view: RulerView): RuledBox[] {
  const reach = view.fontPx * 4 + FRAME_OUTSET_PX + NEAR_VIEWPORT_PX
  return ruledBoxes(project).filter((box) => {
    const shown = boxOnScreen(box, view)
    return shown.x + shown.width > -reach && shown.x < view.viewport.width + reach && shown.y + shown.height > -reach && shown.y < view.viewport.height + reach
  })
}

/** Every Ruler dot in view, for all the boxes that carry rulers and are near the viewport. */
export function visibleRulerDots(project: RuledProject, view: RulerView): RulerDot[] {
  return nearBoxes(project, view).flatMap((box) => rulerDots(box, view))
}

/**
 * The row or column a press on a ruler selects, by the nearest bead along it: the pointer is on a ruler when it is
 * within the band of its dots (the width of a number) and no further than half a bead pitch from a bead's mark. A
 * number under the pointer wins, so a click on it picks its own bead; everywhere else on the ruler, at 2px of pitch too,
 * the nearest bead is picked.
 */
export function rulerPick(
  project: RuledProject,
  view: RulerView,
  labels: readonly RulerLabel[],
  point: { x: number; y: number },
): Selection | undefined {
  const label = labelAt(labels, point)
  if (label) {
    return label.selection
  }
  let best: { along: number; selection: Selection } | undefined
  for (const box of nearBoxes(project, view)) {
    for (const dot of rulerBeads(box, view)) {
      const dx = point.x - dot.x
      const dy = point.y - dot.y
      const [nx, ny] = dot.normal
      const across = Math.abs(dx * nx + dy * ny)
      const along = Math.abs(-dx * ny + dy * nx)
      if (across <= dot.half + RULER_GAP_PX + PICK_SLACK_PX && along <= dot.pitch / 2 + PICK_SLACK_PX / 4 && (!best || along < best.along)) {
        best = { along, selection: dot.selection }
      }
    }
  }
  return best?.selection
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
  project: RuledProject,
  view: RulerView,
): RulerLabel[] {
  const reach = view.fontPx * 4 + FRAME_OUTSET_PX + NEAR_VIEWPORT_PX
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

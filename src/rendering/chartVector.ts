import { BLACK_WHITE_BALANCE, fromHex, mix, relativeLuminance, toHex, WHITE } from '../domain/color'
import { HELVETICA_CAP_HEIGHT, helveticaWidth } from '../domain/helvetica'
import type { PageDrawing } from '../domain/pdfContent'
import type { SwatchLetters } from '../domain/swatchLetters'
import { beadRoundness, describeWeave } from '../domain/weave'
import { frameWeave } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { acrossNumber, displayedCellOf, downNumber, emptyCrossArms, RULER_FIT } from './printPages'
import { PRINT_COLORS } from './printColors'
import { areaRegion, displayedGrid, mm, PRINT_DPI, PRINT_MARGIN, PRINT_HEADER, PRINT_HEADER_GAP, PRINT_PART_LABEL, PRINT_RULER, type PrintPart, type PrintPlan } from './printPlan'
import { beadInSpace, geometryDrawnAlone, spaceOf } from './space'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { gridToRegion, inGridPx, regionInGridSpace } from './surfaceView'
import { chartCellOf, customChart, type ChartBead } from './customChart'
import type { LayoutPoint } from '../domain/frameLayout'
import { type Layered, quarterTurnOf } from '../domain/layerRecord'
import type { PrintText } from './printText'

// A chart as drawing (ticket 0585, ADR 0043; PrintChartPage card): PDF operators on a chart page and page 1, sharp at any
// zoom, and the same calls painted on the PNG's canvas (ticket 0915). The Layer geometry places every bead of every
// Technique (ticket 0630) and this draws what it is told. Layout is in the plan's px (150 dpi); the drawing is in points.

/** Points per layout px, and per millimetre. */
export const K = 72 / PRINT_DPI
export const mmPt = (value: number) => (value * 72) / 25.4

const LINE_CELL = mmPt(0.1)
/** `print-line-five`: a Custom frame's Seams. */
const LINE_FIVE = mmPt(0.18)
/** `print-pad-line` and `print-pad-radius`: the chart's one rim (ticket 1126). */
const PAD_LINE = mmPt(0.2)
const PAD_RADIUS = mmPt(2)
const OVERLAP_LINE = mmPt(0.5)
/** `print-letter`, in points: the most a ruler number takes, and the Swatch letter on a 3 mm bead. The share of its bead
 * a round bead's circle takes (2.6 of 3 mm). */
const LETTER_PT = 6.5
const ROUND_SHARE = 2.6 / 3
/** The key's swatch, drawn like a 3 mm bead whatever the chart's bead. */
const KEY_SWATCH_MM = 3
/** How far a column number's baseline stands above the chart (its cap top below it at the bottom), and a row number
 * from its side, in mm. */
const COLUMN_NUMBER_GAP_MM = 1.5
const ROW_NUMBER_GAP_MM = 1.3
/** `print-rim-gap`, in mm: how far the rim stands clear of the outermost beads (ticket 1126). */
const RIM_GAP_MM = 1
/** The room a row number has in its band, in mm: `print-ruler` less the rim's gap and its own (2.7 mm). */
const ROW_NUMBER_ROOM_MM = PRINT_RULER / mm(1) - RIM_GAP_MM - ROW_NUMBER_GAP_MM
/** `print-overlap-tint`: how far toward white an overlap bead is mixed. */
const OVERLAP_TINT = 0.6
/** `--print-letter-squeeze`: horizontal scale of a two-letter Swatch letter. */
const LETTER_SQUEEZE = 72

/** The Swatch letter's size on a bead of `beadMm` (ticket 0913): `print-letter` on 3 mm, scaled with the bead, its cap
 * height a little more of a small bead (0.6 at 1.8 mm, 0.55 from 3 mm) so it still reads: about 4.3 pt at 1.8 mm.
 * @internal Its test checks the sizes on their own. */
export function letterPt(beadMm: number): number {
  const share = 0.6 - 0.05 * Math.min(1, Math.max(0, (beadMm - 1.8) / 1.2))
  return (LETTER_PT * (beadMm / 3) * share) / 0.55
}

/** A color mixed toward white. */
function tint(hex: string, amount: number): string {
  const rgb = fromHex(hex)
  return rgb ? toHex(mix(rgb, WHITE, amount)) : hex
}

/** The colour of a Swatch letter on a bead of this color: `ink` on a light one, white on a dark one, by the same
 * balance as markOn (`--print-letter-balance`); ink on a color it cannot read.
 * @internal Its test checks the switch from ink to white on its own. */
export function letterColor(hex: string): string {
  const rgb = fromHex(hex)
  return !rgb || relativeLuminance(rgb) > BLACK_WHITE_BALANCE ? PRINT_COLORS.ink : PRINT_COLORS.paper
}

/** Whether the Project's beads are drawn round (a circle in the cell) rather than as squares. */
export function beadsAreRound(project: Layered): boolean {
  const weave = frameWeave(project)
  return beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX >= CELL_SIZE_PX * 0.4
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** One position of a part as the renderer placed it, in px from the part's top left corner. */
interface PlacedBead {
  /** The bead's own rectangle. */
  box: Box
  /** Its cell: where the lines run, a half bead over in an offset row or column. */
  cell: Box
  color: string | null
  /** Its place in the displayed chart, counted from the part's first column and row (the overlap's included). */
  across: number
  down: number
}

/** The positions of a part, bead by bead, for any Technique, rotation or Bead: each bead in view where the Layer
 * geometry places it, through the page's transform.
 * @internal Its test checks where each bead lands on its own. */
export function placeBeads(project: Project, plan: PrintPlan, part: PrintPart): PlacedBead[] {
  const first = { across: part.firstAcross - part.overlapAcross, down: part.firstDown - part.overlapDown }
  const last = { across: part.lastAcross - first.across, down: part.lastDown - first.down }
  const weave = frameWeave(project)
  const description = describeWeave(weave)
  const size = cellSizePx(weave.technique, weave.cell)
  const space = spaceOf(project, false)
  const matrix = gridToRegion(space.extent, part.region, plan.zoom, quarterTurnOf(project))
  const [a, b, c, d, e, f] = matrix
  const at = (x: number, y: number): [number, number] => [a * x + c * y + e, b * x + d * y + f]
  const rectOf = (x: number, y: number, width: number, height: number): Box => {
    const [x1, y1] = at(x, y)
    const [x2, y2] = at(x + width, y + height)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
  }
  const geometry = geometryDrawnAlone(project)
  const seen = regionInGridSpace(space.extent, part.region, plan.zoom, quarterTurnOf(project))
  const inView = { x: seen.left / CELL_SIZE_PX, y: seen.top / CELL_SIZE_PX, width: (seen.right - seen.left) / CELL_SIZE_PX, height: (seen.bottom - seen.top) / CELL_SIZE_PX }
  const placed: PlacedBead[] = []
  for (const position of geometry.positionsIn(inView)) {
    const { x, y, width, height } = inGridPx(geometry.place(position)!.box)
    const box = rectOf(x, y, width, height)
    // A bead's cell ends where the bead below it starts. Its position names its column and row, through the turn, so a
    // staggered row (brick stitch) or column (peyote, ticket 0734) stays in its own (ticket 1122).
    const below = { row: position.row + 1, column: position.column }
    const share = Math.min(height, description.box(below, size.width, size.height).y - y)
    const cell = rectOf(x, y, width, share)
    const shown = displayedCellOf(project, position)
    const across = shown.across - first.across
    const down = shown.down - first.down
    // Beads past the part's edge belong to its neighbour.
    if (across < 0 || down < 0 || across > last.across || down > last.down) continue
    placed.push({ box, cell, color: beadInSpace(project, space, position.row, position.column), across, down })
  }
  return placed
}

/** Line segments `[x1, y1, x2, y2]` along cell edges, collinear neighbours joined into one. */
class Edges {
  private readonly runs = { h: new Map<number, [number, number][]>(), v: new Map<number, [number, number][]>() }

  add(horizontal: boolean, at: number, from: number, to: number) {
    const lines = horizontal ? this.runs.h : this.runs.v
    const key = Math.round(at * 100)
    const run = lines.get(key) ?? []
    run.push([Math.min(from, to), Math.max(from, to)])
    lines.set(key, run)
  }

  segments(x: number, y: number): [number, number, number, number][] {
    const out: [number, number, number, number][] = []
    for (const [horizontal, lines] of [[true, this.runs.h], [false, this.runs.v]] as const) {
      for (const [key, run] of lines) {
        const at = key / 100
        const sorted = [...run].sort((p, q) => p[0] - q[0])
        let [from, to] = sorted[0]!
        const flush = () => out.push(horizontal ? [x + from, y + at, x + to, y + at] : [x + at, y + from, x + at, y + to])
        for (const [start, end] of sorted.slice(1)) {
          if (start <= to + 0.05) {
            to = Math.max(to, end)
          } else {
            flush()
            ;[from, to] = [start, end]
          }
        }
        flush()
      }
    }
    return out.map(([x1, y1, x2, y2]) => [x1 * K, y1 * K, x2 * K, y2 * K])
  }
}

const SHARED_LABEL = PRINT_PART_LABEL

/** Where a chart page's chart area begins, under its header; page 1's begins under its title block (ticket 0914). */
const CHART_PAGE_AREA = { x: PRINT_MARGIN, y: PRINT_MARGIN + PRINT_HEADER + PRINT_HEADER_GAP }

/** Where a part's pad sits on the page, in px: its top left corner and size (rulers included). */
function padOf(part: PrintPart, shared: boolean, area: { x: number; y: number }): Box {
  return {
    x: area.x + part.place.x,
    y: area.y + part.place.y + (shared ? SHARED_LABEL : 0),
    width: part.region.width + PRINT_RULER * 2,
    height: part.region.height + PRINT_RULER * 2,
  }
}

/** The share of its cell's width a Swatch letter may take, so a two-letter one stays inside it. */
const LETTER_ROOM = 0.9

/** A Swatch letter set centred in a box at `size` pt, or smaller where it would be wider than the box: Helvetica-Bold,
 * its baseline the cap height's half below the middle. */
function letterAt(content: PageDrawing, letter: string, box: Box, color: string, largest: number): void {
  const squeeze = letter.length > 1 ? LETTER_SQUEEZE : 100
  const wide = (helveticaWidth(letter, 'bold', largest) * squeeze) / 100
  const size = Math.min(largest, (largest * box.width * K * LETTER_ROOM) / wide)
  const x = (box.x + box.width / 2) * K
  const baseline = (box.y + box.height / 2) * K + (HELVETICA_CAP_HEIGHT * size) / 2
  content.text(letter, x, baseline, { face: 'bold', size, color, ...(letter.length > 1 ? { scale: squeeze } : {}) }, 'center')
}

/** A swatch drawn like a bead on the page: its fill, a hairline edge and its letter (the key's). */
export function drawKeySwatch(content: PageDrawing, x: number, y: number, hex: string, letter: string, round: boolean): void {
  const size = mm(KEY_SWATCH_MM)
  const inset = round ? (size * (1 - ROUND_SHARE)) / 2 : 0
  content.roundRect((x + inset) * K, (y + inset) * K, (size - inset * 2) * K, (size - inset * 2) * K, round ? size : 0, { fill: hex, stroke: PRINT_COLORS.lineStrong, lineWidth: LINE_CELL })
  letterAt(content, letter, { x, y, width: size, height: size }, letterColor(hex), letterPt(KEY_SWATCH_MM))
}

/** What a chart draws besides its colored beads (PrintChartPage card): the one rim round them (ticket 1126) and the empty
 * positions' outline and cross, as the Export panel's Chart border and Empty grid say (ticket 1127). */
interface ChartLook {
  rim: boolean
  emptyGrid: boolean
}

/** The switches as they start: the rim on, the empty positions bare paper. */
const DEFAULT_LOOK: ChartLook = { rim: true, emptyGrid: false }

/** The chart's look in an export's words (ticket 1127): Chart border shows the rim, Empty grid the empty positions. */
export function chartLookOf(words: Pick<PrintText, 'emptyGrid' | 'chartBorder'>): ChartLook {
  return { rim: !!words.chartBorder, emptyGrid: !!words.emptyGrid }
}

/** A box grown by `by` on every side. */
function outset(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, width: box.width + by * 2, height: box.height + by * 2 }
}

/** One part: its rim, beads, their borders, letters, rulers (their numbers at the page's `rulerPt`, outside the rim) and the
 * overlap line, on the page at `pad`. */
function drawPart(content: PageDrawing, project: Project, plan: PrintPlan, part: PrintPart, pad: Box, letters: SwatchLetters, rulerPt: number, look: ChartLook): void {
  const grid = displayedGrid(project)
  const stepAcross = grid.stepAcross * plan.zoom
  const stepDown = grid.stepDown * plan.zoom
  const chart: Box = { x: pad.x + PRINT_RULER, y: pad.y + PRINT_RULER, width: part.region.width, height: part.region.height }
  const lastAcross = part.lastAcross - (part.firstAcross - part.overlapAcross)
  const lastDown = part.lastDown - (part.firstDown - part.overlapDown)
  const firstIndexAcross = part.firstAcross - part.overlapAcross
  const firstIndexDown = part.firstDown - part.overlapDown
  const inOverlap = (bead: PlacedBead) => bead.across < part.overlapAcross || bead.down < part.overlapDown

  // The chart's one rim, `print-rim-gap` clear of its outermost beads; the ruler numbers stand outside it (ticket 1126).
  const rim = outset(chart, mm(RIM_GAP_MM))
  if (look.rim) content.roundRect(rim.x * K, rim.y * K, rim.width * K, rim.height * K, PAD_RADIUS, { stroke: PRINT_COLORS.faint, lineWidth: PAD_LINE })

  const custom = customChart(project, part.region, plan.zoom)
  if (custom) {
    const trimmed = areaRegion(project, plan.trim)
    const whole = { x: trimmed.x * plan.zoom - part.region.x, y: trimmed.y * plan.zoom - part.region.y, width: trimmed.width * plan.zoom, height: trimmed.height * plan.zoom }
    drawCustomPart(content, project, part, chart, custom, letters, { across: stepAcross, down: stepDown }, letterPt(plan.beadMm), look.emptyGrid && whole)
    drawOverlapLine(content, part, pad, chart, stepAcross, stepDown)
    return
  }

  const beads = placeBeads(project, plan, part)
  const round = beadsAreRound(project)

  // Fills, one colour after another.
  const filled = beads.filter((bead) => bead.color !== null).sort((p, q) => (p.color! < q.color! ? -1 : 1))
  for (const bead of filled) {
    const fill = inOverlap(bead) ? tint(bead.color!, OVERLAP_TINT) : bead.color!
    // A square bead fills its cell, so staggered beads don't overlap.
    const { x, y, width, height } = round ? bead.box : bead.cell
    const inset = round ? (Math.min(width, height) * (1 - ROUND_SHARE)) / 2 : 0
    const left = (chart.x + x + inset) * K
    const top = (chart.y + y + inset) * K
    const wide = (width - inset * 2) * K
    const tall = (height - inset * 2) * K
    if (round) {
      content.roundRect(left, top, wide, tall, Math.min(wide, tall), { fill, stroke: PRINT_COLORS.lineStrong, lineWidth: LINE_CELL })
    } else {
      content.fillRect(left, top, wide, tall, fill)
    }
  }

  // Over the fills, each square bead's own border round its cell (ticket 1126), an empty one's too while Empty grid is on;
  // a shared edge is one hairline. No line every 5th or 10th and no edge: a round bead carries its circle's alone.
  const borders = new Edges()
  for (const { cell, color } of beads) {
    if (round || (color === null && !look.emptyGrid)) continue
    borders.add(false, cell.x, cell.y, cell.y + cell.height)
    borders.add(false, cell.x + cell.width, cell.y, cell.y + cell.height)
    borders.add(true, cell.y, cell.x, cell.x + cell.width)
    borders.add(true, cell.y + cell.height, cell.x, cell.x + cell.width)
  }
  content.lines(borders.segments(chart.x, chart.y), LINE_CELL, PRINT_COLORS.lineStrong)

  // An empty position's small faint cross (ticket 0818), on the paper the fills leave.
  content.lines(beads.filter((bead) => bead.color === null && look.emptyGrid).flatMap((bead) => {
    const { x, y, width, height } = round ? bead.box : bead.cell
    return emptyCross(chart.x + x + width / 2, chart.y + y + height / 2, Math.min(width, height))
  }), LINE_CELL, PRINT_COLORS.faint)

  // Letters over the lines: every bead carries its Swatch letter, whether the Letters toggle is on or not.
  for (const bead of beads) {
    if (bead.color === null) continue
    const { x, y, width, height } = round ? bead.box : bead.cell
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + x, y: chart.y + y, width, height }, inOverlap(bead) ? PRINT_COLORS.muted : letterColor(bead.color), letterPt(plan.beadMm))
  }

  drawOverlapLine(content, part, pad, chart, stepAcross, stepDown)

  // Rulers: every row and column numbered (ticket 1129), outside the rim, where they stay with Chart border off (1126).
  const columns = Array.from({ length: lastAcross + 1 }, (_, index) => ({
    value: acrossNumber(plan.trim, firstIndexAcross + index),
    at: chart.x + index * stepAcross + (grid.beadAcross * plan.zoom) / 2,
    overlap: index < part.overlapAcross,
  }))
  const rows = Array.from({ length: lastDown + 1 }, (_, index) => ({
    value: downNumber(plan.trim, firstIndexDown + index),
    at: chart.y + index * stepDown + (grid.beadDown * plan.zoom) / 2,
    overlap: index < part.overlapDown,
  }))
  drawRulerNumbers(content, rim, columns, rows, rulerPt)
}

/** One number on a part's ruler: its printed number, the middle of its column or row in px, and whether it is the overlap. */
interface RulerNumber {
  value: number
  at: number
  overlap: boolean
}

/** The one size of a page's ruler numbers (PrintChartPage card): the largest, at most `print-letter`, at which its widest
 * column number fits `print-ruler-fit` of a column and its widest row number's digits of a row, and its band's width.
 * @internal Its test checks the card's sizes on their own. */
export function rulerNumberPt(project: Layered, plan: PrintPlan, parts: readonly PrintPart[]): number {
  const grid = displayedGrid(project)
  const widestColumn = String(Math.max(...parts.map((part) => acrossNumber(plan.trim, part.lastAcross))))
  const widestRow = String(Math.max(...parts.map((part) => downNumber(plan.trim, part.lastDown))))
  const columnPt = grid.stepAcross * plan.zoom * K
  const rowPt = grid.stepDown * plan.zoom * K
  return Math.min(
    LETTER_PT,
    (RULER_FIT * columnPt) / helveticaWidth(widestColumn, 'regular', 1),
    (RULER_FIT * rowPt) / HELVETICA_CAP_HEIGHT,
    mmPt(ROW_NUMBER_ROOM_MM) / helveticaWidth(widestRow, 'regular', 1),
  )
}

/** A part's ruler numbers round `edge`, the chart's rim (PrintChartPage card, Rulers), Helvetica regular `muted` (the
 * overlap `faint`): a column centred, 1.5 mm out from `edge`; a row on its letter baseline, 1.3 mm out. */
function drawRulerNumbers(content: PageDrawing, edge: Box, columns: readonly RulerNumber[], rows: readonly RulerNumber[], size: number): void {
  const cap = HELVETICA_CAP_HEIGHT * size
  const number = ({ value, overlap }: RulerNumber, x: number, baseline: number, align: 'left' | 'center' | 'right') =>
    content.text(String(value), x, baseline, { face: 'regular', size, color: overlap ? PRINT_COLORS.faint : PRINT_COLORS.muted }, align)
  for (const column of columns) {
    number(column, column.at * K, (edge.y - mm(COLUMN_NUMBER_GAP_MM)) * K, 'center')
    number(column, column.at * K, (edge.y + edge.height + mm(COLUMN_NUMBER_GAP_MM)) * K + cap, 'center')
  }
  for (const row of rows) {
    const baseline = row.at * K + cap / 2
    number(row, (edge.x - mm(ROW_NUMBER_GAP_MM)) * K, baseline, 'right')
    number(row, (edge.x + edge.width + mm(ROW_NUMBER_GAP_MM)) * K, baseline, 'left')
  }
}

/** Where the part itself begins: the line past the overlap it repeats from the part before. */
function drawOverlapLine(content: PageDrawing, part: PrintPart, pad: Box, chart: Box, stepAcross: number, stepDown: number): void {
  const seam: [number, number, number, number][] = []
  if (part.overlapAcross) seam.push([(chart.x + part.overlapAcross * stepAcross) * K, pad.y * K, (chart.x + part.overlapAcross * stepAcross) * K, (pad.y + pad.height) * K])
  if (part.overlapDown) seam.push([pad.x * K, (chart.y + part.overlapDown * stepDown) * K, (pad.x + pad.width) * K, (chart.y + part.overlapDown * stepDown) * K])
  content.lines(seam, OVERLAP_LINE, PRINT_COLORS.accent)
}

/** A segment cut to a box, or none where it misses it (Liang–Barsky). */
function clippedTo(box: Box, [from, to]: readonly [LayoutPoint, LayoutPoint]): [number, number, number, number] | undefined {
  const dx = to.x - from.x
  const dy = to.y - from.y
  let start = 0
  let end = 1
  for (const [p, q] of [[-dx, from.x - box.x], [dx, box.x + box.width - from.x], [-dy, from.y - box.y], [dy, box.y + box.height - from.y]] as const) {
    if (p === 0) {
      if (q < 0) return undefined
      continue
    }
    const r = q / p
    if (p < 0) start = Math.max(start, r)
    else end = Math.min(end, r)
  }
  return start <= end ? [from.x + start * dx, from.y + start * dy, from.x + end * dx, from.y + end * dy] : undefined
}

/** An empty position's cross (ticket 0818; the overview's, ticket 0719), centred at `x`, `y` in layout px, in points. */
function emptyCross(x: number, y: number, size: number): [number, number, number, number][] {
  return emptyCrossArms(x * K, y * K, size * K)
}

/** Whether a Custom frame's bead, as drawn (a turned square, or a round bead's circle), lies wholly inside `box`. */
function beadWithin(bead: ChartBead, round: boolean, box: Box): boolean {
  const inside = (x: number, y: number) => x >= box.x - 1e-6 && x <= box.x + box.width + 1e-6 && y >= box.y - 1e-6 && y <= box.y + box.height + 1e-6
  if (round) {
    const half = (Math.min(bead.width, bead.height) * ROUND_SHARE) / 2
    return inside(bead.x - half, bead.y - half) && inside(bead.x + half, bead.y + half)
  }
  const cos = Math.cos(bead.angle)
  const sin = Math.sin(bead.angle)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([across, out]) => {
    const [dx, dy] = [(across! * bead.width) / 2, (out! * bead.height) / 2]
    return inside(bead.x + dx * cos - dy * sin, bead.y + dx * sin + dy * cos)
  })
}

/** A Custom frame's part (ticket 0594): each bead whose centre falls in the part's cells, turned, its letter upright; with
 * Empty grid on, each empty position wholly inside `emptyWithin` (the trimmed chart's box, ticket 1127) outlined with its
 * cross; its Seams as lines. No cell lines or rulers: its beads keep no rows and columns. */
function drawCustomPart(content: PageDrawing, project: Project, part: PrintPart, chart: Box, custom: NonNullable<ReturnType<typeof customChart>>, letters: SwatchLetters, step: { across: number; down: number }, letterSize: number, emptyWithin: Box | false): void {
  // A part's region reaches past its last cell by a staggered Weave's half bead, onto the next part's: each bead belongs
  // to the part whose cells hold its centre, as the page's key counts it, so none is printed on two pages (ticket 1132).
  const cellOf = (bead: ChartBead) => chartCellOf({ x: part.region.x + bead.x, y: part.region.y + bead.y }, step.across, step.down)
  const own = (bead: ChartBead) => {
    const { across, down } = cellOf(bead)
    return across >= part.firstAcross - part.overlapAcross && across <= part.lastAcross && down >= part.firstDown - part.overlapDown && down <= part.lastDown
  }
  const inOverlap = (bead: ChartBead) => {
    const { across, down } = cellOf(bead)
    return across < part.firstAcross || down < part.firstDown
  }
  const round = beadsAreRound(project)
  const beads = custom.beads.filter((bead) => own(bead) && (bead.color !== null || (emptyWithin && beadWithin(bead, round, emptyWithin))))
  for (const bead of beads) {
    const fill = bead.color === null ? undefined : inOverlap(bead) ? tint(bead.color, OVERLAP_TINT) : bead.color
    const paint = { ...(fill ? { fill } : {}), stroke: fill ? PRINT_COLORS.lineStrong : PRINT_COLORS.faint, lineWidth: LINE_CELL }
    if (round) {
      const size = Math.min(bead.width, bead.height) * ROUND_SHARE
      content.roundRect((chart.x + bead.x - size / 2) * K, (chart.y + bead.y - size / 2) * K, size * K, size * K, size * K, paint)
      continue
    }
    const cos = Math.cos(bead.angle)
    const sin = Math.sin(bead.angle)
    const corner = (across: number, out: number): [number, number] => [(chart.x + bead.x + across * cos - out * sin) * K, (chart.y + bead.y + across * sin + out * cos) * K]
    const halfWide = bead.width / 2
    const halfDeep = bead.height / 2
    content.polygon([corner(-halfWide, -halfDeep), corner(halfWide, -halfDeep), corner(halfWide, halfDeep), corner(-halfWide, halfDeep)], paint)
  }
  const local = { x: 0, y: 0, width: part.region.width, height: part.region.height }
  const seams = custom.seams.flatMap((seam) => {
    const cut = clippedTo(local, seam)
    return cut ? [[(chart.x + cut[0]) * K, (chart.y + cut[1]) * K, (chart.x + cut[2]) * K, (chart.y + cut[3]) * K] as [number, number, number, number]] : []
  })
  content.lines(seams, LINE_FIVE, PRINT_COLORS.fieldLine)
  content.lines(beads.filter((bead) => bead.color === null).flatMap((bead) => emptyCross(chart.x + bead.x, chart.y + bead.y, Math.min(bead.width, bead.height))), LINE_CELL, PRINT_COLORS.faint)
  for (const bead of beads) {
    if (bead.color === null) continue
    const size = Math.min(bead.width, bead.height)
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + bead.x - size / 2, y: chart.y + bead.y - size / 2, width: size, height: size }, inOverlap(bead) ? PRINT_COLORS.muted : letterColor(bead.color), letterSize)
  }
}

/** Every part on a chart page, or page 1's whole chart from `area`'s top left corner, into `content` (PDF operators, or the
 * PNG's canvas), and where each pad sits (the caller's labels and key go by them), in the `look` the export's switches give. */
export function drawChartParts(content: PageDrawing, project: Project, plan: PrintPlan, parts: PrintPart[], letters: SwatchLetters, area = CHART_PAGE_AREA, look = DEFAULT_LOOK): Box[] {
  const shared = parts.length > 1
  const pads = parts.map((part) => padOf(part, shared, area))
  // One size for every ruler number on the page, its parts or strips together.
  const rulerPt = rulerNumberPt(project, plan, parts)
  parts.forEach((part, index) => drawPart(content, project, plan, part, pads[index]!, letters, rulerPt, look))
  return pads
}

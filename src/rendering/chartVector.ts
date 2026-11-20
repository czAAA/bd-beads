import { fromHex, mix, toHex, WHITE } from '../domain/color'
import { HELVETICA_CAP_HEIGHT, helveticaWidth } from '../domain/helvetica'
import type { PageDrawing } from '../domain/pdfContent'
import type { SwatchLetters } from '../domain/swatchLetters'
import { beadRoundness, describeWeave } from '../domain/weave'
import { frameWeave } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { acrossNumber, displayedCellOf, downNumber, emptyCrossArms, lineBetween, rulerLevel } from './printPages'
import type { PrintInk } from './printInk'
import { displayedGrid, mm, PRINT_DPI, PRINT_MARGIN, PRINT_HEADER, PRINT_HEADER_GAP, PRINT_PART_LABEL, PRINT_RULER, type PrintPart, type PrintPlan } from './printPlan'
import { beadInSpace, geometryDrawnAlone, spaceOf } from './space'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { gridToRegion, inGridPx, regionInGridSpace } from './surfaceView'
import { chartCellOf, customChart, type ChartBead } from './customChart'
import type { LayoutPoint } from '../domain/frameLayout'
import { type Layered, quarterTurnOf } from '../domain/layerRecord'

// A chart as drawing (ticket 0585, ADR 0043; PrintChartPage card): PDF operators on a chart page and page 1, sharp at any
// zoom, and the same calls painted on the PNG's canvas (ticket 0915). The Layer geometry places every bead of every
// Technique (ticket 0630) and this draws what it is told. Layout is in the plan's px (150 dpi); the drawing is in points.

/** Points per layout px, and per millimetre. */
export const K = 72 / PRINT_DPI
export const mmPt = (value: number) => (value * 72) / 25.4

const LINE_CELL = mmPt(0.1)
const LINE_FIVE = mmPt(0.18)
const LINE_TEN = mmPt(0.3)
const PAD_LINE = mmPt(0.2)
const OVERLAP_LINE = mmPt(0.5)
/** `print-letter`, in points: the ruler numbers, and the Swatch letter on a 3 mm bead. The share of its bead a round
 * bead's circle takes (2.6 of 3 mm). */
const LETTER_PT = 6.5
const ROUND_SHARE = 2.6 / 3
/** The key's swatch, drawn like a 3 mm bead whatever the chart's bead. */
const KEY_SWATCH_MM = 3
/** Rulers number every 5th row and column from this bead up, and every 10th under it (ticket 0913). */
const RULER_FIVES_FROM_MM = 2.2
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

/** A Swatch letter set centred in a box at `size` pt, or smaller where it would be wider than the box: Helvetica-Bold (an
 * overlap bead's in one ink, regular), its baseline the cap height's half below the middle. */
function letterAt(content: PageDrawing, letter: string, box: Box, color: string, largest: number, face: 'bold' | 'regular' = 'bold'): void {
  const squeeze = letter.length > 1 ? LETTER_SQUEEZE : 100
  const wide = (helveticaWidth(letter, face, largest) * squeeze) / 100
  const size = Math.min(largest, (largest * box.width * K * LETTER_ROOM) / wide)
  const x = (box.x + box.width / 2) * K
  const baseline = (box.y + box.height / 2) * K + (HELVETICA_CAP_HEIGHT * size) / 2
  content.text(letter, x, baseline, { face, size, color, ...(letter.length > 1 ? { scale: squeeze } : {}) }, 'center')
}

/** A swatch drawn like a bead on the page: its fill (in one ink, its tone), a hairline edge and its letter (the key's). */
export function drawKeySwatch(content: PageDrawing, x: number, y: number, hex: string, letter: string, round: boolean, ink: PrintInk): void {
  const size = mm(KEY_SWATCH_MM)
  const inset = round ? (size * (1 - ROUND_SHARE)) / 2 : 0
  content.roundRect((x + inset) * K, (y + inset) * K, (size - inset * 2) * K, (size - inset * 2) * K, round ? size : 0, { fill: ink.fill(hex), stroke: ink.colors.lineStrong, lineWidth: LINE_CELL })
  letterAt(content, letter, { x, y, width: size, height: size }, ink.letter(hex), letterPt(KEY_SWATCH_MM))
}

/** What a bead of `hex` is filled with: its tone or color, an overlap bead paper in one ink, else its color toward white. */
function fillOf(hex: string, overlap: boolean, ink: PrintInk): string {
  if (!overlap) return ink.fill(hex)
  return ink.oneInk ? ink.colors.paper : tint(hex, OVERLAP_TINT)
}

/** A bead's letter: on its own bead its color by the ink; an overlap bead's `muted`, or black and regular in one ink. */
function letterOf(hex: string, overlap: boolean, ink: PrintInk): { color: string; face: 'bold' | 'regular' } {
  if (!overlap) return { color: ink.letter(hex), face: 'bold' }
  return ink.oneInk ? { color: ink.colors.ink, face: 'regular' } : { color: ink.colors.muted, face: 'bold' }
}

/** Whether a bead prints solid black: never in the overlap, which is paper. */
function isSolid(hex: string | null, overlap: boolean, ink: PrintInk): boolean {
  return hex !== null && !overlap && ink.solid(hex)
}

/** Half the paper between two solid black beads (PrintBlackAndWhite card), round each one's fill. */
const SOLID_INSET = mm(0.1)

/** A cell edge, the same for both beads it lies between. */
const edgeKey = (horizontal: boolean, at: number, from: number, to: number) => [horizontal ? 'h' : 'v', at, Math.min(from, to), Math.max(from, to)].map((value) => (typeof value === 'number' ? Math.round(value * 100) : value)).join(':')

/** One part: its pad outline, beads, lines, letters, rulers and the overlap line, on the page at `pad`. */
function drawPart(content: PageDrawing, project: Project, plan: PrintPlan, part: PrintPart, pad: Box, letters: SwatchLetters, ink: PrintInk): void {
  const grid = displayedGrid(project)
  const stepAcross = grid.stepAcross * plan.zoom
  const stepDown = grid.stepDown * plan.zoom
  const chart: Box = { x: pad.x + PRINT_RULER, y: pad.y + PRINT_RULER, width: part.region.width, height: part.region.height }
  const lastAcross = part.lastAcross - (part.firstAcross - part.overlapAcross)
  const lastDown = part.lastDown - (part.firstDown - part.overlapDown)
  const firstIndexAcross = part.firstAcross - part.overlapAcross
  const firstIndexDown = part.firstDown - part.overlapDown
  const inOverlap = (bead: PlacedBead) => bead.across < part.overlapAcross || bead.down < part.overlapDown

  const { colors } = ink
  content.roundRect(pad.x * K, pad.y * K, pad.width * K, pad.height * K, mmPt(2), { stroke: colors.faint, lineWidth: PAD_LINE })

  const custom = customChart(project, part.region, plan.zoom)
  if (custom) {
    drawCustomPart(content, project, part, chart, custom, letters, { across: stepAcross, down: stepDown }, letterPt(plan.beadMm), ink)
    drawOverlapLine(content, part, pad, chart, stepAcross, stepDown, ink)
    return
  }

  const beads = placeBeads(project, plan, part)
  const round = beadsAreRound(project)
  const offset = beads.some((bead) => Math.abs(bead.cell.x - bead.across * stepAcross) > 0.5 || Math.abs(bead.cell.y - bead.down * stepDown) > 0.5)

  // Fills, one colour after another. A solid black bead stands apart by paper, with no hairline round it.
  const solid = (bead: PlacedBead) => isSolid(bead.color, inOverlap(bead), ink)
  const filled = beads.filter((bead) => bead.color !== null).sort((p, q) => (p.color! < q.color! ? -1 : 1))
  for (const bead of filled) {
    const fill = fillOf(bead.color!, inOverlap(bead), ink)
    // A square bead fills its cell, so staggered beads don't overlap.
    const { x, y, width, height } = round ? bead.box : bead.cell
    const inset = round ? (Math.min(width, height) * (1 - ROUND_SHARE)) / 2 : solid(bead) ? SOLID_INSET : 0
    const left = (chart.x + x + inset) * K
    const top = (chart.y + y + inset) * K
    const wide = (width - inset * 2) * K
    const tall = (height - inset * 2) * K
    if (round) {
      content.roundRect(left, top, wide, tall, Math.min(wide, tall), solid(bead) ? { fill } : { fill, stroke: colors.lineStrong, lineWidth: LINE_CELL })
    } else {
      content.fillRect(left, top, wide, tall, fill)
    }
  }
  const apart = new Set(beads.filter(solid).flatMap(({ cell }) => [
    edgeKey(false, cell.x, cell.y, cell.y + cell.height),
    edgeKey(false, cell.x + cell.width, cell.y, cell.y + cell.height),
    edgeKey(true, cell.y, cell.x, cell.x + cell.width),
    edgeKey(true, cell.y + cell.height, cell.x, cell.x + cell.width),
  ]))
  const addCellLine = (horizontal: boolean, at: number, from: number, to: number) => {
    if (!apart.has(edgeKey(horizontal, at, from, to))) cellLines.add(horizontal, at, from, to)
  }

  // Lines over the fills: cell lines, then every 5th, every 10th and the chart's edge.
  const cellLines = new Edges()
  const fiveLines = new Edges()
  const tenLines = new Edges()
  for (const { cell, across, down } of beads) {
    const acrossIndex = firstIndexAcross + across
    const downIndex = firstIndexDown + down
    if (!round) {
      addCellLine(false, cell.x, cell.y, cell.y + cell.height)
      addCellLine(false, cell.x + cell.width, cell.y, cell.y + cell.height)
      addCellLine(true, cell.y, cell.x, cell.x + cell.width)
      addCellLine(true, cell.y + cell.height, cell.x, cell.x + cell.width)
    }
    const right = across < lastAcross && lineBetween(acrossNumber(project, acrossIndex), acrossNumber(project, acrossIndex + 1))
    if (right) (right === 'tenth' ? tenLines : fiveLines).add(false, cell.x + cell.width, cell.y, cell.y + cell.height)
    const below = down < lastDown && lineBetween(downNumber(project, downIndex), downNumber(project, downIndex + 1))
    if (below) (below === 'tenth' ? tenLines : fiveLines).add(true, cell.y + cell.height, cell.x, cell.x + cell.width)
  }
  content.lines(cellLines.segments(chart.x, chart.y), LINE_CELL, colors.lineStrong)
  content.lines(fiveLines.segments(chart.x, chart.y), LINE_FIVE, colors.fieldLine)
  content.lines(tenLines.segments(chart.x, chart.y), LINE_TEN, colors.ink)
  if (!offset) {
    const right = chart.x + chart.width
    const bottom = chart.y + chart.height
    content.lines([[chart.x * K, chart.y * K, right * K, chart.y * K], [right * K, chart.y * K, right * K, bottom * K], [right * K, bottom * K, chart.x * K, bottom * K], [chart.x * K, bottom * K, chart.x * K, chart.y * K]], LINE_TEN, colors.ink)
  }

  // An empty position's small faint cross (ticket 0818), on the paper the fills leave.
  content.lines(beads.filter((bead) => bead.color === null).flatMap((bead) => {
    const { x, y, width, height } = round ? bead.box : bead.cell
    return emptyCross(chart.x + x + width / 2, chart.y + y + height / 2, Math.min(width, height))
  }), LINE_CELL, colors.faint)

  // Letters over the lines: every bead carries its Swatch letter, whether the Letters toggle is on or not.
  for (const bead of beads) {
    if (bead.color === null) continue
    const { x, y, width, height } = round ? bead.box : bead.cell
    const { color, face } = letterOf(bead.color, inOverlap(bead), ink)
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + x, y: chart.y + y, width, height }, color, letterPt(plan.beadMm), face)
  }

  drawOverlapLine(content, part, pad, chart, stepAcross, stepDown, ink)

  // Rulers: upright numbers at every 5th (every 10th on a small bead), on all four sides, tens bold in ink, fives regular
  // in muted, overlap faint.
  const shown = (value: number) => rulerLevel(value) === 'tenth' || (rulerLevel(value) === 'fifth' && plan.beadMm >= RULER_FIVES_FROM_MM)
  const size = LETTER_PT
  const cap = HELVETICA_CAP_HEIGHT * size
  const number = (value: number, x: number, baseline: number, align: 'left' | 'center' | 'right', overlap: boolean) => {
    const level = rulerLevel(value)
    content.text(String(value), x, baseline, { face: level === 'tenth' ? 'bold' : 'regular', size, color: overlap ? colors.faint : level === 'tenth' ? colors.ink : colors.muted }, align)
  }
  for (let index = 0; index <= lastAcross; index += 1) {
    const value = acrossNumber(project, firstIndexAcross + index)
    if (!shown(value)) continue
    const x = (chart.x + index * stepAcross + (grid.beadAcross * plan.zoom) / 2) * K
    const overlap = index < part.overlapAcross
    number(value, x, (chart.y - mm(1.5)) * K, 'center', overlap)
    number(value, x, (chart.y + chart.height + mm(1.5)) * K + cap, 'center', overlap)
  }
  for (let index = 0; index <= lastDown; index += 1) {
    const value = downNumber(project, firstIndexDown + index)
    if (!shown(value)) continue
    const baseline = (chart.y + index * stepDown + (grid.beadDown * plan.zoom) / 2) * K + cap / 2
    const overlap = index < part.overlapDown
    number(value, (chart.x - mm(1.3)) * K, baseline, 'right', overlap)
    number(value, (chart.x + chart.width + mm(1.3)) * K, baseline, 'left', overlap)
  }
}

/** Where the part itself begins: the line past the overlap it repeats from the part before. */
function drawOverlapLine(content: PageDrawing, part: PrintPart, pad: Box, chart: Box, stepAcross: number, stepDown: number, ink: PrintInk): void {
  const seam: [number, number, number, number][] = []
  if (part.overlapAcross) seam.push([(chart.x + part.overlapAcross * stepAcross) * K, pad.y * K, (chart.x + part.overlapAcross * stepAcross) * K, (pad.y + pad.height) * K])
  if (part.overlapDown) seam.push([pad.x * K, (chart.y + part.overlapDown * stepDown) * K, (pad.x + pad.width) * K, (chart.y + part.overlapDown * stepDown) * K])
  content.lines(seam, OVERLAP_LINE, ink.colors.accent)
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

/** A Custom frame's part of the chart (ticket 0594): each bead whose centre falls in the part's cells, turned as it lies, with
 * its Swatch letter upright; empty positions outlined so the shape reads, each with its cross; its Seams as lines. No cell lines or rulers:
 * its beads keep no rows and columns. */
function drawCustomPart(content: PageDrawing, project: Project, part: PrintPart, chart: Box, custom: NonNullable<ReturnType<typeof customChart>>, letters: SwatchLetters, step: { across: number; down: number }, letterSize: number, ink: PrintInk): void {
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
  const beads = custom.beads.filter(own)
  for (const bead of beads) {
    const fill = bead.color === null ? undefined : fillOf(bead.color, inOverlap(bead), ink)
    const solid = isSolid(bead.color, inOverlap(bead), ink)
    const paint = solid ? { fill } : { ...(fill ? { fill } : {}), stroke: fill ? ink.colors.lineStrong : ink.colors.faint, lineWidth: LINE_CELL }
    if (round) {
      const size = Math.min(bead.width, bead.height) * ROUND_SHARE
      content.roundRect((chart.x + bead.x - size / 2) * K, (chart.y + bead.y - size / 2) * K, size * K, size * K, size * K, paint)
      continue
    }
    const cos = Math.cos(bead.angle)
    const sin = Math.sin(bead.angle)
    const corner = (across: number, out: number): [number, number] => [(chart.x + bead.x + across * cos - out * sin) * K, (chart.y + bead.y + across * sin + out * cos) * K]
    // A solid black bead gives up its edge to paper, as on a grid.
    const halfWide = bead.width / 2 - (solid ? SOLID_INSET : 0)
    const halfDeep = bead.height / 2 - (solid ? SOLID_INSET : 0)
    content.polygon([corner(-halfWide, -halfDeep), corner(halfWide, -halfDeep), corner(halfWide, halfDeep), corner(-halfWide, halfDeep)], paint)
  }
  const local = { x: 0, y: 0, width: part.region.width, height: part.region.height }
  const seams = custom.seams.flatMap((seam) => {
    const cut = clippedTo(local, seam)
    return cut ? [[(chart.x + cut[0]) * K, (chart.y + cut[1]) * K, (chart.x + cut[2]) * K, (chart.y + cut[3]) * K] as [number, number, number, number]] : []
  })
  content.lines(seams, LINE_FIVE, ink.colors.fieldLine)
  content.lines(beads.filter((bead) => bead.color === null).flatMap((bead) => emptyCross(chart.x + bead.x, chart.y + bead.y, Math.min(bead.width, bead.height))), LINE_CELL, ink.colors.faint)
  for (const bead of beads) {
    if (bead.color === null) continue
    const size = Math.min(bead.width, bead.height)
    const { color, face } = letterOf(bead.color, inOverlap(bead), ink)
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + bead.x - size / 2, y: chart.y + bead.y - size / 2, width: size, height: size }, color, letterSize, face)
  }
}

/** Every part on a chart page, or page 1's whole chart from `area`'s top left corner, into `content` (PDF operators, or the
 * PNG's canvas) in `ink`, and where each pad sits (the caller's labels and key go by them). */
export function drawChartParts(content: PageDrawing, project: Project, plan: PrintPlan, parts: PrintPart[], letters: SwatchLetters, ink: PrintInk, area = CHART_PAGE_AREA): Box[] {
  const shared = parts.length > 1
  const pads = parts.map((part) => padOf(part, shared, area))
  parts.forEach((part, index) => drawPart(content, project, plan, part, pads[index]!, letters, ink))
  return pads
}

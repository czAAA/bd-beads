import { fromHex } from '../domain/color'
import { HELVETICA_CAP_HEIGHT } from '../domain/helvetica'
import { PdfContent } from '../domain/pdfContent'
import type { SwatchLetters } from '../domain/swatchLetters'
import { beadRoundness, describeWeave } from '../domain/weave'
import { frameWeave, type Project } from '../domain/project'
import type { DrawingContext } from './beadLook'
import { PRINT_THEME } from './beadLook'
import { acrossNumber, downNumber, lineBetween, rulerLevel } from './printPages'
import { PRINT_COLORS } from './printColors'
import { displayedGrid, mm, PRINT_DPI, PRINT_MARGIN, PRINT_HEADER, PRINT_HEADER_GAP, PRINT_PART_LABEL, PRINT_RULER, type PrintPart, type PrintPlan } from './printPlan'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX, gridToRegion, rowPitchPx, rowShiftPx } from './surfaceView'
import { customChart, type ChartBead } from './customChart'
import type { LayoutPoint } from '../domain/frameLayout'

// A chart page as PDF operators (ticket 0585, ADR 0043; PrintChartPage card): sharp at any zoom. The Project renderer places
// every bead of every Technique (given a stand-in canvas that only keeps its transform) and this draws what it is told.
// Layout is in the plan's px (150 dpi); the operators are in points.

/** Points per layout px, and per millimetre. */
export const K = 72 / PRINT_DPI
export const mmPt = (value: number) => (value * 72) / 25.4

const LINE_CELL = mmPt(0.1)
const LINE_FIVE = mmPt(0.18)
const LINE_TEN = mmPt(0.3)
const PAD_LINE = mmPt(0.2)
const OVERLAP_LINE = mmPt(0.5)
/** `print-letter`, in points, and the share of its bead a round bead's circle takes (2.6 of 3 mm). */
const LETTER_PT = 6.5
const ROUND_SHARE = 2.6 / 3
/** `print-overlap-tint`: how far toward white an overlap bead is mixed. */
const OVERLAP_TINT = 0.6
/** `--print-letter-balance`: above it a bead's letter is `ink`, otherwise white (the same rule as markOn). */
const LETTER_BALANCE = 0.1791
/** `--print-letter-squeeze`: horizontal scale of a two-letter Swatch letter. */
const LETTER_SQUEEZE = 72

/** The WCAG relative luminance of a `#rrggbb` color.
 * @internal Its test checks the WCAG values on their own. */
export function luminance(hex: string): number {
  const rgb = fromHex(hex)
  if (!rgb) return 1
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** A color mixed toward white. */
function tint(hex: string, amount: number): string {
  const rgb = fromHex(hex)
  if (!rgb) return hex
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')
  return `#${mix(rgb.r)}${mix(rgb.g)}${mix(rgb.b)}`
}

/** The colour of a Swatch letter on a bead of this color: `ink` on a light one, white on a dark one.
 * @internal Its test checks the switch from ink to white on its own. */
export function letterColor(hex: string): string {
  return luminance(hex) > LETTER_BALANCE ? PRINT_COLORS.ink : PRINT_COLORS.paper
}

/** Whether the Project's beads are drawn round (a circle in the cell) rather than as squares. */
export function beadsAreRound(project: Pick<Project, 'technique' | 'frame' | 'beadId' | 'beadShape' | 'brickBlock' | 'netSize'>): boolean {
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

/** The positions of a part, bead by bead, for any Technique, rotation or Bead shape: the Project renderer is run with a
 * stand-in context that remembers only the transform, and a bead drawer that records where each bead lands.
 * @internal Its test checks where each bead lands on its own. */
export function placeBeads(project: Project, plan: PrintPlan, part: PrintPart): PlacedBead[] {
  const grid = displayedGrid(project)
  const weave = frameWeave(project)
  const units = describeWeave(weave).countsUnits
  const pitch = rowPitchPx(weave.technique, weave.cell)
  const space = spaceOf(project, false)
  const matrix = gridToRegion(space.extent, part.region, plan.zoom, project.rotation)
  const [a, b, c, d, e, f] = matrix
  const at = (x: number, y: number): [number, number] => [a * x + c * y + e, b * x + d * y + f]
  const rectOf = (x: number, y: number, width: number, height: number): Box => {
    const [x1, y1] = at(x, y)
    const [x2, y2] = at(x + width, y + height)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
  }
  const stepAcross = grid.stepAcross * plan.zoom
  const stepDown = grid.stepDown * plan.zoom
  const placed: PlacedBead[] = []
  const context = new Proxy({}, { get: () => () => undefined, set: () => true }) as DrawingContext
  renderProject(context, {
    project,
    space,
    region: part.region,
    zoom: plan.zoom,
    theme: PRINT_THEME,
    rowMarks: false,
    drawBead: (_context, bead) => {
      const width = bead.width ?? bead.size
      const height = bead.height ?? bead.size
      const box = rectOf(bead.x, bead.y, width, height)
      let cell = box
      let middle = at(bead.x + width / 2, bead.y + height / 2)
      if (!units) {
        const row = Math.round(bead.y / pitch)
        const shift = rowShiftPx(weave, row)
        const column = Math.round((bead.x - shift) / CELL_SIZE_PX)
        cell = rectOf(column * CELL_SIZE_PX + shift, row * pitch, CELL_SIZE_PX, pitch)
        // The unshifted cell's middle names the position, so an offset row stays in its own column.
        middle = at(column * CELL_SIZE_PX + CELL_SIZE_PX / 2, row * pitch + pitch / 2)
      }
      const across = Math.floor(middle[0] / stepAcross)
      const down = Math.floor(middle[1] / stepDown)
      // Beads the renderer draws past the part's edge belong to its neighbour.
      if (across < 0 || down < 0 || middle[0] > part.region.width || middle[1] > part.region.height) return
      placed.push({ box, cell, color: bead.color, across, down })
    },
  })
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

/** Where a part's pad sits on the page, in px: its top left corner and size (rulers included). */
function padOf(part: PrintPart, shared: boolean): Box {
  return {
    x: PRINT_MARGIN + part.place.x,
    y: PRINT_MARGIN + PRINT_HEADER + PRINT_HEADER_GAP + part.place.y + (shared ? SHARED_LABEL : 0),
    width: part.region.width + PRINT_RULER * 2,
    height: part.region.height + PRINT_RULER * 2,
  }
}

/** A Swatch letter set centred in a box: Helvetica-Bold, its baseline the cap height's half below the middle. */
function letterAt(content: PdfContent, letter: string, box: Box, color: string): void {
  const size = LETTER_PT
  const x = (box.x + box.width / 2) * K
  const baseline = (box.y + box.height / 2) * K + (HELVETICA_CAP_HEIGHT * size) / 2
  content.text(letter, x, baseline, { face: 'bold', size, color, ...(letter.length > 1 ? { scale: LETTER_SQUEEZE } : {}) }, 'center')
}

/** A swatch drawn like a bead on the page: its fill, a hairline edge and its letter (the key's). */
export function drawKeySwatch(content: PdfContent, x: number, y: number, hex: string, letter: string, round: boolean): void {
  const size = mm(3)
  const inset = round ? (size * (1 - ROUND_SHARE)) / 2 : 0
  content.roundRect((x + inset) * K, (y + inset) * K, (size - inset * 2) * K, (size - inset * 2) * K, round ? size : 0, { fill: hex, stroke: PRINT_COLORS.lineStrong, lineWidth: LINE_CELL })
  letterAt(content, letter, { x, y, width: size, height: size }, letterColor(hex))
}

/** One part: its pad outline, beads, lines, letters, rulers and the overlap line, on the page at `pad`. */
function drawPart(content: PdfContent, project: Project, plan: PrintPlan, part: PrintPart, pad: Box, letters: SwatchLetters): void {
  const grid = displayedGrid(project)
  const stepAcross = grid.stepAcross * plan.zoom
  const stepDown = grid.stepDown * plan.zoom
  const chart: Box = { x: pad.x + PRINT_RULER, y: pad.y + PRINT_RULER, width: part.region.width, height: part.region.height }
  const lastAcross = part.lastAcross - (part.firstAcross - part.overlapAcross)
  const lastDown = part.lastDown - (part.firstDown - part.overlapDown)
  const firstIndexAcross = part.firstAcross - part.overlapAcross
  const firstIndexDown = part.firstDown - part.overlapDown
  const inOverlap = (bead: PlacedBead) => bead.across < part.overlapAcross || bead.down < part.overlapDown

  content.roundRect(pad.x * K, pad.y * K, pad.width * K, pad.height * K, mmPt(2), { stroke: PRINT_COLORS.faint, lineWidth: PAD_LINE })

  const custom = customChart(project, part.region, plan.zoom)
  if (custom) {
    drawCustomPart(content, project, part, chart, custom, letters, { across: part.overlapAcross * stepAcross, down: part.overlapDown * stepDown })
    drawOverlapLine(content, part, pad, chart, stepAcross, stepDown)
    return
  }

  const beads = placeBeads(project, plan, part)
  const round = beadsAreRound(project)
  const units = describeWeave(frameWeave(project)).countsUnits
  const offset = beads.some((bead) => Math.abs(bead.cell.x - bead.across * stepAcross) > 0.5 || Math.abs(bead.cell.y - bead.down * stepDown) > 0.5)

  // Fills, one colour after another.
  const filled = beads.filter((bead) => bead.color !== null).sort((p, q) => (p.color! < q.color! ? -1 : 1))
  for (const bead of filled) {
    const fill = inOverlap(bead) ? tint(bead.color!, OVERLAP_TINT) : bead.color!
    // A square bead fills its cell, so beads that nest (peyote's rows sit closer than a bead is tall) don't overlap.
    const { x, y, width, height } = round || units ? bead.box : bead.cell
    const inset = round ? (Math.min(width, height) * (1 - ROUND_SHARE)) / 2 : 0
    const left = (chart.x + x + inset) * K
    const top = (chart.y + y + inset) * K
    const wide = (width - inset * 2) * K
    const tall = (height - inset * 2) * K
    if (round || units) {
      content.roundRect(left, top, wide, tall, round ? Math.min(wide, tall) : 0, { fill, stroke: PRINT_COLORS.lineStrong, lineWidth: LINE_CELL })
    } else {
      content.fillRect(left, top, wide, tall, fill)
    }
  }

  // Lines over the fills: cell lines, then every 5th, every 10th and the chart's edge.
  const cellLines = new Edges()
  const fiveLines = new Edges()
  const tenLines = new Edges()
  for (const { cell, across, down } of beads) {
    const acrossIndex = firstIndexAcross + across
    const downIndex = firstIndexDown + down
    if (!round && !units) {
      cellLines.add(false, cell.x, cell.y, cell.y + cell.height)
      cellLines.add(false, cell.x + cell.width, cell.y, cell.y + cell.height)
      cellLines.add(true, cell.y, cell.x, cell.x + cell.width)
      cellLines.add(true, cell.y + cell.height, cell.x, cell.x + cell.width)
    }
    if (units) continue
    const right = across < lastAcross && lineBetween(acrossNumber(project, acrossIndex), acrossNumber(project, acrossIndex + 1))
    if (right) (right === 'tenth' ? tenLines : fiveLines).add(false, cell.x + cell.width, cell.y, cell.y + cell.height)
    const below = down < lastDown && lineBetween(downNumber(project, downIndex), downNumber(project, downIndex + 1))
    if (below) (below === 'tenth' ? tenLines : fiveLines).add(true, cell.y + cell.height, cell.x, cell.x + cell.width)
  }
  if (units) {
    // A Unit's beads are lines of their own; the Unit boundaries carry the 5th and 10th lines.
    for (let across = 0; across < lastAcross; across += 1) {
      const level = lineBetween(acrossNumber(project, firstIndexAcross + across), acrossNumber(project, firstIndexAcross + across + 1))
      if (level) (level === 'tenth' ? tenLines : fiveLines).add(false, (across + 1) * stepAcross, 0, chart.height)
    }
    for (let down = 0; down < lastDown; down += 1) {
      const level = lineBetween(downNumber(project, firstIndexDown + down), downNumber(project, firstIndexDown + down + 1))
      if (level) (level === 'tenth' ? tenLines : fiveLines).add(true, (down + 1) * stepDown, 0, chart.width)
    }
  }
  content.lines(cellLines.segments(chart.x, chart.y), LINE_CELL, PRINT_COLORS.lineStrong)
  content.lines(fiveLines.segments(chart.x, chart.y), LINE_FIVE, PRINT_COLORS.fieldLine)
  content.lines(tenLines.segments(chart.x, chart.y), LINE_TEN, PRINT_COLORS.ink)
  if (!offset) {
    const right = chart.x + chart.width
    const bottom = chart.y + chart.height
    content.lines([[chart.x * K, chart.y * K, right * K, chart.y * K], [right * K, chart.y * K, right * K, bottom * K], [right * K, bottom * K, chart.x * K, bottom * K], [chart.x * K, bottom * K, chart.x * K, chart.y * K]], LINE_TEN, PRINT_COLORS.ink)
  }

  // Letters over the lines: every bead carries its Swatch letter, whether the Letters toggle is on or not.
  for (const bead of beads) {
    if (bead.color === null) continue
    const { x, y, width, height } = round || units ? bead.box : bead.cell
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + x, y: chart.y + y, width, height }, inOverlap(bead) ? PRINT_COLORS.muted : letterColor(bead.color))
  }

  drawOverlapLine(content, part, pad, chart, stepAcross, stepDown)

  // Rulers: upright numbers at every 5th, on all four sides, tens bold in ink, fives regular in muted, overlap faint.
  const size = LETTER_PT
  const cap = HELVETICA_CAP_HEIGHT * size
  const number = (value: number, x: number, baseline: number, align: 'left' | 'center' | 'right', overlap: boolean) => {
    const level = rulerLevel(value)
    content.text(String(value), x, baseline, { face: level === 'tenth' ? 'bold' : 'regular', size, color: overlap ? PRINT_COLORS.faint : level === 'tenth' ? PRINT_COLORS.ink : PRINT_COLORS.muted }, align)
  }
  for (let index = 0; index <= lastAcross; index += 1) {
    const value = acrossNumber(project, firstIndexAcross + index)
    if (rulerLevel(value) === 'plain') continue
    const x = (chart.x + index * stepAcross + (grid.beadAcross * plan.zoom) / 2) * K
    const overlap = index < part.overlapAcross
    number(value, x, (chart.y - mm(1.5)) * K, 'center', overlap)
    number(value, x, (chart.y + chart.height + mm(1.5)) * K + cap, 'center', overlap)
  }
  for (let index = 0; index <= lastDown; index += 1) {
    const value = downNumber(project, firstIndexDown + index)
    if (rulerLevel(value) === 'plain') continue
    const baseline = (chart.y + index * stepDown + (grid.beadDown * plan.zoom) / 2) * K + cap / 2
    const overlap = index < part.overlapDown
    number(value, (chart.x - mm(1.3)) * K, baseline, 'right', overlap)
    number(value, (chart.x + chart.width + mm(1.3)) * K, baseline, 'left', overlap)
  }
}

/** Where the part itself begins: the line past the overlap it repeats from the part before. */
function drawOverlapLine(content: PdfContent, part: PrintPart, pad: Box, chart: Box, stepAcross: number, stepDown: number): void {
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

/** A Custom frame's part of the chart (ticket 0594): each bead whose centre falls on the part, turned as it lies, with
 * its Swatch letter upright; empty positions outlined so the shape reads; its Seams as lines. No cell lines or rulers:
 * its beads keep no rows and columns. */
function drawCustomPart(content: PdfContent, project: Project, part: PrintPart, chart: Box, custom: NonNullable<ReturnType<typeof customChart>>, letters: SwatchLetters, overlap: { across: number; down: number }): void {
  const own = (bead: ChartBead) => bead.x >= 0 && bead.y >= 0 && bead.x <= part.region.width && bead.y <= part.region.height
  const inOverlap = (bead: ChartBead) => bead.x < overlap.across || bead.y < overlap.down
  const round = beadsAreRound(project)
  const beads = custom.beads.filter(own)
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
  for (const bead of beads) {
    if (bead.color === null) continue
    const size = Math.min(bead.width, bead.height)
    letterAt(content, letters[bead.color] ?? '?', { x: chart.x + bead.x - size / 2, y: chart.y + bead.y - size / 2, width: size, height: size }, inOverlap(bead) ? PRINT_COLORS.muted : letterColor(bead.color))
  }
}

/** Every part on a chart page as PDF operators, and where each pad sits (the caller's labels and key go by them). */
export function drawChartParts(project: Project, plan: PrintPlan, parts: PrintPart[], pageHeight: number, letters: SwatchLetters): { content: PdfContent; pads: Box[] } {
  const content = new PdfContent(pageHeight * K)
  const shared = parts.length > 1
  const pads = parts.map((part) => padOf(part, shared))
  parts.forEach((part, index) => drawPart(content, project, plan, part, pads[index]!, letters))
  return { content, pads }
}

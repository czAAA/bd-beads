import { countedDimensions, frameWeave, projectDimensions } from '../domain/project'
import markSvg from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import { groupThousands } from '../domain/formatNumber'
import { shownLetters, type Project } from '../domain/project'
import type { SwatchLetters } from '../domain/swatchLetters'
import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { colorsOnParts } from './chartPageKey'
import { PRINT_COLORS } from './printColors'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import {
  PRINT_BOARD_PAD,
  PRINT_HEADER,
  PRINT_LEGEND_WIDTH,
  PRINT_MARGIN,
  PRINT_RULER,
  PRINT_PART_LABEL,
  continuation,
  displayedGrid,
  mm,
  type PageSize,
  type PrintPart,
  type PrintPlan,
} from './printPlan'
import { headerMaker, type PrintText } from './printText'
import { CELL_SIZE_PX, displayedExtentPx } from './surfaceView'

// Drawing the printed pages (ticket 162; printed-output.md, PrintPage1 and PrintChartPage cards). The chart first,
// the rest is small in the margins. Nothing is drawn behind or over the chart: the sheets are open to share. Paper is
// 150 dpi; beads are drawn by the Project renderer in the light print theme.

// The canvas can't read CSS variables, so these three stacks repeat `docs/design/system/tokens.json` (type.families):
// change them together.
export const SANS = "Inter, system-ui, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"
export const MONO = '"DM Mono", "JetBrains Mono", ui-monospace, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", monospace'
export const SERIF = '"Instrument Serif", "Source Serif 4", Georgia, "Songti SC", "Noto Serif CJK SC", serif'

/** Points on the page, as px at 150 dpi: nothing prints under 6.5 pt. */
export const pt = (value: number) => (value * 150) / 72

export const font = (weight: string, size: number, family: string) => `${weight} ${pt(size)}px ${family}`

/** The type the pages use, loaded before anything is drawn (with the Cyrillic and Latin Extended subsets, for a
 * Russian or Polish export). */
export async function loadPrintFonts(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  if (!fonts) return
  const sample = 'Aa Яя Ąą Łł Śś Żż 0123'
  await Promise.all(
    [font('400', 10, SANS), font('600', 10, SANS), font('700', 10, SANS), font('400', 10, MONO), font('italic 400', 10, SERIF)].map((spec) =>
      fonts.load(spec, sample).catch(() => []),
    ),
  )
}

// ---- The X1 mark ---------------------------------------------------------------------------------------------------

/** The mark's own strokes, from the design system's file (48 × 48). */
const MARK_PARTS = [
  ...[...markSvg.matchAll(/<path d="([^"]+)"/g)].map((match) => ({ path: match[1]! })),
  ...[...markSvg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((match) => ({
    circle: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
  })),
]

export function drawMark(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  context.save()
  context.translate(x, y)
  context.scale(size / 48, size / 48)
  context.strokeStyle = color
  context.lineWidth = size >= 64 ? 3.2 : 3.8
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const part of MARK_PARTS) {
    if ('path' in part) {
      context.stroke(new Path2D(part.path))
    } else {
      const [cx, cy, r] = part.circle
      context.beginPath()
      context.arc(cx, cy, r, 0, Math.PI * 2)
      context.stroke()
    }
  }
  context.restore()
}

// ---- Shared pieces -------------------------------------------------------------------------------------------------

export function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, style: string, color: string, align: CanvasTextAlign = 'left', maxWidth?: number): number {
  context.font = style
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'alphabetic'
  context.fillText(value, x, y, maxWidth)
  return context.measureText(value).width
}

/** Words wrapped to `width`, one line per entry. */
export function wrap(context: CanvasRenderingContext2D, value: string, style: string, width: number): string[] {
  context.font = style
  const lines: string[] = []
  let line = ''
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && context.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/** A page canvas `scale` times the layout's px (the layout is at PRINT_DPI; a PDF at a higher quality draws the same page
 * larger, ticket 572): the context is scaled, so everything is drawn in layout px. */
export function blankPage(page: PageSize, scale: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(page.width * scale)
  canvas.height = Math.round(page.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No 2D canvas is available to draw the export on.')
  context.scale(scale, scale)
  context.fillStyle = PRINT_COLORS.paper
  context.fillRect(0, 0, page.width, page.height)
  return { canvas, context }
}

export interface Board {
  /** Where the beads' own top-left corner lands on the page. */
  x: number
  y: number
  width: number
  height: number
}

/** The pale rounded board and the beads of `region` on it (the whole chart on page 1, a part on a chart page). */
function drawBoard(context: CanvasRenderingContext2D, project: Project, region: { x: number; y: number; width: number; height: number }, zoom: number, at: Board, letters?: SwatchLetters): void {
  context.fillStyle = PRINT_COLORS.board
  context.beginPath()
  context.roundRect(at.x - PRINT_BOARD_PAD, at.y - PRINT_BOARD_PAD, at.width + PRINT_BOARD_PAD * 2, at.height + PRINT_BOARD_PAD * 2, mm(4))
  context.fill()

  // The page may be scaled (blankPage): the beads are drawn at that resolution too, then laid in at layout size.
  const scale = context.getTransform().a
  const tile = document.createElement('canvas')
  tile.width = Math.max(1, Math.ceil(region.width * scale))
  tile.height = Math.max(1, Math.ceil(region.height * scale))
  const tileContext = tile.getContext('2d')
  if (!tileContext) return
  const scaled = { x: region.x * scale, y: region.y * scale, width: tile.width, height: tile.height }
  renderProject(tileContext, { project, space: spaceOf(project, false), region: scaled, zoom: zoom * scale, theme: PRINT_THEME, rowMarks: false, letters })
  context.drawImage(tile, at.x, at.y, tile.width / scale, tile.height / scale)
}

export interface Span {
  first: number
  last: number
}

type RulerShape = Pick<Project, 'frame' | 'beads' | 'rotation' | 'technique'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>

// Each quarter turn reverses one axis and swaps columns/rows (composing gridToRegion's per-turn mapping): across reads
// reversed at 90°/180°, down at 180°/270°.
function acrossReversed(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 180
}

function downReversed(rotation: Rotation): boolean {
  return rotation === 180 || rotation === 270
}

/** The Project's own number for a bead at this across-axis index (a turned Project's rows may run across), counted
 * from its far end when the turn reverses this axis. */
function acrossNumber(project: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(project.rotation) ? countedDimensions(project).rows : countedDimensions(project).columns
  return acrossReversed(project.rotation) ? dimension - index : index + 1
}

/** The down-axis equivalent of acrossNumber. */
function downNumber(project: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(project.rotation) ? countedDimensions(project).columns : countedDimensions(project).rows
  return downReversed(project.rotation) ? dimension - index : index + 1
}

// Page 1's rulers on all four sides in the Project's own numbers (a turned Project's rows run across, counted from the
// far end), a number every 10 beads and a hairline between them; the chart pages' own are `drawChartRulers`.
export function drawRulers(context: CanvasRenderingContext2D, project: Project, zoom: number, at: Board, across: Span, down: Span): void {
  const grid = displayedGrid(project)
  const gap = PRINT_BOARD_PAD + PRINT_RULER / 2

  context.save()
  context.textBaseline = 'middle'
  const label = (value: number, x: number, y: number) => {
    const tenth = value % 10 === 0
    if (!tenth && value !== 1) return
    context.font = font(tenth ? '700' : '400', 6.5, MONO)
    context.fillStyle = tenth ? PRINT_COLORS.ink : PRINT_COLORS.muted
    context.textAlign = 'center'
    context.fillText(String(value), x, y)
  }
  for (let index = across.first; index <= across.last; index += 1) {
    const x = at.x + (index - across.first) * grid.stepAcross * zoom + (grid.beadAcross * zoom) / 2
    label(acrossNumber(project, index), x, at.y - gap)
    label(acrossNumber(project, index), x, at.y + at.height + gap)
  }
  for (let index = down.first; index <= down.last; index += 1) {
    const y = at.y + (index - down.first) * grid.stepDown * zoom + (grid.beadDown * zoom) / 2
    label(downNumber(project, index), at.x - gap, y)
    label(downNumber(project, index), at.x + at.width + gap, y)
  }

  // A hairline every 10 beads, in the gap between the 10th and the 11th.
  context.strokeStyle = PRINT_COLORS.ink
  context.globalAlpha = 0.45
  context.lineWidth = pt(0.5)
  context.beginPath()
  for (let index = across.first + 1; index <= across.last; index += 1) {
    if (index % 10 !== 0) continue
    const x = at.x + (index - across.first) * grid.stepAcross * zoom
    context.moveTo(x, at.y - PRINT_BOARD_PAD)
    context.lineTo(x, at.y + at.height + PRINT_BOARD_PAD)
  }
  for (let index = down.first + 1; index <= down.last; index += 1) {
    if (index % 10 !== 0) continue
    const y = at.y + (index - down.first) * grid.stepDown * zoom
    context.moveTo(at.x - PRINT_BOARD_PAD, y)
    context.lineTo(at.x + at.width + PRINT_BOARD_PAD, y)
  }
  context.stroke()
  context.restore()
}

/** How a chart page's ruler sets a number: every 10th bold and `ink`, every 5th `ink`, the rest `muted`. */
export function rulerLevel(value: number): 'tenth' | 'fifth' | 'plain' {
  return value % 10 === 0 ? 'tenth' : value % 5 === 0 ? 'fifth' : 'plain'
}

/** Which band a number stands in on a chart page: odd on the top and left, even on the bottom and right, so each
 * number appears once (printed-output.md, Chart pages). */
export function rulerSide(value: number): 'start' | 'end' {
  return value % 2 === 1 ? 'start' : 'end'
}

/** Whether the line between two neighbouring beads (their Schema numbers) closes a block of 5 or 10: a fine line every
 * 5 beads, a heavier one every 10, counted in the Schema's own numbers whichever way it is turned. */
export function lineBetween(a: number, b: number): 'tenth' | 'fifth' | undefined {
  const level = rulerLevel(Math.min(a, b))
  return level === 'plain' ? undefined : level
}

/** A chart part's rulers (ticket 579): every column and row numbered in the Project's own numbers, odd top and left, even
 * bottom and right, columns turned. The overlap is shaded with `faint` numbers under an `accent` line where the part
 * begins; fine and heavier lines run over the beads. */
function drawChartRulers(context: CanvasRenderingContext2D, project: Project, zoom: number, at: Board, part: PrintPart): void {
  const grid = displayedGrid(project)
  const gap = PRINT_BOARD_PAD + PRINT_RULER / 2
  const firstAcross = part.firstAcross - part.overlapAcross
  const firstDown = part.firstDown - part.overlapDown
  const acrossAt = (index: number) => at.x + (index - firstAcross) * grid.stepAcross * zoom
  const downAt = (index: number) => at.y + (index - firstDown) * grid.stepDown * zoom

  context.save()
  context.beginPath()
  context.rect(at.x, at.y, at.width, at.height)
  context.clip()
  context.fillStyle = PRINT_COLORS.paper
  context.globalAlpha = 0.6
  if (part.overlapAcross) context.fillRect(at.x, at.y, acrossAt(part.firstAcross) - at.x, at.height)
  if (part.overlapDown) context.fillRect(at.x, at.y, at.width, downAt(part.firstDown) - at.y)
  context.restore()

  // The lines over the beads: the first bead of an axis has no line before it.
  context.save()
  context.strokeStyle = PRINT_COLORS.ink
  for (const level of ['fifth', 'tenth'] as const) {
    context.globalAlpha = level === 'tenth' ? 0.7 : 0.3
    context.lineWidth = pt(level === 'tenth' ? 0.8 : 0.4)
    context.beginPath()
    for (let index = firstAcross + 1; index <= part.lastAcross; index += 1) {
      if (lineBetween(acrossNumber(project, index - 1), acrossNumber(project, index)) !== level) continue
      context.moveTo(acrossAt(index), at.y)
      context.lineTo(acrossAt(index), at.y + at.height)
    }
    for (let index = firstDown + 1; index <= part.lastDown; index += 1) {
      if (lineBetween(downNumber(project, index - 1), downNumber(project, index)) !== level) continue
      context.moveTo(at.x, downAt(index))
      context.lineTo(at.x + at.width, downAt(index))
    }
    context.stroke()
  }
  context.restore()

  // Where the part itself begins.
  context.save()
  context.strokeStyle = PRINT_COLORS.accent
  context.lineWidth = pt(1.4)
  context.beginPath()
  if (part.overlapAcross) {
    context.moveTo(acrossAt(part.firstAcross), at.y)
    context.lineTo(acrossAt(part.firstAcross), at.y + at.height)
  }
  if (part.overlapDown) {
    context.moveTo(at.x, downAt(part.firstDown))
    context.lineTo(at.x + at.width, downAt(part.firstDown))
  }
  context.stroke()
  context.restore()

  const label = (value: number, x: number, y: number, turned: boolean, overlap: boolean) => {
    const level = rulerLevel(value)
    context.save()
    context.font = font(level === 'tenth' ? '700' : '400', 6.5, MONO)
    context.fillStyle = overlap ? PRINT_COLORS.faint : level === 'plain' ? PRINT_COLORS.muted : PRINT_COLORS.ink
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.translate(x, y)
    if (turned) context.rotate(-Math.PI / 2)
    context.fillText(String(value), 0, 0)
    context.restore()
  }
  for (let index = firstAcross; index <= part.lastAcross; index += 1) {
    const value = acrossNumber(project, index)
    const x = acrossAt(index) + (grid.beadAcross * zoom) / 2
    label(value, x, rulerSide(value) === 'start' ? at.y - gap : at.y + at.height + gap, true, index < part.firstAcross)
  }
  for (let index = firstDown; index <= part.lastDown; index += 1) {
    const value = downNumber(project, index)
    const y = downAt(index) + (grid.beadDown * zoom) / 2
    label(value, rulerSide(value) === 'start' ? at.x - gap : at.x + at.width + gap, y, false, index < part.firstDown)
  }
}

/** The top line on every page: the mark and "openbeads" on the left, the maker, date and time on the right. */
function drawTopLine(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, y: number): void {
  drawMark(context, PRINT_MARGIN, y - mm(4.2), mm(5.5), PRINT_COLORS.accent)
  text(context, 'openbeads', PRINT_MARGIN + mm(7), y, font('700', 10, SANS), PRINT_COLORS.ink)
  const right = [headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, right, page.width - PRINT_MARGIN, y, font('400', 7.5, MONO), PRINT_COLORS.muted, 'right')
}

/** The technique word in the serif, in the accent, and the Project's name beside it; returns where the name ends. */
function drawTitle(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, wordSize: number, nameSize: number, maxWidth: number): void {
  const word = text(context, words.techniqueWord, x, y, font('italic 400', wordSize, SERIF), PRINT_COLORS.accent)
  text(context, words.name, x + word + mm(2.5), y, font('700', nameSize, SANS), PRINT_COLORS.ink, 'left', Math.max(mm(20), maxWidth - word - mm(2.5)))
}

// ---- Page 1 -------------------------------------------------------------------------------------------------------

// How the whole Project sits on page 1: zoom and room, beside (or, wide, above) the Beads needed column. Both ways are
// tried and the larger Project wins: a slightly wider than tall one (peyote/brick rows sit closer than columns) fits
// the side column far better, and picking by shape alone once left it tiny with the sheet empty.
export function pageOneLayout(project: Pick<Project, 'technique' | 'frame' | 'beads' | 'rotation'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>, page: PageSize) {
  const wide = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, project.rotation, frameWeave(project).cell)
  const top = PRINT_MARGIN + mm(30)
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const maxZoom = mm(7) / CELL_SIZE_PX
  const layoutFor = (columnBelow: boolean) => {
    const room = {
      x: PRINT_MARGIN + inset,
      y: top + inset,
      width: page.width - PRINT_MARGIN * 2 - inset * 2 - (columnBelow ? 0 : PRINT_LEGEND_WIDTH + mm(6)),
      height: page.height - top - PRINT_MARGIN - mm(4) - inset * 2 - (columnBelow ? mm(78) : 0),
    }
    const zoom = Math.min(maxZoom, room.width / wide.width, room.height / wide.height)
    return { columnBelow, room, zoom, extent: { width: wide.width * zoom, height: wide.height * zoom } }
  }
  const beside = layoutFor(false)
  const below = layoutFor(true)
  return beside.zoom >= below.zoom ? beside : below
}

// Beads needed and the grams note, in a column `width` wide from (x, y); returns its bottom. A narrow rectangle on
// purpose (ticket 186): it used to stretch to the room below, a wide sparse block; `drawFacts`'s column now sits beside
// it.
function drawBeadsNeeded(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
  const { labels } = words
  text(context, labels.beadsNeeded, x, y, font('700', 10, SANS), PRINT_COLORS.ink)
  y += mm(5)
  const both = [words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  text(context, both, x, y, font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width)
  y += mm(6)

  if (words.colors.length === 0) {
    text(context, labels.noColors, x, y, font('400', 8, SANS), PRINT_COLORS.muted, 'left', width)
    return y + mm(4)
  }

  text(context, labels.beadsGrams, x + width, y, font('400', 6.5, MONO), PRINT_COLORS.muted, 'right')
  y += mm(2)
  // A row reads best around 5.5 mm; only a very long color list pushes it down to the 4.2 mm floor.
  const rowHeight = words.colors.length > 20 ? mm(4.2) : mm(5.5)
  const lettered = words.colors.some((color) => color.letter)
  const beadSize = lettered ? Math.min(mm(4.6), rowHeight * 0.95) : Math.min(mm(3.4), rowHeight * 0.7)
  const gramsX = x + width
  const beadsX = x + width - (words.totalGrams ? mm(12) : 0)

  const row = (swatch: string | undefined, name: string, beads: string, grams: string | undefined, bold: boolean, letter?: string) => {
    const middle = y + rowHeight / 2
    context.strokeStyle = PRINT_COLORS.line
    context.lineWidth = pt(0.5)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + width, y)
    context.stroke()
    if (swatch) {
      context.fillStyle = swatch
      context.beginPath()
      context.roundRect(x, middle - beadSize / 2, beadSize, beadSize, beadSize * 0.28)
      context.fill()
      context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      context.stroke()
      if (letter) drawBeadLetter(context, { x, y: middle - beadSize / 2, size: beadSize, color: swatch, letter, dimmed: false, theme: PRINT_THEME })
    }
    const weight = bold ? '700' : '400'
    const nameX = swatch ? x + beadSize + mm(2) : x
    text(context, name, nameX, middle + pt(3), font(weight, 8, SANS), PRINT_COLORS.ink, 'left', beadsX - nameX - mm(11))
    text(context, beads, beadsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.ink, 'right')
    if (grams) text(context, grams, gramsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.muted, 'right')
    y += rowHeight
  }
  for (const color of words.colors) row(color.hex, color.name, color.beads, color.grams, false, color.letter)
  row(undefined, labels.total, words.totalBeads.replace(/\D+$/, ''), words.totalGrams, true)

  if (words.gramsNote) {
    y += mm(1)
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      y += pt(9)
      text(context, line, x, y, font('400', 6.5, SANS), PRINT_COLORS.muted)
    }
  }
  return y
}

/** The maker, technique, bead, size and estimated-size facts, in their own narrow column beside Beads needed (ticket
 * 186). */
function drawFacts(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
  const { labels } = words
  const facts: [string, string][] = [
    ...(words.maker ? ([[labels.madeBy, words.maker]] as [string, string][]) : []),
    [labels.technique, words.techniqueWord],
    [labels.bead, words.bead],
    [labels.size, words.size],
    ...(words.estimatedSize ? ([[labels.estimatedSize, words.estimatedSize]] as [string, string][]) : []),
  ]
  for (const [label, value] of facts) {
    text(context, label.toLowerCase(), x, y, font('400', 6.5, MONO), PRINT_COLORS.muted)
    y += pt(10)
    text(context, value, x, y, font('400', 8, SANS), PRINT_COLORS.ink, 'left', width)
    y += pt(13)
  }
  return y
}

export function drawPageOne(project: Project, words: PrintText, plan: PrintPlan, scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const layout = pageOneLayout(project, page)
  const board: Board = {
    x: layout.room.x + (layout.columnBelow ? (layout.room.width - layout.extent.width) / 2 : 0),
    y: layout.room.y,
    width: layout.extent.width,
    height: layout.extent.height,
  }
  const boardBottom = board.y + board.height + PRINT_BOARD_PAD

  // The top: brand, maker, date; the technique word and name; one meta line; how to read the parts.
  let y = PRINT_MARGIN + mm(4)
  drawTopLine(context, page, words, y)
  y += mm(11)
  drawTitle(context, words, PRINT_MARGIN, y, 24, 15, page.width - PRINT_MARGIN * 2)
  y += mm(6)
  text(context, words.metaLine, PRINT_MARGIN, y, font('400', 8, MONO), PRINT_COLORS.muted, 'left', page.width - PRINT_MARGIN * 2)
  if (plan.parts.length > 1) {
    y += mm(5)
    text(context, words.labels.readParts, PRINT_MARGIN, y, font('400', 7.5, SANS), PRINT_COLORS.muted, 'left', page.width - PRINT_MARGIN * 2)
  }

  // The whole Project, on its board, with rulers every 10, the 10-bead lines and the parts dashed and numbered.
  const whole = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, layout.zoom, project.rotation, frameWeave(project).cell)
  drawBoard(context, project, { x: 0, y: 0, width: whole.width, height: whole.height }, layout.zoom, board)
  const grid = displayedGrid(project)
  drawRulers(context, project, layout.zoom, board, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 })
  if (plan.parts.length > 1) drawParts(context, project, plan, layout.zoom, board)

  // Beads needed and the facts, each its own narrow column (ticket 186): beside the board, stacked one under the
  // other; under it for a Project wider than tall, where there is width to spare, side by side instead.
  if (layout.columnBelow) {
    const y1 = boardBottom + PRINT_RULER + mm(6) + pt(10)
    const beadsColumn = { x: PRINT_MARGIN, width: PRINT_LEGEND_WIDTH }
    const factsColumn = { x: beadsColumn.x + PRINT_LEGEND_WIDTH + mm(10), width: PRINT_LEGEND_WIDTH }
    drawBeadsNeeded(context, words, beadsColumn.x, y1, beadsColumn.width)
    drawFacts(context, words, factsColumn.x, y1, factsColumn.width)
  } else {
    const column = { x: page.width - PRINT_MARGIN - PRINT_LEGEND_WIDTH, y: layout.room.y - PRINT_RULER, width: PRINT_LEGEND_WIDTH }
    const factsY = drawBeadsNeeded(context, words, column.x, column.y + pt(10), column.width) + mm(6)
    drawFacts(context, words, column.x, factsY, column.width)
  }

  text(context, words.labels.page.replace('{page}', '1').replace('{pages}', String(plan.pageCount)), page.width - PRINT_MARGIN, page.height - PRINT_MARGIN + mm(4), font('400', 7, MONO), PRINT_COLORS.muted, 'right')
  return canvas
}

/** The chart parts on page 1: dashed, each numbered by the page it prints on. */
function drawParts(context: CanvasRenderingContext2D, project: Project, plan: PrintPlan, zoom: number, board: Board): void {
  const grid = displayedGrid(project)
  context.save()
  context.setLineDash([mm(1.6), mm(1.2)])
  context.lineWidth = pt(0.9)
  context.strokeStyle = PRINT_COLORS.ink
  for (const part of plan.parts) {
    const x = board.x + part.firstAcross * grid.stepAcross * zoom
    const y = board.y + part.firstDown * grid.stepDown * zoom
    const width = (part.lastAcross - part.firstAcross + 1) * grid.stepAcross * zoom
    const height = (part.lastDown - part.firstDown + 1) * grid.stepDown * zoom
    context.strokeRect(x, y, width, height)
    const label = String(part.page)
    context.font = font('700', 8, SANS)
    const w = context.measureText(label).width + mm(2)
    context.fillStyle = PRINT_COLORS.paper
    context.fillRect(x + mm(1), y + mm(1), w, pt(11))
    text(context, label, x + mm(2), y + mm(1) + pt(8.5), font('700', 8, SANS), PRINT_COLORS.ink)
  }
  context.restore()
}

// ---- Chart pages --------------------------------------------------------------------------------------------------

/** Past this many blocks, the locator lays out as a horizontal strip instead of the block grid's own shape (ticket
 * 187). */
export const MINI_MAP_GRID_LIMIT = 16

export interface MiniMapCell {
  across: number
  down: number
  /** Whether this cell is the page being drawn. */
  here: boolean
}

// The locator's layout (ticket 187): the block grid's shape up to `MINI_MAP_GRID_LIMIT` blocks, or one horizontal row
// past that, so a tall split doesn't add a tall locator and push the chart down. Pure, so checkable without a canvas;
// `drawMiniMap` draws it.
export function miniMapLayout(plan: PrintPlan, part: PrintPart): { cell: number; width: number; cells: MiniMapCell[] } {
  const total = plan.partsAcross * plan.partsDown
  const horizontal = total > MINI_MAP_GRID_LIMIT
  const columns = horizontal ? total : plan.partsAcross
  const cell = horizontal ? Math.min(mm(2), mm(40) / total) : Math.min(mm(3), mm(24) / Math.max(plan.partsAcross, plan.partsDown))
  const at = (index: number): [number, number] => (horizontal ? [index, 0] : [index % plan.partsAcross, Math.floor(index / plan.partsAcross)])
  const cells = Array.from({ length: total }, (_, index) => {
    const [across, down] = at(index)
    return { across, down, here: plan.parts[index]!.page === part.page }
  })
  return { cell, width: cell * columns, cells }
}

/** A small map of the Project's blocks, drawn from `miniMapLayout`, the one on this page filled. */
function drawMiniMap(context: CanvasRenderingContext2D, plan: PrintPlan, part: PrintPart, right: number, top: number): number {
  const layout = miniMapLayout(plan, part)
  const x = right - layout.width

  context.save()
  context.lineWidth = pt(0.5)
  context.strokeStyle = PRINT_COLORS.muted
  for (const at of layout.cells) {
    context.fillStyle = at.here ? PRINT_COLORS.ink : PRINT_COLORS.paper
    context.fillRect(x + at.across * layout.cell, top + at.down * layout.cell, layout.cell - pt(1), layout.cell - pt(1))
    context.strokeRect(x + at.across * layout.cell, top + at.down * layout.cell, layout.cell - pt(1), layout.cell - pt(1))
  }
  context.restore()
  return layout.width
}

/** The header's page number, large, with "Page 3 of 9" under it; returns where its left edge is. */
function drawPageNumber(context: CanvasRenderingContext2D, labels: PrintText['labels'], plan: PrintPlan, page: number, right: number): number {
  const big = text(context, String(page), right, PRINT_MARGIN + mm(9), font('700', 26, SANS), PRINT_COLORS.ink, 'right')
  const small = labels.page.replace('{page}', String(page)).replace('{pages}', String(plan.pageCount))
  const width = text(context, small, right, PRINT_MARGIN + mm(14), font('400', 6.5, MONO), PRINT_COLORS.muted, 'right')
  return right - Math.max(big, width)
}

/** The color key under the boards: a swatch, name and the beads of it on this page, in columns that read down, with the
 * reading line at the bottom. A list too long for the room ends in an ellipsis. */
function drawColorKey(context: CanvasRenderingContext2D, project: Project, words: PrintText, parts: PrintPart[], pageWidth: number, area: { top: number; bottom: number }): void {
  const { labels } = words
  const left = PRINT_MARGIN
  const width = pageWidth - PRINT_MARGIN * 2
  text(context, labels.readNumbers, left, area.bottom, font('400', 7, SANS), PRINT_COLORS.muted, 'left', width)

  let y = area.top + pt(8)
  text(context, labels.keyOnPage, left, y, font('700', 8, SANS), PRINT_COLORS.ink)
  y += mm(2)
  const named = new Map(words.colors.map((color) => [color.hex, color]))
  const colors = colorsOnParts(project, parts).filter(({ hex }) => named.has(hex))
  const lettered = project.letters && colors.some(({ hex }) => named.get(hex)?.letter)
  const rowHeight = lettered ? mm(5) : mm(4.2)
  const swatch = lettered ? mm(4.2) : mm(3)
  const columns = 3
  const columnWidth = width / columns
  const rows = Math.max(1, Math.floor((area.bottom - mm(5) - y) / rowHeight))
  const fits = colors.length <= rows * columns
  const shown = fits ? colors : colors.slice(0, rows * columns - 1)

  shown.forEach(({ hex, count }, index) => {
    const x = left + Math.floor(index / rows) * columnWidth
    const top = y + (index % rows) * rowHeight
    const middle = top + rowHeight / 2
    const color = named.get(hex)!
    context.fillStyle = hex
    context.beginPath()
    context.roundRect(x, middle - swatch / 2, swatch, swatch, swatch * 0.28)
    context.fill()
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.lineWidth = pt(0.5)
    context.stroke()
    if (lettered && color.letter) drawBeadLetter(context, { x, y: middle - swatch / 2, size: swatch, color: hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    const countRight = x + columnWidth - mm(4)
    const counted = text(context, groupThousands(count, words.locale), countRight, middle + pt(3), font('400', 7.5, MONO), PRINT_COLORS.ink, 'right')
    text(context, color.name, x + swatch + mm(2), middle + pt(3), font('400', 8, SANS), PRINT_COLORS.ink, 'left', columnWidth - swatch - mm(2) - counted - mm(7))
  })
  if (!fits) {
    const index = shown.length
    text(context, '…', left + Math.floor(index / rows) * columnWidth, y + (index % rows) * rowHeight + rowHeight / 2 + pt(3), font('400', 8, SANS), PRINT_COLORS.muted)
  }
}

/** A chart page: its parts, each on its own board under its label, where the plan placed them (ticket 578), with the
 * header, the page's color key and the footer (ticket 579). */
export function drawChartPage(project: Project, words: PrintText, plan: PrintPlan, parts: PrintPart[], scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const { labels } = words
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const here = parts[0]!

  // The 17 mm header: technique word and name; the part and the chart style, the maker, date and time; a mini map and
  // the page number, large.
  const mapWidth = drawMiniMap(context, plan, here, page.width - PRINT_MARGIN, PRINT_MARGIN + mm(1))
  const rightEdge = drawPageNumber(context, labels, plan, here.page, page.width - PRINT_MARGIN - mapWidth - mm(4)) - mm(4)
  drawTitle(context, words, PRINT_MARGIN, PRINT_MARGIN + mm(6), 18, 11, rightEdge - PRINT_MARGIN)
  const style = project.letters ? labels.chartStyleLetters : labels.chartStyleColor
  const partLine = parts.length === 1 ? partLabel(project, labels, here) : labels.partArea.replace('{part}', parts.map((part) => part.letter).join(', ')).split(' · ')[0]!
  text(context, partLine, PRINT_MARGIN, PRINT_MARGIN + mm(11), font('700', 8, SANS), PRINT_COLORS.ink, 'left', rightEdge - PRINT_MARGIN)
  const meta = [style, headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, meta, PRINT_MARGIN, PRINT_MARGIN + mm(15.5), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', rightEdge - PRINT_MARGIN)

  let boardsBottom = 0
  for (const part of parts) {
    const left = PRINT_MARGIN + part.place.x
    const top = PRINT_MARGIN + PRINT_HEADER + part.place.y
    boardsBottom = Math.max(boardsBottom, top + part.place.height)
    // A sheet with one part has its label in the header; parts sharing a sheet each carry theirs.
    if (parts.length > 1) text(context, partLabel(project, labels, part), left + inset, top + mm(4), font('700', 8, SANS), PRINT_COLORS.ink)
    const board: Board = { x: left + inset, y: top + PRINT_PART_LABEL + inset, width: part.region.width, height: part.region.height }
    drawBoard(context, project, part.region, plan.zoom, board, shownLetters(project))
    drawChartRulers(context, project, plan.zoom, board, part)
  }

  // Under the boards: the colors on this page, and how the numbers read.
  drawColorKey(context, project, words, parts, page.width, { top: boardsBottom + mm(3), bottom: page.height - PRINT_MARGIN - mm(8) })

  // The 8 mm footer: the brand, and where the chart goes on.
  const footer = page.height - PRINT_MARGIN - mm(1.5)
  drawMark(context, PRINT_MARGIN, footer - mm(3.4), mm(4), PRINT_COLORS.accent)
  text(context, 'openbeads', PRINT_MARGIN + mm(5.5), footer, font('700', 7.5, SANS), PRINT_COLORS.ink)
  text(context, continuationText(labels, plan, parts), page.width - PRINT_MARGIN, footer, font('400', 7.5, SANS), PRINT_COLORS.muted, 'right')
  return canvas
}

/** "Part B · columns 101–130 · rows 1–100": the Project's own numbers, lowest first (a turned Project's rows run
 * across). */
export function partLabel(project: Project, labels: PrintText['labels'], part: PrintPart): string {
  const range = (a: number, b: number) => `${Math.min(a, b)}–${Math.max(a, b)}`
  const across = range(acrossNumber(project, part.firstAcross), acrossNumber(project, part.lastAcross))
  const down = range(downNumber(project, part.firstDown), downNumber(project, part.lastDown))
  const turned = rotationSwapsAxes(project.rotation)
  return labels.partArea
    .replace('{part}', part.letter)
    .replace('{columns}', turned ? down : across)
    .replace('{rows}', turned ? across : down)
}

/** Where the chart goes on from a sheet: the pages to the right of and below its parts, else the next sheet, else
 * "Last part". */
function continuationText(labels: PrintText['labels'], plan: PrintPlan, parts: PrintPart[]): string {
  const here = parts[0]!.page
  const pages = (pick: (next: ReturnType<typeof continuation>) => number | undefined) =>
    parts.map((part) => pick(continuation(plan, part))).filter((page): page is number => page !== undefined && page !== here)
  const right = Math.min(...pages((next) => next.right))
  const below = Math.min(...pages((next) => next.below))
  if (Number.isFinite(right) && Number.isFinite(below)) return labels.continuesBoth.replace('{right}', String(right)).replace('{below}', String(below))
  if (Number.isFinite(right)) return labels.continuesRight.replace('{right}', String(right))
  if (Number.isFinite(below)) return labels.continuesBelow.replace('{below}', String(below))
  return here < plan.pageCount ? labels.continuesOn.replace('{next}', String(here + 1)) : labels.lastPart
}

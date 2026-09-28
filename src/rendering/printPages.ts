import markSvg from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'
import { CELL_SIZE_PX, rotationSwapsAxes, type Rotation } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { PRINT_THEME } from './beadLook'
import { displayedExtentPx, renderPattern } from './patternRenderer'
import {
  PRINT_BOARD_PAD,
  PRINT_HEADER,
  PRINT_LEGEND_WIDTH,
  PRINT_MARGIN,
  PRINT_NAME_BAND,
  PRINT_RULER,
  PRINT_STRIP_GAP,
  PRINT_STRIP_LABEL,
  continuation,
  displayedGrid,
  mm,
  type PageSize,
  type PrintPart,
  type PrintPlan,
} from './printPlan'
import { headerMaker, type PrintText } from './printText'

/**
 * Drawing the printed pages (ticket 162; printed-output.md, the PrintPage1 and PrintChartPage cards). The chart comes
 * first and the rest is small, in the margins. The accent stays light, so a black-and-white printer loses nothing: the
 * technique word at full strength, the background line at 38%, the marks at 7%, the maker's name at 14%. Everything
 * is on paper at 150 dpi; the beads are drawn by the Pattern renderer in the light print theme.
 */

/** The light theme's values the paper uses (tokens.json; kept equal by printPages.test.ts). A canvas can't read CSS. */
export const PRINT_COLORS = {
  paper: '#ffffff',
  ink: '#1f1f1f',
  muted: '#6a6a6a',
  line: '#e5e5e5',
  accent: '#fa520f',
  board: PRINT_THEME.background,
}

export const PRINT_OPACITY = { line: 0.38, mark: 0.07, name: 0.14 }

export const SANS = 'Inter, system-ui, sans-serif'
export const MONO = '"DM Mono", "JetBrains Mono", ui-monospace, monospace'
export const SERIF = '"Instrument Serif", "Source Serif 4", Georgia, serif'

/** Points on the page, as px at 150 dpi: nothing prints under 6.5 pt. */
export const pt = (value: number) => (value * 150) / 72

export const font = (weight: string, size: number, family: string) => `${weight} ${pt(size)}px ${family}`

/** The type the pages use, loaded before anything is drawn (with the Cyrillic fallbacks, for a Russian export). */
export async function loadPrintFonts(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  if (!fonts) return
  const sample = 'Aa Яя 0123'
  await Promise.all(
    [font('400', 10, SANS), font('700', 10, SANS), font('400', 10, MONO), font('italic 400', 10, SERIF)].map((spec) =>
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

export function drawMark(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1): void {
  context.save()
  context.globalAlpha = alpha
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

function blankPage(page: PageSize): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = page.width
  canvas.height = page.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No 2D canvas is available to draw the export on.')
  context.fillStyle = PRINT_COLORS.paper
  context.fillRect(0, 0, page.width, page.height)
  return { canvas, context }
}

/** The accent line, background only: in from the left, under the board, out past its right edge, off the top. */
export function drawAccentLine(context: CanvasRenderingContext2D, page: PageSize, from: { x: number; y: number }, board: { right: number; top: number; bottom: number }): void {
  context.save()
  context.globalAlpha = PRINT_OPACITY.line
  context.strokeStyle = PRINT_COLORS.accent
  context.lineWidth = mm(0.5)
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(-mm(5), from.y)
  context.bezierCurveTo(page.width * 0.3, from.y + mm(6), board.right - mm(40), board.bottom + mm(10), board.right - mm(12), board.bottom - mm(8))
  context.bezierCurveTo(board.right + mm(10), board.top + mm(30), board.right + mm(4), board.top - mm(10), page.width + mm(5), -mm(5))
  context.stroke()
  context.restore()
}

/**
 * Large and pale under the board, its top tucked behind the board's lower edge; never cut. The maker's name, or, for
 * a Pattern with its own maker's name (ticket 182), that name alongside the Pattern's own (see PrintText.background).
 */
export function drawBackgroundName(context: CanvasRenderingContext2D, background: string, x: number, boardBottom: number, align: CanvasTextAlign): void {
  if (!background) return
  context.save()
  context.globalAlpha = PRINT_OPACITY.name
  text(context, background, x, boardBottom + pt(26), font('italic 400', 40, SERIF), PRINT_COLORS.accent, align)
  context.restore()
}

export interface Board {
  /** Where the beads' own top-left corner lands on the page. */
  x: number
  y: number
  width: number
  height: number
}

/** The pale rounded board and the beads of `region` on it (the whole chart on page 1, a part on a chart page). */
function drawBoard(context: CanvasRenderingContext2D, pattern: Pattern, region: { x: number; y: number; width: number; height: number }, zoom: number, at: Board): void {
  context.fillStyle = PRINT_COLORS.board
  context.beginPath()
  context.roundRect(at.x - PRINT_BOARD_PAD, at.y - PRINT_BOARD_PAD, at.width + PRINT_BOARD_PAD * 2, at.height + PRINT_BOARD_PAD * 2, mm(4))
  context.fill()

  const tile = document.createElement('canvas')
  tile.width = Math.max(1, Math.ceil(region.width))
  tile.height = Math.max(1, Math.ceil(region.height))
  const tileContext = tile.getContext('2d')
  if (!tileContext) return
  renderPattern(tileContext, { pattern, region, zoom, theme: PRINT_THEME })
  context.drawImage(tile, at.x, at.y)
}

export interface Span {
  first: number
  last: number
}

type RulerShape = Pick<Pattern, 'columns' | 'rows' | 'rotation'>

/**
 * Each quarter turn reverses one axis and swaps which of columns/rows is which (composing gridToRegion's own per-turn
 * mapping): the across axis reads reversed at 90°/180°, the down axis at 180°/270°.
 */
function acrossReversed(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 180
}

function downReversed(rotation: Rotation): boolean {
  return rotation === 180 || rotation === 270
}

/** The Pattern's own number for a bead at this across-axis index (a turned Pattern's rows may run across), counted from its far end when the turn reverses this axis. */
function acrossNumber(pattern: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(pattern.rotation) ? pattern.rows : pattern.columns
  return acrossReversed(pattern.rotation) ? dimension - index : index + 1
}

/** The down-axis equivalent of acrossNumber. */
function downNumber(pattern: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(pattern.rotation) ? pattern.columns : pattern.rows
  return downReversed(pattern.rotation) ? dimension - index : index + 1
}

/**
 * The rulers on all four sides, in the Pattern's own numbers (a turned Pattern's rows run across, counted from its
 * far end), and a hairline every 10 beads across the board. `every` is 10 on page 1; the chart pages label every 5th
 * bead in `muted` and every 10th bold.
 */
export function drawRulers(context: CanvasRenderingContext2D, pattern: Pattern, zoom: number, at: Board, across: Span, down: Span, every: 5 | 10): void {
  const grid = displayedGrid(pattern)
  const bead = CELL_SIZE_PX * zoom
  const gap = PRINT_BOARD_PAD + PRINT_RULER / 2

  context.save()
  context.textBaseline = 'middle'
  const label = (value: number, x: number, y: number) => {
    const tenth = value % 10 === 0
    if (!tenth && (every === 10 || value % 5 !== 0) && value !== 1) return
    context.font = font(tenth ? '700' : '400', 6.5, MONO)
    context.fillStyle = tenth ? PRINT_COLORS.ink : PRINT_COLORS.muted
    context.textAlign = 'center'
    context.fillText(String(value), x, y)
  }
  for (let index = across.first; index <= across.last; index += 1) {
    const x = at.x + (index - across.first) * grid.stepAcross * zoom + bead / 2
    label(acrossNumber(pattern, index), x, at.y - gap)
    label(acrossNumber(pattern, index), x, at.y + at.height + gap)
  }
  for (let index = down.first; index <= down.last; index += 1) {
    const y = at.y + (index - down.first) * grid.stepDown * zoom + bead / 2
    label(downNumber(pattern, index), at.x - gap, y)
    label(downNumber(pattern, index), at.x + at.width + gap, y)
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

/** The top line on every page: the mark and "bd-beads" on the left, the maker, date and time on the right. */
function drawTopLine(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, y: number): void {
  drawMark(context, PRINT_MARGIN, y - mm(4.2), mm(5.5), PRINT_COLORS.accent)
  text(context, 'bd-beads', PRINT_MARGIN + mm(7), y, font('700', 10, SANS), PRINT_COLORS.ink)
  const right = [headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, right, page.width - PRINT_MARGIN, y, font('400', 7.5, MONO), PRINT_COLORS.muted, 'right')
}

/** The technique word in the serif, in the accent, and the Pattern's name beside it; returns where the name ends. */
function drawTitle(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, wordSize: number, nameSize: number, maxWidth: number): void {
  const word = text(context, words.techniqueWord, x, y, font('italic 400', wordSize, SERIF), PRINT_COLORS.accent)
  text(context, words.name, x + word + mm(2.5), y, font('700', nameSize, SANS), PRINT_COLORS.ink, 'left', Math.max(mm(20), maxWidth - word - mm(2.5)))
}

// ---- Page 1 -------------------------------------------------------------------------------------------------------

/**
 * How the whole Pattern sits on page 1: the zoom and the room it takes, beside (or, wide, above) the Beads needed
 * column. Tried both ways and the one that draws the Pattern larger wins — a Pattern only a little wider than tall
 * (peyote and brick's rows sit closer than their columns, so even a square bead count comes out that way) fits the
 * side column's room far better than the fixed band left under a truly wide one, and picking by shape alone once
 * left it tiny with the rest of the sheet empty.
 */
export function pageOneLayout(pattern: Pick<Pattern, 'technique' | 'columns' | 'rows' | 'rotation'>, page: PageSize) {
  const wide = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, 1, pattern.rotation)
  const top = PRINT_MARGIN + mm(30)
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const maxZoom = mm(7) / CELL_SIZE_PX
  const layoutFor = (columnBelow: boolean) => {
    const room = {
      x: PRINT_MARGIN + inset,
      y: top + inset,
      width: page.width - PRINT_MARGIN * 2 - inset * 2 - (columnBelow ? 0 : PRINT_LEGEND_WIDTH + mm(6)),
      height: page.height - top - PRINT_MARGIN - PRINT_NAME_BAND - mm(4) - inset * 2 - (columnBelow ? mm(78) : 0),
    }
    const zoom = Math.min(maxZoom, room.width / wide.width, room.height / wide.height)
    return { columnBelow, room, zoom, extent: { width: wide.width * zoom, height: wide.height * zoom } }
  }
  const beside = layoutFor(false)
  const below = layoutFor(true)
  return beside.zoom >= below.zoom ? beside : below
}

/**
 * Beads needed and the grams note, in a column `width` wide from (x, y); returns the column's bottom. A narrow
 * rectangle on purpose (ticket 186): it used to stretch its row height to whatever room the page had left below it,
 * which read as a wide, sparse block; the facts that used to run on underneath it are `drawFacts`'s own column now,
 * so the two can sit side by side in the room that stretching used to waste.
 */
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
  const beadSize = Math.min(mm(3.4), rowHeight * 0.7)
  const gramsX = x + width
  const beadsX = x + width - (words.totalGrams ? mm(12) : 0)

  const row = (swatch: string | undefined, name: string, beads: string, grams: string | undefined, bold: boolean) => {
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
    }
    const weight = bold ? '700' : '400'
    const nameX = swatch ? x + beadSize + mm(2) : x
    text(context, name, nameX, middle + pt(3), font(weight, 8, SANS), PRINT_COLORS.ink, 'left', beadsX - nameX - mm(11))
    text(context, beads, beadsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.ink, 'right')
    if (grams) text(context, grams, gramsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.muted, 'right')
    y += rowHeight
  }
  for (const color of words.colors) row(color.hex, color.name, color.beads, color.grams, false)
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

/** The maker, technique, bead, size and estimated-size facts, in their own narrow column beside Beads needed (ticket 186). */
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

export function drawPageOne(pattern: Pattern, words: PrintText, plan: PrintPlan): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page)
  const layout = pageOneLayout(pattern, page)
  const board: Board = {
    x: layout.room.x + (layout.columnBelow ? (layout.room.width - layout.extent.width) / 2 : 0),
    y: layout.room.y,
    width: layout.extent.width,
    height: layout.extent.height,
  }
  const boardBottom = board.y + board.height + PRINT_BOARD_PAD
  const boardRight = board.x + board.width + PRINT_BOARD_PAD

  // Behind everything: the marks, the maker's name and the accent line.
  drawMark(context, page.width - mm(58), page.height * 0.42, mm(70), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawMark(context, page.width - PRINT_MARGIN - mm(26), page.height - PRINT_MARGIN - mm(26), mm(26), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawMark(context, page.width * 0.46, PRINT_MARGIN + mm(12), mm(12), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawBackgroundName(context, words.background, board.x, boardBottom, 'left')
  drawAccentLine(context, page, { x: 0, y: page.height - mm(24) }, { right: boardRight, top: board.y - PRINT_BOARD_PAD, bottom: boardBottom })

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

  // The whole Pattern, on its board, with rulers every 10, the 10-bead lines and the parts dashed and numbered.
  const whole = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, layout.zoom, pattern.rotation)
  drawBoard(context, pattern, { x: 0, y: 0, width: whole.width, height: whole.height }, layout.zoom, board)
  const grid = displayedGrid(pattern)
  drawRulers(context, pattern, layout.zoom, board, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 }, 10)
  if (plan.parts.length > 1) drawParts(context, pattern, plan, layout.zoom, board)

  // Beads needed and the facts, each its own narrow column (ticket 186): beside the board, stacked one under the
  // other; under it for a Pattern wider than tall, where there is width to spare, side by side instead.
  if (layout.columnBelow) {
    const y1 = boardBottom + PRINT_RULER + PRINT_NAME_BAND + mm(6) + pt(10)
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
function drawParts(context: CanvasRenderingContext2D, pattern: Pattern, plan: PrintPlan, zoom: number, board: Board): void {
  const grid = displayedGrid(pattern)
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

/** Past this many blocks, the locator lays out as a horizontal strip instead of the block grid's own shape (ticket 187). */
export const MINI_MAP_GRID_LIMIT = 16

export interface MiniMapCell {
  across: number
  down: number
  /** Whether this cell is the page being drawn. */
  here: boolean
}

/**
 * The locator's own layout (ticket 187): the block grid's own row/column shape up to `MINI_MAP_GRID_LIMIT` blocks,
 * or a single horizontal row past that, so a Pattern that splits tall doesn't add a tall locator under the header
 * and push the chart down or off the page. Pure, so it can be checked without a canvas; `drawMiniMap` draws it.
 */
export function miniMapLayout(plan: PrintPlan, part: PrintPart): { cell: number; width: number; cells: MiniMapCell[] } {
  const total = plan.partsAcross * plan.partsDown
  const horizontal = total > MINI_MAP_GRID_LIMIT
  const columns = horizontal ? total : plan.partsAcross
  const cell = horizontal ? Math.min(mm(2), mm(40) / total) : Math.min(mm(3), mm(24) / Math.max(plan.partsAcross, plan.partsDown))
  const current = part.down * plan.partsAcross + part.across
  const at = (index: number): [number, number] => (horizontal ? [index, 0] : [index % plan.partsAcross, Math.floor(index / plan.partsAcross)])
  const cells = Array.from({ length: total }, (_, index) => {
    const [across, down] = at(index)
    return { across, down, here: index === current }
  })
  return { cell, width: cell * columns, cells }
}

/** A small map of the Pattern's blocks, drawn from `miniMapLayout`, the one on this page filled. */
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

/** A chart page: one full-size part normally, or (PrintStrips) several small ones stacked on the same sheet. */
export function drawChartPage(pattern: Pattern, words: PrintText, plan: PrintPlan, parts: PrintPart[]): HTMLCanvasElement {
  return plan.strip ? drawStripSheet(pattern, words, plan, parts) : drawSinglePartPage(pattern, words, plan, parts[0]!)
}

function drawSinglePartPage(pattern: Pattern, words: PrintText, plan: PrintPlan, part: PrintPart): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page)
  const { labels } = words
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const areaTop = PRINT_MARGIN + PRINT_HEADER + inset
  const areaWidth = page.width - PRINT_MARGIN * 2 - inset * 2
  const board: Board = {
    x: PRINT_MARGIN + inset + (areaWidth - part.region.width) / 2,
    y: areaTop,
    width: part.region.width,
    height: part.region.height,
  }
  const boardBottom = board.y + board.height + PRINT_BOARD_PAD

  // Behind: two marks, the maker's name tucked under the board, the accent line's run to the right.
  drawMark(context, page.width - mm(44), page.height * 0.5, mm(52), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawMark(context, PRINT_MARGIN - mm(4), page.height - PRINT_MARGIN - mm(34), mm(20), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawBackgroundName(context, words.background, page.width / 2, boardBottom, 'center')
  drawAccentLine(context, page, { x: 0, y: boardBottom + mm(8) }, { right: board.x + board.width + PRINT_BOARD_PAD, top: board.y - PRINT_BOARD_PAD, bottom: boardBottom })

  // The 16 mm header: technique word and name, the part, maker, date and time, the page and a mini map.
  const pageLabel = labels.page.replace('{page}', String(part.page)).replace('{pages}', String(plan.pageCount))
  const mapWidth = drawMiniMap(context, plan, part, page.width - PRINT_MARGIN, PRINT_MARGIN + mm(1))
  const rightEdge = page.width - PRINT_MARGIN - mapWidth - mm(4)
  text(context, pageLabel, rightEdge, PRINT_MARGIN + mm(5), font('700', 9, SANS), PRINT_COLORS.ink, 'right')
  drawTitle(context, words, PRINT_MARGIN, PRINT_MARGIN + mm(6), 18, 11, rightEdge - PRINT_MARGIN - mm(40))
  const partLabel = labels.part.replace('{part}', String(part.page - 1)).replace('{parts}', String(plan.parts.length))
  const meta = [partLabel, headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, meta, PRINT_MARGIN, PRINT_MARGIN + mm(11.5), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', rightEdge - PRINT_MARGIN)

  // The part, filling the page, with its rulers.
  drawBoard(context, pattern, part.region, plan.zoom, board)
  drawRulers(context, pattern, plan.zoom, board, { first: part.firstAcross, last: part.lastAcross }, { first: part.firstDown, last: part.lastDown }, 5)

  // The 8 mm footer: the brand, and where the chart goes on.
  const footer = page.height - PRINT_MARGIN - mm(1.5)
  drawMark(context, PRINT_MARGIN, footer - mm(3.4), mm(4), PRINT_COLORS.accent)
  text(context, 'bd-beads', PRINT_MARGIN + mm(5.5), footer, font('700', 7.5, SANS), PRINT_COLORS.ink)
  const next = continuation(plan, part)
  const onward =
    next.right && next.below
      ? labels.continuesBoth.replace('{right}', String(next.right)).replace('{below}', String(next.below))
      : next.right
        ? labels.continuesRight.replace('{right}', String(next.right))
        : next.below
          ? labels.continuesBelow.replace('{below}', String(next.below))
          : labels.lastPart
  text(context, onward, page.width - PRINT_MARGIN, footer, font('400', 7.5, SANS), PRINT_COLORS.muted, 'right')
  return canvas
}

// ---- Stacked strips (PrintStrips) ----------------------------------------------------------------------------------

/** "Part 2 · columns 39–76": the raw axis being split (columns when not turned a quarter, rows when it is), lowest number first. */
function stripLabel(pattern: Pattern, labels: PrintText['labels'], part: PrintPart): string {
  const a = acrossNumber(pattern, part.firstAcross)
  const b = acrossNumber(pattern, part.lastAcross)
  const template = rotationSwapsAxes(pattern.rotation) ? labels.partRows : labels.partColumns
  return template.replace('{part}', String(part.across + 1)).replace('{from}', String(Math.min(a, b))).replace('{to}', String(Math.max(a, b)))
}

/** Several parts sharing one sheet, at the base bead size, each on its own board with rulers and a label, top to bottom. */
function drawStripSheet(pattern: Pattern, words: PrintText, plan: PrintPlan, parts: PrintPart[]): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page)
  const { labels } = words
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const areaWidth = page.width - PRINT_MARGIN * 2 - inset * 2

  drawMark(context, page.width - mm(44), page.height * 0.5, mm(52), PRINT_COLORS.accent, PRINT_OPACITY.mark)
  drawMark(context, PRINT_MARGIN - mm(4), page.height - PRINT_MARGIN - mm(18), mm(18), PRINT_COLORS.accent, PRINT_OPACITY.mark)

  // The header: technique word and name, the maker and date, the page number (no per-part indicator or mini map: each board has its own label).
  const pageLabel = labels.page.replace('{page}', String(parts[0]!.page)).replace('{pages}', String(plan.pageCount))
  text(context, pageLabel, page.width - PRINT_MARGIN, PRINT_MARGIN + mm(5), font('700', 9, SANS), PRINT_COLORS.ink, 'right')
  drawTitle(context, words, PRINT_MARGIN, PRINT_MARGIN + mm(6), 18, 11, page.width - PRINT_MARGIN * 2 - mm(40))
  const meta = [headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, meta, PRINT_MARGIN, PRINT_MARGIN + mm(11.5), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', page.width - PRINT_MARGIN * 2)

  let y = PRINT_MARGIN + PRINT_HEADER
  let lastBoard: Board | undefined
  for (const part of parts) {
    text(context, stripLabel(pattern, labels, part), PRINT_MARGIN, y + mm(4), font('700', 8, SANS), PRINT_COLORS.ink)
    y += PRINT_STRIP_LABEL + inset
    const board: Board = { x: PRINT_MARGIN + inset + (areaWidth - part.region.width) / 2, y, width: part.region.width, height: part.region.height }
    drawBoard(context, pattern, part.region, plan.zoom, board)
    drawRulers(context, pattern, plan.zoom, board, { first: part.firstAcross, last: part.lastAcross }, { first: part.firstDown, last: part.lastDown }, 5)
    y = board.y + board.height + inset + PRINT_STRIP_GAP
    lastBoard = board
  }

  if (lastBoard) {
    const boardBottom = lastBoard.y + lastBoard.height + PRINT_BOARD_PAD
    drawBackgroundName(context, words.background, page.width / 2, boardBottom, 'center')
    drawAccentLine(context, page, { x: 0, y: boardBottom + mm(4) }, { right: lastBoard.x + lastBoard.width + PRINT_BOARD_PAD, top: lastBoard.y - PRINT_BOARD_PAD, bottom: boardBottom })
  }

  // The footer: the brand, and (from the last part on the sheet) where the chart goes on.
  const footer = page.height - PRINT_MARGIN - mm(1.5)
  drawMark(context, PRINT_MARGIN, footer - mm(3.4), mm(4), PRINT_COLORS.accent)
  text(context, 'bd-beads', PRINT_MARGIN + mm(5.5), footer, font('700', 7.5, SANS), PRINT_COLORS.ink)
  const next = continuation(plan, parts.at(-1)!)
  const onward = next.right ? labels.continuesRight.replace('{right}', String(next.right)) : labels.lastPart
  text(context, onward, page.width - PRINT_MARGIN, footer, font('400', 7.5, SANS), PRINT_COLORS.muted, 'right')
  return canvas
}

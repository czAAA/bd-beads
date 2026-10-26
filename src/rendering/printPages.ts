import { countedDimensions, frameWeave, projectDimensions } from '../domain/project'
import markSvg from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import { shownLetters, type Project } from '../domain/project'
import type { SwatchLetters } from '../domain/swatchLetters'
import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { PRINT_COLORS } from './printColors'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import {
  PRINT_BOARD_PAD,
  PRINT_HEADER,
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
function blankPage(page: PageSize, scale: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
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

// The rulers on all four sides in the Project's own numbers (a turned Project's rows run across, counted from the far
// end), and a hairline every 10 beads. `every` is 10 on page 1; chart pages label every 5th bead in `muted`, 10th bold.
export function drawRulers(context: CanvasRenderingContext2D, project: Project, zoom: number, at: Board, across: Span, down: Span, every: 5 | 10): void {
  const grid = displayedGrid(project)
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

/** The band above the board's top ruler that the "101 →" cut labels sit in. */
const CUT_LABEL = mm(3.5)
/** Between the board's bottom ruler and what is under it. */
const BELOW_GAP = mm(5)
/** The facts row ends this far under the top of the page's content. */
const FACTS_END = mm(30)
const BEADS_COLUMN_GAP = mm(8)
/** The table is kept while the board keeps this share of the size it would have with only the one-line form. */
const TABLE_KEEPS_BOARD = 0.75
/** Rulers number every 10 instead of every 5 when 5 beads are narrower than this. */
const MIN_FIVE_STEP = mm(5.5)

/** Beads needed as a table in two columns reading down, or as the one line that points at the Specification page. */
export type BeadsNeededLayout = { kind: 'table'; rowHeight: number; rows: number; height: number } | { kind: 'line'; height: number }

/** The table's height: heading, the two columns of rows, the Total line and the grams note. */
function tableHeight(colors: number, rowHeight: number): number {
  return mm(6) + (colors === 0 ? mm(6) : Math.ceil(colors / 2) * rowHeight) + mm(15)
}

const LINE_HEIGHT = mm(6)

/** How the whole Project sits on page 1 (ticket 580): across the full width, the bead as large as that allows (up to
 * print-bead-max) while Beads needed fits under it; when the table would shrink the board too much, one line takes its
 * place. */
export function pageOneLayout(project: Pick<Project, 'technique' | 'frame' | 'beads' | 'rotation'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>, page: PageSize, colors: number) {
  const wide = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, project.rotation, frameWeave(project).cell)
  const top = PRINT_MARGIN + FACTS_END + CUT_LABEL
  const bottom = page.height - PRINT_MARGIN - mm(4)
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const width = page.width - PRINT_MARGIN * 2 - inset * 2
  const widthZoom = Math.min(mm(7) / CELL_SIZE_PX, width / wide.width)
  const zoomWith = (below: number) => Math.min(widthZoom, (bottom - top - inset * 2 - BELOW_GAP - below) / wide.height)

  const line: BeadsNeededLayout = { kind: 'line', height: LINE_HEIGHT }
  const lineZoom = zoomWith(LINE_HEIGHT)
  const rowHeights = [mm(5.5), mm(4.2)]
  const tables = rowHeights.map((rowHeight): BeadsNeededLayout => ({ kind: 'table', rowHeight, rows: Math.ceil(colors / 2), height: tableHeight(colors, rowHeight) }))
  const beadsNeeded = tables.find((table) => zoomWith(table.height) >= lineZoom * TABLE_KEEPS_BOARD) ?? line
  const zoom = zoomWith(beadsNeeded.height)
  const extent = { width: wide.width * zoom, height: wide.height * zoom }
  const board: Board = { x: PRINT_MARGIN + inset + (width - extent.width) / 2, y: top + inset, ...extent }
  return { zoom, extent, board, beadsNeeded, below: board.y + extent.height + inset + BELOW_GAP }
}

/** The top of page 1: the technique word and the Project's name, then one row of facts under a hairline. */
function drawHeading(context: CanvasRenderingContext2D, page: PageSize, words: PrintText): void {
  const { labels } = words
  const inner = page.width - PRINT_MARGIN * 2
  let y = PRINT_MARGIN + mm(4)
  drawTopLine(context, page, words, y)
  y += mm(11)
  drawTitle(context, words, PRINT_MARGIN, y, 24, 15, inner)
  y += mm(5)
  context.strokeStyle = PRINT_COLORS.line
  context.lineWidth = pt(0.5)
  context.beginPath()
  context.moveTo(PRINT_MARGIN, y)
  context.lineTo(PRINT_MARGIN + inner, y)
  context.stroke()

  // Each fact gets a share of the row by how long its value usually is.
  const facts: [string, string, number][] = [
    ...(words.maker ? ([[labels.madeBy, headerMaker(words.maker), 1.3]] as [string, string, number][]) : []),
    [labels.technique, words.techniqueWord, 1],
    [labels.bead, words.bead, 1.9],
    [labels.shape, words.shape, 0.9],
    [labels.size, words.size, 0.8],
    ...(words.estimatedSize ? ([[labels.estimatedSize, words.estimatedSize, 1.2]] as [string, string, number][]) : []),
  ]
  const shares = facts.reduce((sum, [, , share]) => sum + share, 0)
  let x = PRINT_MARGIN
  for (const [label, value, share] of facts) {
    const width = (inner * share) / shares
    text(context, label.toLowerCase(), x, y + mm(4), font('400', 6.5, MONO), PRINT_COLORS.muted, 'left', width - mm(2))
    text(context, value, x, y + mm(8.5), font('500', 8.5, SANS), PRINT_COLORS.ink, 'left', width - mm(2))
    x += width
  }
}

/** Beads needed under the board: two columns reading down (swatch, name, beads, grams), the Total and the grams note;
 * or, when it does not fit, one line that points at the Specification page. */
function drawBeadsNeeded(context: CanvasRenderingContext2D, words: PrintText, plan: PrintPlan, layout: BeadsNeededLayout, y: number): void {
  const { labels } = words
  const x = PRINT_MARGIN
  const width = plan.page.width - PRINT_MARGIN * 2
  const both = [words.colorsCount, words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')

  if (layout.kind === 'line') {
    const line = labels.beadsNeededSee.replace('{summary}', both).replace('{page}', String(plan.pageCount + 1))
    text(context, line, x, y + mm(3), font('700', 8.5, SANS), PRINT_COLORS.ink, 'left', width)
    return
  }

  text(context, labels.beadsNeeded, x, y + mm(2), font('700', 10, SANS), PRINT_COLORS.ink)
  y += mm(6)
  if (words.colors.length === 0) {
    text(context, labels.noColors, x, y + mm(3), font('400', 8, SANS), PRINT_COLORS.muted, 'left', width)
    return
  }

  const column = (width - BEADS_COLUMN_GAP) / 2
  const { rowHeight } = layout
  const lettered = words.colors.some((color) => color.letter)
  const beadSize = lettered ? Math.min(mm(4.6), rowHeight * 0.95) : Math.min(mm(3.4), rowHeight * 0.7)
  words.colors.forEach((color, index) => {
    const left = x + (index < layout.rows ? 0 : column + BEADS_COLUMN_GAP)
    const top = y + (index % layout.rows) * rowHeight
    const middle = top + rowHeight / 2
    context.strokeStyle = PRINT_COLORS.line
    context.lineWidth = pt(0.5)
    context.beginPath()
    context.moveTo(left, top)
    context.lineTo(left + column, top)
    context.stroke()
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(left, middle - beadSize / 2, beadSize, beadSize, beadSize * 0.28)
    context.fill()
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.stroke()
    if (color.letter) drawBeadLetter(context, { x: left, y: middle - beadSize / 2, size: beadSize, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    const gramsX = left + column
    const beadsX = gramsX - (color.grams ? mm(14) : 0)
    const nameX = left + beadSize + mm(2)
    text(context, color.name, nameX, middle + pt(3), font('400', 8, SANS), PRINT_COLORS.ink, 'left', beadsX - nameX - mm(11))
    text(context, color.beads, beadsX, middle + pt(3), font('400', 7.5, MONO), PRINT_COLORS.ink, 'right')
    if (color.grams) text(context, color.grams, gramsX, middle + pt(3), font('400', 7.5, MONO), PRINT_COLORS.muted, 'right')
  })

  y += layout.rows * rowHeight
  context.strokeStyle = PRINT_COLORS.ink
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + width, y)
  context.stroke()
  text(context, `${labels.total} · ${both}`, x, y + mm(4.5), font('700', 8.5, SANS), PRINT_COLORS.ink, 'left', width)
  y += mm(7)
  if (words.gramsNote) {
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      y += pt(9)
      text(context, line, x, y, font('400', 6.5, SANS), PRINT_COLORS.muted)
    }
  }
}

export function drawPageOne(project: Project, words: PrintText, plan: PrintPlan, scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const layout = pageOneLayout(project, page, words.colors.length)
  const { board } = layout

  drawHeading(context, page, words)

  // The whole Project on its board, rulers with a number every 5 (10 when the beads are too small for that), and the
  // lines where the chart parts meet.
  const whole = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, layout.zoom, project.rotation, frameWeave(project).cell)
  drawBoard(context, project, { x: 0, y: 0, width: whole.width, height: whole.height }, layout.zoom, board)
  const grid = displayedGrid(project)
  const every = grid.stepAcross * layout.zoom * 5 >= MIN_FIVE_STEP ? 5 : 10
  drawRulers(context, project, layout.zoom, board, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 }, every)
  if (plan.parts.length > 1) drawParts(context, project, plan, words.labels, layout.zoom, board)

  drawBeadsNeeded(context, words, plan, layout.beadsNeeded, layout.below)

  const footer = page.height - PRINT_MARGIN + mm(4)
  if (plan.parts.length > 1) text(context, words.labels.readParts, PRINT_MARGIN, footer, font('400', 7, SANS), PRINT_COLORS.muted, 'left', page.width - PRINT_MARGIN * 2 - mm(30))
  text(context, words.labels.page.replace('{page}', '1').replace('{pages}', String(plan.pageCount)), page.width - PRINT_MARGIN, footer, font('400', 7, MONO), PRINT_COLORS.muted, 'right')
  return canvas
}

/** A white pill with an accent border holding `value`, its top left at (x, y); returns its width. */
function pill(context: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, align: 'left' | 'center' | 'right' = 'left'): number {
  context.font = font('700', 6.5, MONO)
  const width = context.measureText(value).width + mm(2.4)
  const left = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width
  context.fillStyle = PRINT_COLORS.paper
  context.strokeStyle = PRINT_COLORS.accent
  context.lineWidth = pt(0.7)
  context.beginPath()
  context.roundRect(left, y, width, pt(11), pt(5.5))
  context.fill()
  context.stroke()
  text(context, value, left + width / 2, y + pt(8), font('700', 6.5, MONO), color, 'center')
  return width
}

/** The chart parts on page 1 (PrintPage1 card): solid accent lines with a white keyline through the board and its
 * rulers, "101 →" and "101 ↓" where each cut is, and a pill on each part saying which page it prints on. */
function drawParts(context: CanvasRenderingContext2D, project: Project, plan: PrintPlan, labels: PrintText['labels'], zoom: number, board: Board): void {
  const grid = displayedGrid(project)
  const across = [...new Set(plan.parts.map((part) => part.firstAcross).filter(Boolean))]
  const down = [...new Set(plan.parts.map((part) => part.firstDown).filter(Boolean))]
  const reach = PRINT_BOARD_PAD + PRINT_RULER
  const xOf = (index: number) => board.x + index * grid.stepAcross * zoom
  const yOf = (index: number) => board.y + index * grid.stepDown * zoom

  context.save()
  context.lineCap = 'butt'
  const stroke = (color: string, width: number) => {
    context.strokeStyle = color
    context.lineWidth = width
    context.beginPath()
    for (const index of across) {
      context.moveTo(xOf(index), board.y - reach)
      context.lineTo(xOf(index), board.y + board.height + reach)
    }
    for (const index of down) {
      context.moveTo(board.x - reach, yOf(index))
      context.lineTo(board.x + board.width + reach, yOf(index))
    }
    context.stroke()
  }
  stroke(PRINT_COLORS.paper, 4)
  stroke(PRINT_COLORS.accent, 2)
  context.restore()

  for (const index of across) pill(context, `${acrossNumber(project, index)} →`, xOf(index), board.y - reach - CUT_LABEL + mm(0.3), PRINT_COLORS.accentStrong, 'center')
  for (const index of down) pill(context, `${downNumber(project, index)} ↓`, board.x + board.width - mm(1), yOf(index) - pt(5.5), PRINT_COLORS.accentStrong, 'right')

  for (const part of plan.parts) {
    const x = xOf(part.firstAcross)
    const y = yOf(part.firstDown)
    const room = (part.lastAcross - part.firstAcross + 1) * grid.stepAcross * zoom - mm(3)
    const label = (key: 'partPage' | 'partPageShort') => labels[key].replace('{part}', part.letter).replace('{page}', String(part.page))
    context.font = font('700', 6.5, MONO)
    const long = label('partPage')
    pill(context, context.measureText(long).width + mm(2.4) <= room ? long : label('partPageShort'), x + mm(1.5), y + mm(1.5), PRINT_COLORS.ink)
  }
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

/** A chart page: its parts, each on its own board under its label, where the plan placed them (ticket 578). */
export function drawChartPage(project: Project, words: PrintText, plan: PrintPlan, parts: PrintPart[], scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const { labels } = words
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const here = parts[0]!

  // The 16 mm header: technique word and name, the maker, date and time, a mini map and the page number, large.
  const pageLabel = labels.page.replace('{page}', String(here.page)).replace('{pages}', String(plan.pageCount))
  const mapWidth = drawMiniMap(context, plan, here, page.width - PRINT_MARGIN, PRINT_MARGIN + mm(1))
  const rightEdge = page.width - PRINT_MARGIN - mapWidth - mm(4)
  text(context, pageLabel, rightEdge, PRINT_MARGIN + mm(5), font('700', 9, SANS), PRINT_COLORS.ink, 'right')
  drawTitle(context, words, PRINT_MARGIN, PRINT_MARGIN + mm(6), 18, 11, rightEdge - PRINT_MARGIN - mm(40))
  const meta = [headerMaker(words.maker), words.exportedAt].filter(Boolean).join(' · ')
  text(context, meta, PRINT_MARGIN, PRINT_MARGIN + mm(11.5), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', rightEdge - PRINT_MARGIN)

  for (const part of parts) {
    const left = PRINT_MARGIN + part.place.x
    const top = PRINT_MARGIN + PRINT_HEADER + part.place.y
    text(context, partLabel(project, labels, part), left, top + mm(4), font('700', 8, SANS), PRINT_COLORS.ink)
    const board: Board = { x: left + inset, y: top + PRINT_PART_LABEL + inset, width: part.region.width, height: part.region.height }
    drawBoard(context, project, part.region, plan.zoom, board, shownLetters(project))
    drawRulers(context, project, plan.zoom, board, { first: part.firstAcross, last: part.lastAcross }, { first: part.firstDown, last: part.lastDown }, 5)
  }

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

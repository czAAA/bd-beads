import { countedDimensions } from '../domain/project'
import markSvg from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import type { Project } from '../domain/project'
import type { SwatchLetters } from '../domain/swatchLetters'
import { PRINT_THEME } from './beadLook'
import { PRINT_COLORS } from './printColors'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import {
  PRINT_BOARD_PAD,
  PRINT_RULER,
  displayedGrid,
  mm,
  type PageSize,
  type PrintPart,
  type PrintPlan,
} from './printPlan'
import { COVER_CUT_LABEL } from './coverLayout'
import type { PrintText } from './printText'

// Drawing the printed pages (ticket 162; printed-output.md, PrintChartPage card; the Cover page is coverPage.ts). The chart first,
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
export function drawBoard(context: CanvasRenderingContext2D, project: Project, region: { x: number; y: number; width: number; height: number }, zoom: number, at: Board, letters?: SwatchLetters): void {
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
export function acrossNumber(project: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(project.rotation) ? countedDimensions(project).rows : countedDimensions(project).columns
  return acrossReversed(project.rotation) ? dimension - index : index + 1
}

/** The down-axis equivalent of acrossNumber. */
export function downNumber(project: RulerShape, index: number): number {
  const dimension = rotationSwapsAxes(project.rotation) ? countedDimensions(project).columns : countedDimensions(project).rows
  return downReversed(project.rotation) ? dimension - index : index + 1
}

// Page 1's rulers on all four sides in the Project's own numbers (a turned Project's rows run across, counted from the
// far end), a number every `every` beads (page 1: 5, or 10 when the beads are small) and a hairline every 10; the chart
// pages' own are `drawChartRulers`.
export function drawRulers(context: CanvasRenderingContext2D, project: Project, zoom: number, at: Board, across: Span, down: Span, every: 5 | 10 = 10): void {
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

/** How a chart page's ruler sets a number: every 10th bold and `ink`, every 5th regular and `muted`, the rest none. */
export function rulerLevel(value: number): 'tenth' | 'fifth' | 'plain' {
  return value % 10 === 0 ? 'tenth' : value % 5 === 0 ? 'fifth' : 'plain'
}

/** Whether the line between two neighbouring beads (their Schema numbers) closes a block of 5 or 10: a fine line every
 * 5 beads, a heavier one every 10, counted in the Schema's own numbers whichever way it is turned. */
export function lineBetween(a: number, b: number): 'tenth' | 'fifth' | undefined {
  const level = rulerLevel(Math.min(a, b))
  return level === 'plain' ? undefined : level
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
export function drawParts(context: CanvasRenderingContext2D, project: Project, plan: PrintPlan, labels: PrintText['labels'], zoom: number, board: Board): void {
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

  for (const index of across) pill(context, `${acrossNumber(project, index)} →`, xOf(index), board.y - reach - COVER_CUT_LABEL + mm(0.3), PRINT_COLORS.accentStrong, 'center')
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

import { projectDimensions } from '../domain/projectExtent'
import markSvg from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'
import { rotationSwapsAxes, type GridPosition } from '../domain/grid'
import type { Project } from '../domain/project'
import { drawFlatBead, PRINT_THEME, type BeadDrawer } from './beadLook'
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
  type TrimmedArea,
} from './printPlan'
import { OVERVIEW_CUT_LABEL } from './overviewLayout'
import type { PrintText } from './printText'
import { fillBlanks } from '../domain/fillBlanks'
import { type Layered, quarterTurnOf } from '../domain/layerRecord'

// Drawing the printed pages (ticket 162; printed-output.md, PrintChartPage card; page 1 is pageOnePage.ts). The chart first,
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

/** How much of an empty position's bead its cross spans, on the overview and on a chart.
 * @internal Tests measure the chart's cross against it. */
export const EMPTY_CROSS_SHARE = 0.4
/** The cross's line (`print-line-cell`). */
const CROSS_LINE = mm(0.1)

/** The two diagonals, [x1, y1, x2, y2], of the cross an empty position carries: centred at `x`, `y`,
 * `EMPTY_CROSS_SHARE` of the bead's `size` across, in whatever unit those are given. */
export function emptyCrossArms(x: number, y: number, size: number): [number, number, number, number][] {
  const arm = (size * EMPTY_CROSS_SHARE) / 2
  return [[x - arm, y - arm, x + arm, y + arm], [x + arm, y - arm, x - arm, y + arm]]
}

/** A bead drawn as the flat look draws it, except an empty position: the bare board, or with `crosses` (Empty grid,
 * ticket 1127) a small `faint` cross on it (tickets 0719, 0818), the mark a chart reader knows as "no bead here", never
 * taken for a pale bead. `lineWidth` is in the bead's own px. */
function crossWhereEmpty(lineWidth: number, crosses: boolean): BeadDrawer {
  return (context, bead) => {
    if (bead.color !== null) return drawFlatBead(context, bead)
    if (!crosses) return
    const width = bead.width ?? bead.size
    const height = bead.height ?? bead.size
    context.beginPath()
    for (const [x1, y1, x2, y2] of emptyCrossArms(bead.x + width / 2, bead.y + height / 2, Math.min(width, height))) {
      context.moveTo(x1, y1)
      context.lineTo(x2, y2)
    }
    context.strokeStyle = PRINT_COLORS.faint
    context.lineWidth = lineWidth
    context.lineCap = 'butt'
    context.stroke()
  }
}

/** A key's "empty" swatch (ticket 0963): a bead's swatch with no fill, its `line-strong` edge `edge` wide, carrying the
 * small `faint` cross an empty position carries on the chart, so the key shows the very sign it names. */
export function drawEmptySwatch(context: CanvasRenderingContext2D, x: number, y: number, size: number, edge: number): void {
  context.beginPath()
  context.roundRect(x, y, size, size, size * 0.28)
  context.strokeStyle = PRINT_COLORS.lineStrong
  context.lineWidth = edge
  context.stroke()
  context.beginPath()
  for (const [x1, y1, x2, y2] of emptyCrossArms(x + size / 2, y + size / 2, size)) {
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
  }
  context.strokeStyle = PRINT_COLORS.faint
  context.lineWidth = CROSS_LINE
  context.lineCap = 'butt'
  context.stroke()
}

/** The pale rounded board and the beads of `region` on it, without letters: page 1's overview (ticket 0914). An empty
 * position is the bare board, under a faint cross with `emptyGrid` (tickets 0587, 0719, 0818, 1127). */
export function drawBoard(context: CanvasRenderingContext2D, project: Project, region: { x: number; y: number; width: number; height: number }, zoom: number, at: Board, emptyGrid: boolean): void {
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
  // The cross's line is `print-line-cell` and at least a device pixel, so it prints at 150 dpi too.
  const crossLine = Math.max(CROSS_LINE * scale, 1) / (zoom * scale)
  renderProject(tileContext, { project, space: spaceOf(project, false), region: scaled, zoom: zoom * scale, theme: PRINT_THEME, rowMarks: false, drawBead: crossWhereEmpty(crossLine, emptyGrid) })
  context.drawImage(tile, at.x, at.y, tile.width / scale, tile.height / scale)
}

export interface Span {
  first: number
  last: number
}

type RulerShape = Layered

/** The number paper gives a displayed column (ticket 1129; PrintChartPage card, Rulers): counted from 1 at the trimmed
 * chart's left, whichever way the Schema is turned, so a part from column 61 counts on 61, 62…. The editor keeps its own. */
export function acrossNumber(trim: TrimmedArea, index: number): number {
  return index - trim.firstAcross + 1
}

/** The same for a displayed row, counted from 1 at the trimmed chart's top. */
export function downNumber(trim: TrimmedArea, index: number): number {
  return index - trim.firstDown + 1
}

/** Where a position stands in the displayed chart, across and down from 0: each quarter turn swaps columns and rows and
 * reverses one axis (composing gridToRegion's per-turn mapping), across at 90° and 180°, down at 180° and 270°, so a
 * bead and the ruler number over it agree at every turn (ticket 1122). */
export function displayedCellOf(project: RulerShape, { row, column }: GridPosition): { across: number; down: number } {
  const rotation = quarterTurnOf(project)
  const { columns, rows } = projectDimensions(project)
  const [across, down, wide, tall] = rotationSwapsAxes(rotation) ? [row, column, rows, columns] : [column, row, columns, rows]
  const acrossReversed = rotation === 90 || rotation === 180
  const downReversed = rotation === 180 || rotation === 270
  return { across: acrossReversed ? wide - 1 - across : across, down: downReversed ? tall - 1 - down : down }
}

/** `print-ruler-fit`: the most of its room the widest ruler number on a page takes, so neighbours keep a gap. */
export const RULER_FIT = 0.8
/** DM Mono's digits' height (its cap height), as a share of its size: what the overview's row numbers must fit between
 * two numbers. */
const MONO_DIGIT_HEIGHT = 0.7
/** The overview's numbers' largest size, `print-letter`, in points. */
const OVERVIEW_NUMBER_PT = 6.5

// Page 1's overview rulers (PrintPage1 card), counted as the chart's are from 1 at `across.first` and `down.first` (ticket
// 1129): the first and every `every`th number (5, or 10 on small beads), regular `muted` in one size, 6.5 pt or less where
// the widest misses `print-ruler-fit` of the room between two numbers, and a hairline every 10.
export function drawRulers(context: CanvasRenderingContext2D, project: Project, zoom: number, at: Board, across: Span, down: Span, every: 5 | 10 = 10): void {
  const grid = displayedGrid(project)
  const gap = PRINT_BOARD_PAD + PRINT_RULER / 2
  const numberOf = (span: Span, index: number) => index - span.first + 1
  const shown = (value: number) => value === 1 || value % every === 0
  // The widest number across, measured at the largest size: the size shrinks with it where it would not fit.
  const widest = (span: Span) => {
    const count = numberOf(span, span.last)
    return count - (count % every) || 1
  }
  context.font = font('400', OVERVIEW_NUMBER_PT, MONO)
  const wide = context.measureText(String(widest(across))).width
  const fitAcross = wide > 0 ? (RULER_FIT * every * grid.stepAcross * zoom) / wide : 1
  const fitDown = (RULER_FIT * every * grid.stepDown * zoom) / (MONO_DIGIT_HEIGHT * pt(OVERVIEW_NUMBER_PT))
  const size = OVERVIEW_NUMBER_PT * Math.min(1, fitAcross, fitDown)

  context.save()
  context.textBaseline = 'middle'
  context.font = font('400', size, MONO)
  context.fillStyle = PRINT_COLORS.muted
  context.textAlign = 'center'
  const label = (value: number, x: number, y: number) => {
    if (shown(value)) context.fillText(String(value), x, y)
  }
  for (let index = across.first; index <= across.last; index += 1) {
    const x = at.x + (index - across.first) * grid.stepAcross * zoom + (grid.beadAcross * zoom) / 2
    label(numberOf(across, index), x, at.y - gap)
    label(numberOf(across, index), x, at.y + at.height + gap)
  }
  for (let index = down.first; index <= down.last; index += 1) {
    const y = at.y + (index - down.first) * grid.stepDown * zoom + (grid.beadDown * zoom) / 2
    label(numberOf(down, index), at.x - gap, y)
    label(numberOf(down, index), at.x + at.width + gap, y)
  }

  // A hairline every 10 beads, in the gap between the 10th and the 11th.
  context.strokeStyle = PRINT_COLORS.ink
  context.globalAlpha = 0.45
  context.lineWidth = pt(0.5)
  context.beginPath()
  for (let index = across.first + 1; index <= across.last; index += 1) {
    if ((index - across.first) % 10 !== 0) continue
    const x = at.x + (index - across.first) * grid.stepAcross * zoom
    context.moveTo(x, at.y - PRINT_BOARD_PAD)
    context.lineTo(x, at.y + at.height + PRINT_BOARD_PAD)
  }
  for (let index = down.first + 1; index <= down.last; index += 1) {
    if ((index - down.first) % 10 !== 0) continue
    const y = at.y + (index - down.first) * grid.stepDown * zoom
    context.moveTo(at.x - PRINT_BOARD_PAD, y)
    context.lineTo(at.x + at.width + PRINT_BOARD_PAD, y)
  }
  context.stroke()
  context.restore()
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
  // The board begins where the plan's trimmed chart does (ticket 1128).
  const { trim } = plan
  const across = [...new Set(plan.parts.map((part) => part.firstAcross).filter((first) => first !== trim.firstAcross))]
  const down = [...new Set(plan.parts.map((part) => part.firstDown).filter((first) => first !== trim.firstDown))]
  const reach = PRINT_BOARD_PAD + PRINT_RULER
  const xOf = (index: number) => board.x + (index - trim.firstAcross) * grid.stepAcross * zoom
  const yOf = (index: number) => board.y + (index - trim.firstDown) * grid.stepDown * zoom

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

  for (const index of across) pill(context, `${acrossNumber(trim, index)} →`, xOf(index), board.y - reach - OVERVIEW_CUT_LABEL + mm(0.3), PRINT_COLORS.accentStrong, 'center')
  for (const index of down) pill(context, `${downNumber(trim, index)} ↓`, board.x + board.width - mm(1), yOf(index) - pt(5.5), PRINT_COLORS.accentStrong, 'right')

  for (const part of plan.parts) {
    const x = xOf(part.firstAcross)
    const y = yOf(part.firstDown)
    const room = (part.lastAcross - part.firstAcross + 1) * grid.stepAcross * zoom - mm(3)
    const label = (key: 'partPage' | 'partPageShort') => fillBlanks(labels[key], { part: part.letter, page: part.page })
    context.font = font('700', 6.5, MONO)
    const long = label('partPage')
    pill(context, context.measureText(long).width + mm(2.4) <= room ? long : label('partPageShort'), x + mm(1.5), y + mm(1.5), PRINT_COLORS.ink)
  }
}

/** "Part B · columns 101–130 · rows 1–100": the part's own columns and rows (its overlap left out) as the rulers number
 * them (ticket 1129), columns across and rows down whichever way the Schema is turned. */
export function partLabel(trim: TrimmedArea, labels: PrintText['labels'], part: PrintPart): string {
  const columns = `${acrossNumber(trim, part.firstAcross)}–${acrossNumber(trim, part.lastAcross)}`
  const rows = `${downNumber(trim, part.firstDown)}–${downNumber(trim, part.lastDown)}`
  return fillBlanks(labels.partArea, { part: part.letter, columns, rows })
}

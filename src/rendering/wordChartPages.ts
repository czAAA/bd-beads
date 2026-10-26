import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { PRINT_COLORS } from './printColors'
import { drawMark, font, MONO, pt, SANS, SERIF, text, wrap } from './printPages'
import { mm, PRINT_MARGIN, type PageSize } from './printPlan'
import { headerMaker, type PrintedWordRow, type PrintText } from './printText'

// The Word chart as pages and as a picture (ticket 0574; PrintWordChart card): a header, the color key strip, then one
// line per row with a tick box, its number and runs. A row never splits across pages and a long one wraps with a
// hanging indent. Measured first and drawn from that measure, so the page count and the drawing can't drift.

const LINE = pt(12)
const NOTE_LINE = pt(10.5)
const ROW_PAD = mm(1.6)
const TICK = mm(3)
const SWATCH = mm(4.6)
const KEY_PAD = mm(3)
const HEADER = mm(20)
const RUN_STYLE = font('400', 8.5, MONO)
const LABEL_STYLE = font('500', 8.5, MONO)
const COUNT_STYLE = font('400', 7, MONO)

interface PlacedRow {
  row: PrintedWordRow
  /** The runs wrapped to the room beside the label, one entry per printed line. */
  lines: string[]
  height: number
}

interface KeyItem {
  x: number
  y: number
  color: PrintText['colors'][number]
}

export interface Measured {
  width: number
  /** Where the label column ends and the runs begin, from the left of the content. */
  runsX: number
  runsWidth: number
  key: { items: KeyItem[]; notes: string[]; height: number }
  rows: PlacedRow[]
}

/** The label as printed: "Row 3 (R):". */
function labelOf(row: PrintedWordRow): string {
  return `${row.label}${row.marker ? ` (${row.marker})` : ''}:`
}

/** Everything about the chart that depends on the width alone: the key strip and every row's wrapped lines. */
export function measureWordChart(context: CanvasRenderingContext2D, words: PrintText, width: number): Measured {
  const chart = words.wordChart!
  context.font = LABEL_STYLE
  const labelWidth = Math.max(...chart.rows.map((row) => context.measureText(labelOf(row)).width), 0)
  const runsX = TICK + mm(3) + labelWidth + mm(3)
  context.font = COUNT_STYLE
  const countWidth = context.measureText(String(Math.max(...chart.rows.map((row) => row.runCount), 0))).width
  const runsWidth = width - runsX - countWidth - mm(4)

  // The key: a swatch with its letter, the name and the count, flowing over lines.
  const items: KeyItem[] = []
  let x = KEY_PAD
  let y = KEY_PAD
  const inner = width - KEY_PAD * 2
  const itemWidth = (color: PrintText['colors'][number]) => {
    context.font = font('400', 8, SANS)
    return SWATCH + mm(2) + context.measureText(`${color.name} · ${color.beads}`).width + mm(5)
  }
  for (const color of words.colors) {
    const need = Math.min(itemWidth(color), inner)
    if (x > KEY_PAD && x - KEY_PAD + need > inner) {
      x = KEY_PAD
      y += SWATCH + mm(2)
    }
    items.push({ x, y, color })
    x += need
  }
  y += words.colors.length > 0 ? SWATCH + mm(2.5) : 0
  const notes = chart.notes.flatMap((note) => wrap(context, note, font('400', 7.5, SANS), inner))
  const height = y + notes.length * NOTE_LINE + KEY_PAD - (notes.length > 0 ? 0 : mm(1))

  const rows = chart.rows.map((row) => {
    const lines = wrap(context, row.runs, RUN_STYLE, runsWidth)
    return { row, lines, height: ROW_PAD * 2 + Math.max(1, lines.length) * LINE }
  })
  return { width, runsX, runsWidth, key: { items, notes, height }, rows }
}

function drawKey(context: CanvasRenderingContext2D, measured: Measured, x: number, y: number): number {
  const { key, width } = measured
  context.fillStyle = PRINT_COLORS.board
  context.beginPath()
  context.roundRect(x, y, width, key.height, mm(2))
  context.fill()
  for (const { x: itemX, y: itemY, color } of key.items) {
    const left = x + itemX
    const top = y + itemY
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(left, top, SWATCH, SWATCH, SWATCH * 0.28)
    context.fill()
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.lineWidth = pt(0.5)
    context.stroke()
    if (color.letter) drawBeadLetter(context, { x: left, y: top, size: SWATCH, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    text(context, `${color.name} · ${color.beads}`, left + SWATCH + mm(2), top + SWATCH / 2 + pt(3), font('400', 8, SANS), PRINT_COLORS.ink, 'left', width - itemX - SWATCH - mm(2) - KEY_PAD)
  }
  let noteY = y + key.height - KEY_PAD - key.notes.length * NOTE_LINE
  for (const note of key.notes) {
    noteY += NOTE_LINE
    text(context, note, x + KEY_PAD, noteY - pt(2), font('400', 7.5, SANS), PRINT_COLORS.muted)
  }
  return y + key.height
}

function drawRow(context: CanvasRenderingContext2D, measured: Measured, placed: PlacedRow, x: number, y: number): void {
  const first = y + ROW_PAD + LINE * 0.75
  context.strokeStyle = PRINT_COLORS.ink
  context.lineWidth = pt(0.6)
  context.beginPath()
  context.roundRect(x, first - TICK + pt(1.5), TICK, TICK, mm(0.5))
  context.stroke()
  text(context, labelOf(placed.row), x + TICK + mm(3), first, LABEL_STYLE, PRINT_COLORS.ink)
  placed.lines.forEach((line, index) => text(context, line, x + measured.runsX, first + index * LINE, RUN_STYLE, PRINT_COLORS.ink))
  text(context, String(placed.row.runCount), x + measured.width, first, COUNT_STYLE, PRINT_COLORS.muted, 'right')
  context.strokeStyle = PRINT_COLORS.line
  context.lineWidth = pt(0.5)
  context.beginPath()
  context.moveTo(x, y + placed.height)
  context.lineTo(x + measured.width, y + placed.height)
  context.stroke()
}

/** The top of every Word chart sheet: "loom · name · maker", "Row by row" with the range in the accent serif, and the
 * page number when there is one. Returns where it ends. */
function drawHeader(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number, pageLabel?: string): number {
  const chart = words.wordChart!
  drawMark(context, x, y, mm(5), PRINT_COLORS.accent)
  const meta = [words.techniqueWord, words.name, headerMaker(words.maker)].filter(Boolean).join(' · ')
  text(context, meta, x + mm(7), y + mm(3.8), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width - mm(40))
  if (pageLabel) text(context, pageLabel, x + width, y + mm(3.8), font('700', 9, SANS), PRINT_COLORS.ink, 'right')
  const title = text(context, chart.title, x, y + mm(13), font('600', 14, SANS), PRINT_COLORS.ink)
  text(context, chart.range, x + title + mm(2.5), y + mm(13), font('italic 400', 15, SERIF), PRINT_COLORS.accent)
  return y + HEADER
}

function scratch(): CanvasRenderingContext2D {
  return document.createElement('canvas').getContext('2d')!
}

// ---- PDF pages -----------------------------------------------------------------------------------------------------

/** The rows each page holds: the first page gives up room to the key. A row never splits, and a page holds at least
 * one. */
function paginate(measured: Measured, page: PageSize): PlacedRow[][] {
  const top = PRINT_MARGIN + HEADER
  const bottom = page.height - PRINT_MARGIN
  const pages: PlacedRow[][] = [[]]
  let y = top + measured.key.height + mm(3)
  for (const placed of measured.rows) {
    const current = pages[pages.length - 1]!
    if (current.length > 0 && y + placed.height > bottom) {
      pages.push([])
      y = top
    }
    pages[pages.length - 1]!.push(placed)
    y += placed.height
  }
  return pages
}

/** How many sheets the Word chart takes in the PDF (0 when there is none). */
export function wordChartPageCount(words: PrintText, page: PageSize): number {
  if (!words.wordChart) return 0
  return paginate(measureWordChart(scratch(), words, page.width - PRINT_MARGIN * 2), page).length
}

/** The Word chart's sheets, drawn one at a time by `makePage` (the PDF's blank page at its dpi); numbered from `first` of
 * `total`. */
export function* drawWordChartPages(words: PrintText, page: PageSize, makePage: () => { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }, first: number, total: number): Generator<HTMLCanvasElement> {
  const width = page.width - PRINT_MARGIN * 2
  const measured = measureWordChart(scratch(), words, width)
  const pages = paginate(measured, page)
  for (const [index, rows] of pages.entries()) {
    const { canvas, context } = makePage()
    const pageLabel = words.labels.page.replace('{page}', String(first + index)).replace('{pages}', String(total))
    let y = drawHeader(context, words, PRINT_MARGIN, PRINT_MARGIN, width, pageLabel)
    if (index === 0) y = drawKey(context, measured, PRINT_MARGIN, y) + mm(3)
    for (const placed of rows) {
      drawRow(context, measured, placed, PRINT_MARGIN, y)
      y += placed.height
    }
    yield canvas
  }
}

// ---- PNG -----------------------------------------------------------------------------------------------------------

/** The picture's width in layout px: about 170 mm of text. */
const PNG_CONTENT_WIDTH = Math.round(mm(170))

export interface WordChartPicture {
  /** Layout size; the picture is `scale` times it. */
  width: number
  height: number
  /** Draws the band of the picture from `top` down, `rows` layout px tall, onto a context already scaled and cleared. */
  draw: (context: CanvasRenderingContext2D, top: number, bandHeight: number) => void
}

/** The Word chart as one tall picture (PngExport card): the same header, key and rows, with a margin round them. */
export function wordChartPicture(words: PrintText): WordChartPicture {
  const measured = measureWordChart(scratch(), words, PNG_CONTENT_WIDTH)
  const rowsHeight = measured.rows.reduce((sum, placed) => sum + placed.height, 0)
  const height = Math.ceil(PRINT_MARGIN * 2 + HEADER + measured.key.height + mm(3) + rowsHeight)
  const width = PNG_CONTENT_WIDTH + Math.ceil(PRINT_MARGIN * 2)
  return {
    width,
    height,
    draw(context, top, bandHeight) {
      context.save()
      context.translate(0, -top)
      let y = drawHeader(context, words, PRINT_MARGIN, PRINT_MARGIN, PNG_CONTENT_WIDTH)
      y = drawKey(context, measured, PRINT_MARGIN, y) + mm(3)
      for (const placed of measured.rows) {
        // Only rows in the band are drawn: the chart can be thousands of px tall.
        if (y + placed.height >= top && y <= top + bandHeight) drawRow(context, measured, placed, PRINT_MARGIN, y)
        y += placed.height
      }
      context.restore()
    },
  }
}

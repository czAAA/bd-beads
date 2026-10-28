import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { PRINT_COLORS } from './printColors'
import { drawMark, font, MONO, SANS, SERIF, text, wrap } from './printPages'
import { mm, PRINT_MARGIN, type PageSize } from './printPlan'
import { headerMaker, type PrintedWordRow, type PrintText } from './printText'

// The Word chart as PDF pages (tickets 0574, 0586; PrintWordChart card): a header naming the page's own rows, the color
// key strip, then one line per row with a tick box, its number and runs, in two columns when the longest row fits half
// the width. A row never splits across columns or pages. Laid out first, so the page count and the drawing can't drift.

const PITCH = mm(5.6)
const ROW_STYLE = font('400', 10, MONO)
const NUMBER_STYLE = font('500', 10, MONO)
const TICK = mm(2.8)
const NUMBER_RIGHT = mm(11.5)
const RUNS_LEFT = mm(13.5)
const MARKER_GAP = mm(1)
const GAP = mm(8)
const COLUMN = mm(91)
const KEY_TOP = mm(26.5)
const KEY_ONE_ROW = mm(8)
const KEY_NEXT_ROW = mm(4.5)
const KEY_STEP = mm(31)
const KEY_INSET = mm(3)
const SWATCH = mm(3)
const NOTE_LINE = mm(3.4)
const BOTTOM = mm(20)
const NOTE_STYLE = font('400', 7.5, SANS)

interface PlacedRow {
  row: PrintedWordRow
  /** The runs wrapped to the room beside the number, one entry per printed line. */
  lines: string[]
  height: number
}

interface WordChartPage {
  /** The rows of each column, read down the first column, then the next. */
  columns: PlacedRow[][]
  /** "1–82": the rows this page holds. */
  range: string
}

interface Layout {
  columnWidth: number
  runsX: number
  notes: string[]
  keyColors: PrintText['colors']
  keyHeight: number
  /** Where the first row's top is, from the top of the page. */
  rowsTop: number
  pages: WordChartPage[]
}

/** A context to measure on: the page's own, or where there is no canvas (a test page) one that sets every character as wide
 * as a mono face does (0.6 em), which the Word chart's rows are in. */
function scratch(): CanvasRenderingContext2D {
  const context = document.createElement('canvas').getContext('2d')
  if (context) return context
  const measuring = { font: '', measureText: (value: string) => ({ width: value.length * 0.6 * Number(/(\d+(?:\.\d+)?)px/.exec(measuring.font)?.[1] ?? 16) }) }
  return measuring as unknown as CanvasRenderingContext2D
}

/** The colors in Swatch letter order (A, B ... Z, AA ...). */
function inLetterOrder(colors: PrintText['colors']): PrintText['colors'] {
  return [...colors].sort((a, b) => (a.letter ?? '').length - (b.letter ?? '').length || (a.letter ?? '').localeCompare(b.letter ?? ''))
}

function rangeOf(rows: PlacedRow[]): string {
  const first = rows[0]!.row.first
  const last = rows[rows.length - 1]!.row.last
  return first === last ? String(first) : `${first}–${last}`
}

function layoutWordChart(context: CanvasRenderingContext2D, words: PrintText, page: PageSize): Layout {
  const chart = words.wordChart!
  const width = page.width - PRINT_MARGIN * 2
  const marked = chart.rows.some((row) => row.marker)
  context.font = ROW_STYLE
  const markerWidth = marked ? context.measureText('(L)').width : 0
  const runsX = marked ? NUMBER_RIGHT + MARKER_GAP + markerWidth + mm(2) : RUNS_LEFT
  const longest = Math.max(...chart.rows.map((row) => context.measureText(row.runs).width), 0)
  const columnWidth = runsX + longest <= COLUMN ? COLUMN : width

  const keyColors = inLetterOrder(words.colors)
  const items = keyColors.length + (chart.empty ? 1 : 0)
  const perRow = Math.max(1, Math.floor((width - KEY_INSET) / KEY_STEP))
  const keyHeight = KEY_ONE_ROW + KEY_NEXT_ROW * (Math.max(1, Math.ceil(items / perRow)) - 1)
  const notes = wrap(context, chart.notes.join(' '), NOTE_STYLE, width)
  const rowsTop = KEY_TOP + keyHeight + mm(6) + NOTE_LINE * (notes.length - 1) + mm(3.4)

  const placed = chart.rows.map((row): PlacedRow => {
    const lines = wrap(context, row.runs, ROW_STYLE, columnWidth - runsX)
    return { row, lines, height: Math.max(1, lines.length) * PITCH }
  })
  const bottom = page.height - BOTTOM
  const perPage = columnWidth === COLUMN ? 2 : 1
  const pages: WordChartPage[] = []
  let columns: PlacedRow[][] = [[]]
  let y = rowsTop
  const close = () => {
    pages.push({ columns, range: rangeOf(columns.flat()) })
    columns = [[]]
    y = rowsTop
  }
  for (const next of placed) {
    if (columns[columns.length - 1]!.length > 0 && y + next.height > bottom) {
      if (columns.length < perPage) {
        columns.push([])
        y = rowsTop
      } else {
        close()
      }
    }
    columns[columns.length - 1]!.push(next)
    y += next.height
  }
  close()
  return { columnWidth, runsX, notes, keyColors, keyHeight, rowsTop, pages }
}

/** How many sheets the Word chart takes in the PDF (0 when there is none). */
export function wordChartPageCount(words: PrintText, page: PageSize): number {
  if (!words.wordChart) return 0
  return layoutWordChart(scratch(), words, page).pages.length
}

function drawHeader(context: CanvasRenderingContext2D, words: PrintText, range: string, pageNumber: number, total: number, left: number, width: number): void {
  const meta = [words.techniqueWord, words.name, headerMaker(words.maker)].filter(Boolean).join(' · ')
  text(context, meta, left, mm(14), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width - mm(40))
  const title = text(context, words.wordChart!.title, left, mm(22.4), font('600', 16, SANS), PRINT_COLORS.ink)
  text(context, range, left + title + mm(1.6), mm(22.4), font('italic 400', 17, SERIF), PRINT_COLORS.accent)
  const right = left + width
  const of = text(context, `/ ${total}`, right, mm(18.6), font('400', 8, MONO), PRINT_COLORS.muted, 'right')
  text(context, String(pageNumber), right - of - mm(1), mm(18.6), font('600', 18, SANS), PRINT_COLORS.ink, 'right')
}

function drawKey(context: CanvasRenderingContext2D, words: PrintText, layout: Layout, left: number, width: number): void {
  const chart = words.wordChart!
  context.strokeStyle = PRINT_COLORS.faint
  context.lineWidth = mm(0.2)
  context.beginPath()
  context.roundRect(left, KEY_TOP, width, layout.keyHeight, mm(2))
  context.stroke()

  const perRow = Math.max(1, Math.floor((width - KEY_INSET) / KEY_STEP))
  const nameRoom = KEY_STEP - SWATCH - mm(1.6) - mm(2)
  const place = (index: number) => {
    const x = left + KEY_INSET + (index % perRow) * KEY_STEP
    const middle = KEY_TOP + mm(4) + Math.floor(index / perRow) * KEY_NEXT_ROW
    return { x, top: middle - SWATCH / 2, name: x + SWATCH + mm(1.6), baseline: middle + mm(0.9) }
  }
  layout.keyColors.forEach((color, index) => {
    const at = place(index)
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(at.x, at.top, SWATCH, SWATCH, SWATCH * 0.28)
    context.fill()
    context.strokeStyle = PRINT_COLORS.lineStrong
    context.lineWidth = mm(0.1)
    context.stroke()
    if (color.letter) drawBeadLetter(context, { x: at.x, y: at.top, size: SWATCH, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    text(context, color.name, at.name, at.baseline, font('400', 7, SANS), PRINT_COLORS.ink, 'left', nameRoom)
  })
  if (chart.empty) {
    const at = place(layout.keyColors.length)
    context.strokeStyle = PRINT_COLORS.lineStrong
    context.lineWidth = mm(0.1)
    context.beginPath()
    context.roundRect(at.x, at.top, SWATCH, SWATCH, SWATCH * 0.28)
    context.stroke()
    text(context, '*', at.x + SWATCH / 2, at.top + SWATCH * 0.8, font('400', 8, SANS), PRINT_COLORS.muted, 'center')
    text(context, chart.empty, at.name, at.baseline, font('400', 7, SANS), PRINT_COLORS.ink, 'left', nameRoom)
  }

  const noteTop = KEY_TOP + layout.keyHeight + mm(6)
  layout.notes.forEach((line, index) => text(context, line, left, noteTop + index * NOTE_LINE, NOTE_STYLE, PRINT_COLORS.muted))
}

function drawRow(context: CanvasRenderingContext2D, layout: Layout, placed: PlacedRow, x: number, y: number): void {
  const { row, lines } = placed
  context.strokeStyle = PRINT_COLORS.fieldLine
  context.lineWidth = mm(0.2)
  context.beginPath()
  context.roundRect(x, y + mm(1.4), TICK, TICK, mm(0.4))
  context.stroke()
  const baseline = y + mm(3.9)
  text(context, row.label, x + NUMBER_RIGHT, baseline, NUMBER_STYLE, PRINT_COLORS.ink, 'right')
  if (row.marker) text(context, `(${row.marker})`, x + NUMBER_RIGHT + MARKER_GAP, baseline, ROW_STYLE, PRINT_COLORS.muted)
  lines.forEach((line, index) => text(context, line, x + layout.runsX, baseline + index * PITCH, ROW_STYLE, PRINT_COLORS.ink))

  const fifth = row.last % 5 === 0
  context.strokeStyle = fifth ? PRINT_COLORS.lineStrong : PRINT_COLORS.lineSoft
  context.lineWidth = mm(fifth ? 0.2 : 0.15)
  context.beginPath()
  context.moveTo(x, y + placed.height)
  context.lineTo(x + layout.columnWidth, y + placed.height)
  context.stroke()
}

function drawFooter(context: CanvasRenderingContext2D, words: PrintText, next: { range: string; page: number } | undefined, left: number, width: number, pageHeight: number): void {
  const footer = pageHeight - PRINT_MARGIN - mm(1.5)
  drawMark(context, left, footer - mm(3.4), mm(4), PRINT_COLORS.accent)
  const brand = text(context, 'openbeads', left + mm(5.5), footer, font('700', 7.5, SANS), PRINT_COLORS.ink)
  text(context, words.exportedAt, left + mm(5.5) + brand + mm(4), footer, font('400', 7.5, MONO), PRINT_COLORS.muted)
  if (next) text(context, words.labels.wordChart.nextRows.replace('{rows}', next.range).replace('{page}', String(next.page)), left + width, footer, font('400', 7.5, SANS), PRINT_COLORS.muted, 'right')
}

/** The Word chart's sheets, drawn one at a time by `makePage` (the PDF's blank page at its dpi); numbered from `first` of
 * `total`. */
export function* drawWordChartPages(words: PrintText, page: PageSize, makePage: () => { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }, first: number, total: number): Generator<HTMLCanvasElement> {
  if (!words.wordChart) return
  const layout = layoutWordChart(scratch(), words, page)
  const left = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2
  for (const [index, sheet] of layout.pages.entries()) {
    const { canvas, context } = makePage()
    drawHeader(context, words, sheet.range, first + index, total, left, width)
    drawKey(context, words, layout, left, width)
    sheet.columns.forEach((rows, column) => {
      let y = layout.rowsTop
      for (const placed of rows) {
        drawRow(context, layout, placed, left + column * (COLUMN + GAP), y)
        y += placed.height
      }
    })
    const following = layout.pages[index + 1]
    drawFooter(context, words, following && { range: following.range, page: first + index + 1 }, left, width, page.height)
    yield canvas
  }
}

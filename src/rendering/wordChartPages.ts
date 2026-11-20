import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { printInkOf, type PrintInk } from './printInk'
import { drawEmptySwatch, drawMark, font, MONO, pt, SANS, SERIF, text } from './printPages'
import { mm, PRINT_MARGIN, type PageSize, type PrintPlan } from './printPlan'
import { headerMaker, RUN_NOTE_BEAD, type PrintedRunPart, type PrintedRunUnit, type PrintedWordRow, type PrintText } from './printText'
import { fillBlanks } from '../domain/fillBlanks'

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
/** A swatch's corner, as a share of its side: a letter swatch's, as on page 1. */
const SWATCH_CORNER = 0.28
const NOTE_LINE = mm(3.4)
const BOTTOM = mm(20)
const NOTE_STYLE = font('400', 7.5, SANS)
/** A run (ticket 1096; PrintWordChart card): its count, 0.6 mm, the bead's swatch, and 2.4 mm to the next run. */
const COUNT_GAP = mm(0.6)
const RUN_GAP = mm(2.4)
/** How far above the baseline the middle of the row's digits is (DM Mono's figures stand about 0.7 em tall). */
const DIGIT_MIDDLE = pt(3.5)
/** The bead on the key line's run ("2 ▢"), and how far above that line's baseline its middle is. */
const NOTE_SWATCH = mm(2.6)
const NOTE_MIDDLE = pt(2.7)
/** The letter on the key line's bead: "2 ▢ is two beads of C". */
const NOTE_LETTER = 'C'

/** A part of a row where it is drawn: its printed line and how far from the runs' start. */
interface PlacedPart {
  part: PrintedRunPart
  line: number
  x: number
}

interface PlacedRow {
  row: PrintedWordRow
  /** The runs wrapped to the room beside the number, at a run: never a run from its swatch, a pair or a side's bar. */
  parts: PlacedPart[]
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
  /** Each Swatch letter's color, which a run's swatch is drawn in. */
  byLetter: Map<string, PrintText['colors'][number]>
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

function partWidth(context: CanvasRenderingContext2D, part: PrintedRunPart): number {
  context.font = ROW_STYLE
  return 'text' in part ? context.measureText(part.text).width : context.measureText(String(part.count)).width + COUNT_GAP + SWATCH
}

/** The room between two parts: after a swatch the run gap (a closing bracket hugs it), after an opening bracket none,
 * after other words a space. */
function gapBetween(context: CanvasRenderingContext2D, before: PrintedRunPart, after: PrintedRunPart): number {
  if ('count' in before) return 'text' in after && after.text === ')' ? COUNT_GAP : RUN_GAP
  if (before.text.endsWith('(')) return 0
  context.font = ROW_STYLE
  return context.measureText(' ').width
}

function unitWidth(context: CanvasRenderingContext2D, unit: PrintedRunUnit): number {
  return unit.reduce((width, part, index) => width + partWidth(context, part) + (index > 0 ? gapBetween(context, unit[index - 1]!, part) : 0), 0)
}

/** A row's parts placed on lines `room` wide (unbounded: one line), wrapping only between units.
 * @internal Its test wraps a row on its own. */
export function placeRuns(context: CanvasRenderingContext2D, units: readonly PrintedRunUnit[], room = Infinity): { parts: PlacedPart[]; lines: number; width: number } {
  const parts: PlacedPart[] = []
  let line = 0
  let x = 0
  let width = 0
  let last: PrintedRunPart | undefined
  for (const unit of units) {
    const gap = last ? gapBetween(context, last, unit[0]!) : 0
    if (last && x + gap + unitWidth(context, unit) > room) {
      line += 1
      x = 0
    } else {
      x += gap
    }
    unit.forEach((part, index) => {
      if (index > 0) x += gapBetween(context, unit[index - 1]!, part)
      parts.push({ part, line, x })
      x += partWidth(context, part)
    })
    width = Math.max(width, x)
    last = unit.at(-1)
  }
  return { parts, lines: line + 1, width }
}

/** The Word chart's notes wrapped to `width`, the key line's bead taking a swatch's room. */
function wrapNotes(context: CanvasRenderingContext2D, notes: readonly string[], width: number): string[] {
  context.font = NOTE_STYLE
  const measure = (value: string) => context.measureText(value.replaceAll(RUN_NOTE_BEAD, '')).width + value.split(RUN_NOTE_BEAD).length * NOTE_SWATCH - NOTE_SWATCH
  const lines: string[] = []
  let line = ''
  for (const word of notes.join(' ').split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
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
  const longest = Math.max(...chart.rows.map((row) => placeRuns(context, row.runs).width), 0)
  const columnWidth = runsX + longest <= COLUMN ? COLUMN : width

  const keyColors = inLetterOrder(words.colors)
  const items = keyColors.length + (chart.empty ? 1 : 0)
  const perRow = Math.max(1, Math.floor((width - KEY_INSET) / KEY_STEP))
  const keyHeight = KEY_ONE_ROW + KEY_NEXT_ROW * (Math.max(1, Math.ceil(items / perRow)) - 1)
  const notes = wrapNotes(context, chart.notes, width)
  const rowsTop = KEY_TOP + keyHeight + mm(6) + NOTE_LINE * (notes.length - 1) + mm(3.4)

  const placed = chart.rows.map((row): PlacedRow => {
    const { parts, lines } = placeRuns(context, row.runs, columnWidth - runsX)
    return { row, parts, height: lines * PITCH }
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
  const byLetter = new Map(keyColors.flatMap((color) => (color.letter ? [[color.letter, color] as const] : [])))
  return { columnWidth, runsX, notes, keyColors, byLetter, keyHeight, rowsTop, pages }
}

/** How many sheets the Word chart takes in the PDF (0 when there is none). @internal Its browser test counts the sheets it
 * draws against it; the app reads it through pdfPageCount. */
export function wordChartPageCount(words: PrintText, page: PageSize): number {
  if (!words.wordChart) return 0
  return layoutWordChart(scratch(), words, page).pages.length
}

/** The PDF's pages (ticket 0916): the plan's (page 1, its list pages, the chart pages) and the Word chart's after them. The
 * Export panel's count, the File size estimate and the export all read it, so they cannot disagree. */
export function pdfPageCount(plan: Pick<PrintPlan, 'pageCount' | 'page'>, words: PrintText): number {
  return plan.pageCount + wordChartPageCount(words, plan.page)
}

function drawHeader(context: CanvasRenderingContext2D, words: PrintText, range: string, pageNumber: number, total: number, left: number, width: number, { colors }: PrintInk): void {
  const meta = [words.techniqueWord, words.name, headerMaker(words.maker)].filter(Boolean).join(' · ')
  text(context, meta, left, mm(14), font('400', 7.5, MONO), colors.muted, 'left', width - mm(40))
  const title = text(context, words.wordChart!.title, left, mm(22.4), font('600', 16, SANS), colors.ink)
  text(context, range, left + title + mm(1.6), mm(22.4), font('italic 400', 17, SERIF), colors.accent)
  const right = left + width
  const of = text(context, `/ ${total}`, right, mm(18.6), font('400', 8, MONO), colors.muted, 'right')
  text(context, String(pageNumber), right - of - mm(1), mm(18.6), font('600', 18, SANS), colors.ink, 'right')
}

/** A bead's swatch, the key's and a run's (ticket 1096): its fill (in one ink, its tone), a 0.1 mm `line-strong` edge and
 * its Swatch letter; with no color, the empty swatch with the chart's small cross. */
function drawSwatch(context: CanvasRenderingContext2D, x: number, top: number, color: Pick<PrintText['colors'][number], 'hex' | 'letter'> | undefined, ink: PrintInk, size = SWATCH): void {
  if (!color) {
    drawEmptySwatch(context, x, top, size, mm(0.1), ink)
    return
  }
  context.fillStyle = ink.fill(color.hex)
  context.beginPath()
  context.roundRect(x, top, size, size, size * SWATCH_CORNER)
  context.fill()
  context.strokeStyle = ink.colors.lineStrong
  context.lineWidth = mm(0.1)
  context.stroke()
  if (color.letter) drawBeadLetter(context, { x, y: top, size, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME, ...(ink.oneInk ? { ink: ink.letter(color.hex) } : {}) })
}

/** A line of the notes, the key line's bead drawn as an outlined swatch with the letter C. */
function drawNoteLine(context: CanvasRenderingContext2D, line: string, x: number, baseline: number, ink: PrintInk): void {
  let at = x
  line.split(RUN_NOTE_BEAD).forEach((piece, index) => {
    if (index > 0) {
      drawSwatch(context, at, baseline - NOTE_MIDDLE - NOTE_SWATCH / 2, { hex: ink.colors.paper, letter: NOTE_LETTER }, ink, NOTE_SWATCH)
      at += NOTE_SWATCH
    }
    at += text(context, piece, at, baseline, NOTE_STYLE, ink.colors.muted)
  })
}

function drawKey(context: CanvasRenderingContext2D, words: PrintText, layout: Layout, left: number, width: number, ink: PrintInk): void {
  const chart = words.wordChart!
  const { colors } = ink
  context.strokeStyle = colors.faint
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
    drawSwatch(context, at.x, at.top, color, ink)
    text(context, color.name, at.name, at.baseline, font('400', 7, SANS), colors.ink, 'left', nameRoom)
  })
  if (chart.empty) {
    const at = place(layout.keyColors.length)
    drawSwatch(context, at.x, at.top, undefined, ink)
    text(context, chart.empty, at.name, at.baseline, font('400', 7, SANS), colors.ink, 'left', nameRoom)
  }

  const noteTop = KEY_TOP + layout.keyHeight + mm(6)
  layout.notes.forEach((line, index) => drawNoteLine(context, line, left, noteTop + index * NOTE_LINE, ink))
}

function drawRow(context: CanvasRenderingContext2D, layout: Layout, placed: PlacedRow, x: number, y: number, ink: PrintInk): void {
  const { colors } = ink
  const { row, parts } = placed
  context.strokeStyle = colors.fieldLine
  context.lineWidth = mm(0.2)
  context.beginPath()
  context.roundRect(x, y + mm(1.4), TICK, TICK, mm(0.4))
  context.stroke()
  const baseline = y + mm(3.9)
  text(context, row.label, x + NUMBER_RIGHT, baseline, NUMBER_STYLE, colors.ink, 'right')
  if (row.marker) text(context, `(${row.marker})`, x + NUMBER_RIGHT + MARKER_GAP, baseline, ROW_STYLE, colors.muted)
  for (const { part, line, x: along } of parts) {
    const left = x + layout.runsX + along
    const lineBaseline = baseline + line * PITCH
    if ('text' in part) {
      text(context, part.text, left, lineBaseline, ROW_STYLE, colors.ink)
      continue
    }
    // A run's count, then its bead's swatch (in one ink, its tone), the swatch's middle on the middle of the digits.
    const count = text(context, String(part.count), left, lineBaseline, ROW_STYLE, colors.ink)
    drawSwatch(context, left + count + COUNT_GAP, lineBaseline - DIGIT_MIDDLE - SWATCH / 2, part.letter === undefined ? undefined : layout.byLetter.get(part.letter), ink)
  }

  const fifth = row.last % 5 === 0
  context.strokeStyle = fifth ? colors.lineStrong : colors.lineSoft
  context.lineWidth = mm(fifth ? 0.2 : 0.15)
  context.beginPath()
  context.moveTo(x, y + placed.height)
  context.lineTo(x + layout.columnWidth, y + placed.height)
  context.stroke()
}

function drawFooter(context: CanvasRenderingContext2D, words: PrintText, next: { range: string; page: number } | undefined, left: number, width: number, pageHeight: number, { colors }: PrintInk): void {
  const footer = pageHeight - PRINT_MARGIN - mm(1.5)
  drawMark(context, left, footer - mm(3.4), mm(4), colors.accent)
  const brand = text(context, 'openbeads', left + mm(5.5), footer, font('700', 7.5, SANS), colors.ink)
  text(context, words.exportedAt, left + mm(5.5) + brand + mm(4), footer, font('400', 7.5, MONO), colors.muted)
  if (next) text(context, fillBlanks(words.labels.wordChart.nextRows, { rows: next.range, page: next.page }), left + width, footer, font('400', 7.5, SANS), colors.muted, 'right')
}

/** The Word chart's sheets, drawn one at a time by `makePage` (the PDF's blank page at its dpi); numbered from `first` of
 * `total`. */
export function* drawWordChartPages(words: PrintText, page: PageSize, makePage: () => { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }, first: number, total: number): Generator<HTMLCanvasElement> {
  if (!words.wordChart) return
  const layout = layoutWordChart(scratch(), words, page)
  const ink = printInkOf(words)
  const left = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2
  for (const [index, sheet] of layout.pages.entries()) {
    const { canvas, context } = makePage()
    drawHeader(context, words, sheet.range, first + index, total, left, width, ink)
    drawKey(context, words, layout, left, width, ink)
    sheet.columns.forEach((rows, column) => {
      let y = layout.rowsTop
      for (const placed of rows) {
        drawRow(context, layout, placed, left + column * (COLUMN + GAP), y, ink)
        y += placed.height
      }
    })
    const following = layout.pages[index + 1]
    drawFooter(context, words, following && { range: following.range, page: first + index + 1 }, left, width, page.height, ink)
    yield canvas
  }
}

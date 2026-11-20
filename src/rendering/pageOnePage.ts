import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { chartLookOf, drawChartParts, K } from './chartVector'
import { listHeader, TABLE_COLUMN_GAP, TITLE_MAKER_ROW, TITLE_NAME_ROW, titleRows, type ColorsSlice } from './overviewLayout'
import { NEEDED_COLUMNS, NEEDED_HEADING, type PageOneLayout } from './pageOneLayout'
import { blankPage, drawBoard, drawEmptySwatch, drawMark, drawParts, drawRulers, font, MONO, partLabel, pt, SANS, SERIF, text, wrap } from './printPages'
import { COLOR_INK, printInkOf, type PrintInk } from './printInk'
import { areaRegion, displayedGrid, mm, PRINT_MARGIN, type PageSize, type PrintPlan, type TrimmedArea } from './printPlan'
import type { PrintText } from './printText'
import { geometryDrawnAlone } from './space'
import { fillBlanks } from '../domain/fillBlanks'
import { PdfContent } from '../domain/pdfContent'
import type { Project } from '../domain/project'
import type { SwatchLetters } from '../domain/swatchLetters'

// Page 1 of the PDF and the list pages after it (ticket 0914; PrintPage1 card): the title block, the whole piece (the
// working chart as PDF drawing, ADR 0043, or the overview of its parts), one Beads needed table and the footer.

const RULE = pt(0.75)
/** A row's swatch, drawn like a bead with its Swatch letter on it. */
const SWATCH = mm(3.6)
/** Within a column of Beads needed, from its right edge: grams end at the edge, beads at this, the code starts at the
 * last, the color name has the rest. */
const BEADS_RIGHT = mm(12)
const CODE_LEFT = BEADS_RIGHT + mm(22)
const CODE_ROOM = mm(12)
const NAME_LEFT = mm(5.5)
/** The room each column head has, the code's and the beads' shared between them.
 * @internal Its test checks every language's column heads against it. */
export const NEEDED_ROOM = { grams: BEADS_RIGHT - mm(1), codeAndBeads: CODE_LEFT - BEADS_RIGHT - mm(1) }

/** Ruler numbers on the overview every 10 instead of every 5 when 5 beads are narrower than this. */
const MIN_FIVE_STEP = mm(5.5)

/** The Frame's name (else the Project's) as the title, "by {maker}" under it and one line of technique, bead, grid and
 * size; the title and the maker are left out when empty. */
function drawTitleBlock(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, ink: PrintInk): void {
  const { colors } = ink
  const width = page.width - PRINT_MARGIN * 2
  const rows = titleRows(words)
  let y = PRINT_MARGIN
  if (rows.name) {
    text(context, words.name.trim(), PRINT_MARGIN, y + pt(19), font('700', 22, SANS), colors.ink, 'left', width)
    y += TITLE_NAME_ROW
  }
  if (rows.maker) {
    text(context, fillBlanks(words.labels.byMaker, { maker: words.maker }), PRINT_MARGIN, y + pt(11), font('italic 400', 13, SERIF), colors.muted, 'left', width)
    y += TITLE_MAKER_ROW
  }
  text(context, [words.techniqueWord, words.metaLine].join(' · '), PRINT_MARGIN, y + pt(6), font('400', 7.5, MONO), colors.muted, 'left', width)
}

/** The overview (ticket 0914): the piece trimmed to `trim` (ticket 1128) on its board, no letters, rulers every 5 (10 when
 * the beads are small), an empty position bare board, under its cross with `emptyGrid` (ticket 1127), in `ink`, and the
 * lines where the chart parts meet with their page pills. */
function drawOverview(context: CanvasRenderingContext2D, project: Project, overview: NonNullable<PageOneLayout['overview']>, trim: TrimmedArea, plan: PrintPlan, labels: PrintText['labels'], emptyGrid: boolean, ink: PrintInk): void {
  const board = { ...overview.board, ...overview.extent }
  const piece = areaRegion(project, trim)
  drawBoard(context, project, { x: piece.x * overview.zoom, y: piece.y * overview.zoom, width: piece.width * overview.zoom, height: piece.height * overview.zoom }, overview.zoom, board, emptyGrid, ink)
  const grid = displayedGrid(project)
  const every = grid.stepAcross * overview.zoom * 5 >= MIN_FIVE_STEP ? 5 : 10
  // A Custom frame's beads keep no rows and columns to number (ticket 0594).
  if (geometryDrawnAlone(project).grid) drawRulers(context, project, overview.zoom, board, { first: trim.firstAcross, last: trim.lastAcross }, { first: trim.firstDown, last: trim.lastDown }, ink, every)
  if (plan.parts.length > 1) drawParts(context, project, plan, labels, overview.zoom, board, ink)
}

/** The footer of the Cover page, page 1 and the list pages: the mark, the brand and the date and time on the left, the page
 * number on the right ("1 / 3"). The Cover page's is always in color. */
export function drawFooter(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, pageNumber: number, pageCount: number, ink: PrintInk = COLOR_INK): void {
  const { colors } = ink
  const baseline = page.height - PRINT_MARGIN - mm(1)
  drawMark(context, PRINT_MARGIN, baseline - mm(3.4), mm(4), colors.accent)
  const brand = text(context, 'openbeads', PRINT_MARGIN + mm(5.5), baseline, font('700', 7.5, SANS), colors.ink)
  text(context, words.exportedAt, PRINT_MARGIN + mm(5.5) + brand + mm(2), baseline, font('400', 7.5, MONO), colors.muted)
  text(context, `${pageNumber} / ${pageCount}`, page.width - PRINT_MARGIN, baseline, font('400', 7.5, MONO), colors.muted, 'right')
}

/** A rule across the table. */
function rule(context: CanvasRenderingContext2D, x: number, y: number, width: number, color: string, lineWidth: number): void {
  context.strokeStyle = color
  context.lineWidth = lineWidth
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + width, y)
  context.stroke()
}

/** Page 1's key item for an empty position (ticket 0963), at the right end of Beads needed's heading: the chart's cross on
 * an empty swatch, then "empty", as the Row by row key ends. */
function drawEmptyItem(context: CanvasRenderingContext2D, empty: string, right: number, top: number, ink: PrintInk): void {
  const named = text(context, empty, right, top + mm(3.5), font('400', 7.5, SANS), ink.colors.ink, 'right')
  const size = mm(3)
  drawEmptySwatch(context, right - named - mm(1.6) - size, top + mm(3.5) - pt(2.8) - size / 2, size, pt(0.5), ink)
}

/** Beads needed, printed once (ticket 0914): `slice` one to a row across the page or in two columns (ticket 1096), each a
 * swatch, name, code, beads, grams; then the Total and the grams note. The heading names the Bead and, with `empty`, the
 * chart's cross; an unknown Bead has no name, no grams and no note. */
function drawNeeded(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, letters: SwatchLetters, slice: ColorsSlice, top: number, ink: PrintInk, empty?: string): void {
  const { labels } = words
  const { colors } = ink
  const x = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2
  const heading = text(context, labels.beadsNeeded, x, top + mm(3.5), font('600', 8.5, SANS), colors.ink)
  if (words.beadName) text(context, ` · ${words.beadName}`, x + heading, top + mm(3.5), font('500', 8.5, SANS), colors.ink, 'left', width / 2)
  if (empty) drawEmptyItem(context, empty, x + width, top, ink)
  rule(context, x, top + NEEDED_HEADING - mm(1), width, colors.ink, RULE)

  if (words.colors.length === 0) {
    text(context, labels.noColors, x, top + NEEDED_HEADING + mm(3.5), font('400', 8, SANS), colors.muted, 'left', width)
    return
  }

  const column = slice.columns === 1 ? width : (width - TABLE_COLUMN_GAP) / 2
  const grams = words.colors.some((color) => color.grams)
  const codes = words.colors.some((color) => color.code)
  const head = font('400', 6.5, MONO)
  const headY = top + NEEDED_HEADING + mm(2.6)
  for (const left of [x, x + column + TABLE_COLUMN_GAP].slice(0, slice.count > slice.rows ? 2 : 1)) {
    const right = left + column
    text(context, labels.columnColor.toLowerCase(), left + NAME_LEFT, headY, head, colors.muted)
    if (codes) text(context, labels.columnCode.toLowerCase(), right - CODE_LEFT, headY, head, colors.muted)
    text(context, labels.columnBeads.toLowerCase(), right - BEADS_RIGHT, headY, head, colors.muted, 'right')
    if (grams) text(context, labels.columnGrams.toLowerCase(), right, headY, head, colors.muted, 'right')
  }

  const rowsTop = top + NEEDED_HEADING + NEEDED_COLUMNS
  const { rowHeight } = slice
  const swatch = Math.min(SWATCH, rowHeight * 0.8)
  const name = font('400', 7.5, SANS)
  const number = font('400', 7, MONO)
  words.colors.slice(slice.from, slice.from + slice.count).forEach((color, index) => {
    const left = x + (index < slice.rows ? 0 : column + TABLE_COLUMN_GAP)
    const right = left + column
    const rowTop = rowsTop + (index % slice.rows) * rowHeight
    const middle = rowTop + rowHeight / 2
    const baseline = middle + pt(2.8)
    rule(context, left, rowTop, column, colors.line, pt(0.5))
    context.fillStyle = ink.fill(color.hex)
    context.beginPath()
    context.roundRect(left, middle - swatch / 2, swatch, swatch, swatch * 0.28)
    context.fill()
    context.strokeStyle = colors.lineStrong
    context.lineWidth = pt(0.5)
    context.stroke()
    const letter = letters[color.hex]
    if (letter) drawBeadLetter(context, { x: left, y: middle - swatch / 2, size: swatch, color: color.hex, letter, dimmed: false, theme: PRINT_THEME, ...(ink.oneInk ? { ink: ink.letter(color.hex) } : {}) })
    const named = color.code ? color.name.replace(` · ${color.code}`, '') : color.name
    text(context, named, left + NAME_LEFT, baseline, name, colors.ink, 'left', column - CODE_LEFT - NAME_LEFT - mm(1.5))
    if (color.code) text(context, color.code, right - CODE_LEFT, baseline, number, colors.muted, 'left', CODE_ROOM)
    text(context, color.beads, right - BEADS_RIGHT, baseline, number, colors.ink, 'right')
    if (color.grams) text(context, color.grams, right, baseline, number, colors.ink, 'right')
  })
  if (!slice.total) return

  let y = rowsTop + slice.rows * rowHeight
  rule(context, x, y, width, colors.ink, RULE)
  y += mm(4.4)
  text(context, `${labels.total} · ${words.colorsCount}`, x, y, font('700', 8, SANS), colors.ink, 'left', width / 2)
  const sums = [words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  text(context, sums, x + width, y, font('500', 7.5, MONO), colors.ink, 'right')
  if (words.gramsNote) {
    y += mm(1)
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      y += pt(9)
      text(context, line, x, y, font('400', 6.5, SANS), colors.muted)
    }
  }
}

/** Page 1 (ticket 0914): the title block, the chart whole (strips each under their label) or the overview with the parts
 * marked, Beads needed and the footer. The chart is drawing in points laid over the picture (ADR 0043). */
export function drawPageOne(project: Project, words: PrintText, layout: PageOneLayout, plan: PrintPlan, scale = 1): { canvas: HTMLCanvasElement; drawing?: string } {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const ink = printInkOf(words)
  const { colors } = ink
  drawTitleBlock(context, page, words, ink)
  let drawing: string | undefined
  if (layout.overview) {
    drawOverview(context, project, layout.overview, plan.trim, plan, words.labels, !!words.emptyGrid, ink)
  } else {
    const pdf = new PdfContent(page.height * K)
    const pads = drawChartParts(pdf, project, plan, plan.parts, project.paletteLetters ?? {}, layout.area, chartLookOf(words), ink)
    if (plan.parts.length > 1) {
      plan.parts.forEach((part, index) => text(context, partLabel(plan.trim, words.labels, part), pads[index]!.x, pads[index]!.y - mm(2), font('400', 7.5, MONO), colors.muted))
    }
    drawing = pdf.toString()
  }
  drawNeeded(context, page, words, project.paletteLetters ?? {}, layout.needed, layout.needed.y, ink, words.empty)
  drawFooter(context, page, words, plan.pageOneNumber, plan.pageCount, ink)
  return { canvas, ...(drawing === undefined ? {} : { drawing }) }
}

/** A list page (`index` from 0 in `layout.lists`, the page after page 1 and the list pages before it): Beads needed carried
 * on, under the Project's name. */
export function drawNeededListPage(project: Project, words: PrintText, layout: PageOneLayout, index: number, plan: PrintPlan, scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const ink = printInkOf(words)
  if (listHeader(words) > 0) text(context, words.name.trim(), PRINT_MARGIN, PRINT_MARGIN + pt(12), font('700', 13, SANS), ink.colors.ink, 'left', page.width - PRINT_MARGIN * 2)
  drawNeeded(context, page, words, project.paletteLetters ?? {}, layout.lists[index]!, PRINT_MARGIN + listHeader(words), ink)
  drawFooter(context, page, words, plan.pageOneNumber + 1 + index, plan.pageCount, ink)
  return canvas
}

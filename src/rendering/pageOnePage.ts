import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { drawChartParts } from './chartVector'
import { listHeader, TABLE_COLUMN_GAP, type ColorsSlice } from './coverLayout'
import { drawTitleBlock, drawWholeBoard } from './coverPage'
import { NEEDED_COLUMNS, NEEDED_HEADING, type PageOneLayout } from './pageOneLayout'
import { blankPage, drawMark, font, MONO, partLabel, pt, SANS, text, wrap } from './printPages'
import { PRINT_COLORS } from './printColors'
import { mm, PRINT_MARGIN, type PageSize, type PrintPlan } from './printPlan'
import type { PrintText } from './printText'
import type { Project } from '../domain/project'
import type { SwatchLetters } from '../domain/swatchLetters'

// Page 1 of the PDF and the list pages after it (ticket 0914; PrintPage1 card): the title block, the whole piece (the
// working chart as PDF drawing, ADR 0043, or the overview of its parts), one Beads needed table and the footer.

const RULE = pt(0.75)
/** A row's swatch, drawn like a bead with its Swatch letter on it. */
const SWATCH = mm(3.6)
/** Within a column of Beads needed, from its right edge: to buy, grams and beads end at these, the code starts at the
 * last, the color name has the rest. */
const GRAMS_RIGHT = mm(17)
const BEADS_RIGHT = GRAMS_RIGHT + mm(12)
const CODE_LEFT = BEADS_RIGHT + mm(22)
const CODE_ROOM = mm(12)
const NAME_LEFT = mm(5.5)
/** The room each column head has, the code's and the beads' shared between them.
 * @internal Its test checks every language's column heads against it. */
export const NEEDED_ROOM = { toBuy: GRAMS_RIGHT - mm(1), grams: BEADS_RIGHT - GRAMS_RIGHT - mm(1), codeAndBeads: CODE_LEFT - BEADS_RIGHT - mm(1) }

/** The footer of page 1 and the list pages: the mark, the brand and the date and time on the left, the page number on the
 * right ("1 / 3"). */
function drawFooter(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, pageNumber: number, pageCount: number): void {
  const baseline = page.height - PRINT_MARGIN - mm(1)
  drawMark(context, PRINT_MARGIN, baseline - mm(3.4), mm(4), PRINT_COLORS.accent)
  const brand = text(context, 'openbeads', PRINT_MARGIN + mm(5.5), baseline, font('700', 7.5, SANS), PRINT_COLORS.ink)
  text(context, words.exportedAt, PRINT_MARGIN + mm(5.5) + brand + mm(2), baseline, font('400', 7.5, MONO), PRINT_COLORS.muted)
  text(context, `${pageNumber} / ${pageCount}`, page.width - PRINT_MARGIN, baseline, font('400', 7.5, MONO), PRINT_COLORS.muted, 'right')
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

/** Beads needed, one table printed once (ticket 0914): the colors of `slice` in two columns reading down, each a letter
 * swatch, color name, code, beads, grams and to buy; on the page it ends on, the Total with beads, grams and tubes and the
 * grams note. An unknown Bead has no grams, no tubes and no note. */
function drawNeeded(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, letters: SwatchLetters, slice: ColorsSlice, top: number): void {
  const { labels } = words
  const x = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2
  text(context, labels.beadsNeeded, x, top + mm(3.5), font('600', 8.5, SANS), PRINT_COLORS.ink)
  rule(context, x, top + NEEDED_HEADING - mm(1), width, PRINT_COLORS.ink, RULE)

  if (words.colors.length === 0) {
    text(context, labels.noColors, x, top + NEEDED_HEADING + mm(3.5), font('400', 8, SANS), PRINT_COLORS.muted, 'left', width)
    return
  }

  const column = (width - TABLE_COLUMN_GAP) / 2
  const grams = words.colors.some((color) => color.grams)
  const codes = words.colors.some((color) => color.code)
  const head = font('400', 6.5, MONO)
  const headY = top + NEEDED_HEADING + mm(2.6)
  for (const left of [x, x + column + TABLE_COLUMN_GAP].slice(0, slice.count > slice.rows ? 2 : 1)) {
    const right = left + column
    text(context, labels.columnColor.toLowerCase(), left + NAME_LEFT, headY, head, PRINT_COLORS.muted)
    if (codes) text(context, labels.columnCode.toLowerCase(), right - CODE_LEFT, headY, head, PRINT_COLORS.muted)
    text(context, labels.columnBeads.toLowerCase(), right - BEADS_RIGHT, headY, head, PRINT_COLORS.muted, 'right')
    if (grams) {
      text(context, labels.columnGrams.toLowerCase(), right - GRAMS_RIGHT, headY, head, PRINT_COLORS.muted, 'right')
      text(context, labels.columnToBuy.toLowerCase(), right, headY, head, PRINT_COLORS.muted, 'right')
    }
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
    rule(context, left, rowTop, column, PRINT_COLORS.line, pt(0.5))
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(left, middle - swatch / 2, swatch, swatch, swatch * 0.28)
    context.fill()
    context.strokeStyle = PRINT_COLORS.lineStrong
    context.lineWidth = pt(0.5)
    context.stroke()
    const letter = letters[color.hex]
    if (letter) drawBeadLetter(context, { x: left, y: middle - swatch / 2, size: swatch, color: color.hex, letter, dimmed: false, theme: PRINT_THEME })
    const named = color.code ? color.name.replace(` · ${color.code}`, '') : color.name
    text(context, named, left + NAME_LEFT, baseline, name, PRINT_COLORS.ink, 'left', column - CODE_LEFT - NAME_LEFT - mm(1.5))
    if (color.code) text(context, color.code, right - CODE_LEFT, baseline, number, PRINT_COLORS.muted, 'left', CODE_ROOM)
    text(context, color.beads, right - BEADS_RIGHT, baseline, number, PRINT_COLORS.ink, 'right')
    if (color.grams) text(context, color.grams, right - GRAMS_RIGHT, baseline, number, PRINT_COLORS.ink, 'right')
    if (color.tubes) text(context, color.tubes, right, baseline, number, PRINT_COLORS.ink, 'right')
  })
  if (!slice.total) return

  let y = rowsTop + slice.rows * rowHeight
  rule(context, x, y, width, PRINT_COLORS.ink, RULE)
  y += mm(4.4)
  text(context, `${labels.total} · ${words.colorsCount}`, x, y, font('700', 8, SANS), PRINT_COLORS.ink, 'left', width / 2)
  const sums = [words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`, words.totalTubes].filter(Boolean).join(' · ')
  text(context, sums, x + width, y, font('500', 7.5, MONO), PRINT_COLORS.ink, 'right')
  if (words.gramsNote) {
    y += mm(1)
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      y += pt(9)
      text(context, line, x, y, font('400', 6.5, SANS), PRINT_COLORS.muted)
    }
  }
}

/** Page 1 of the PDF (ticket 0914): the title block, then the chart whole as PDF drawing (lettered, numbered, with the
 * lines every 5 and 10; strips each under their label) or, when it is cut into parts, the overview without letters with
 * the parts marked; Beads needed under it, and the footer. The drawing is in points, laid over the page's picture. */
export function drawPageOne(project: Project, words: PrintText, layout: PageOneLayout, plan: PrintPlan, scale = 1): { canvas: HTMLCanvasElement; drawing?: string } {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  drawTitleBlock(context, page, words)
  let drawing: string | undefined
  if (layout.overview) {
    drawWholeBoard(context, project, layout.overview, undefined, plan, words.labels)
  } else {
    const { content, pads } = drawChartParts(project, plan, plan.parts, page.height, project.paletteLetters ?? {}, layout.area)
    if (plan.parts.length > 1) {
      plan.parts.forEach((part, index) => text(context, partLabel(project, words.labels, part), pads[index]!.x, pads[index]!.y - mm(2), font('400', 7.5, MONO), PRINT_COLORS.muted))
    }
    drawing = content.toString()
  }
  drawNeeded(context, page, words, project.paletteLetters ?? {}, layout.needed, layout.needed.y)
  drawFooter(context, page, words, 1, plan.pageCount)
  return { canvas, ...(drawing === undefined ? {} : { drawing }) }
}

/** A list page (`index` from 0 in `layout.lists`, the page after page 1 and the list pages before it): Beads needed carried
 * on, under the Project's name. */
export function drawNeededListPage(project: Project, words: PrintText, layout: PageOneLayout, index: number, plan: PrintPlan, scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  if (listHeader(words) > 0) text(context, words.name.trim(), PRINT_MARGIN, PRINT_MARGIN + pt(12), font('700', 13, SANS), PRINT_COLORS.ink, 'left', page.width - PRINT_MARGIN * 2)
  drawNeeded(context, page, words, project.paletteLetters ?? {}, layout.lists[index]!, PRINT_MARGIN + listHeader(words))
  drawFooter(context, page, words, index + 2, plan.pageCount)
  return canvas
}

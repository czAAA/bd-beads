import { frameWeave } from '../domain/layerWeave'
import { projectDimensions } from '../domain/projectExtent'
import { shownLetters } from '../domain/paletteEdits'
import type { Project } from '../domain/project'
import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { TABLE_COLUMN_GAP, TABLE_HEAD, TITLE_MAKER_ROW, TITLE_NAME_ROW, listHeader, titleRows, type ColorsSlice, type CoverLayout } from './coverLayout'
import { blankPage, drawBoard, drawMark, drawParts, drawRulers, font, MONO, pt, SANS, SERIF, text, wrap } from './printPages'
import { PRINT_COLORS } from './printColors'
import { sheetGeometry } from './space'
import { A4_PORTRAIT, displayedGrid, mm, PRINT_MARGIN, type PageSize, type PrintPlan } from './printPlan'
import type { PrintText } from './printText'
import { displayedExtentPx } from './surfaceView'
import { fillBlanks } from '../domain/fillBlanks'

// The Cover page (ticket 0583; printed-output.md, PrintPage1 and PngExport cards): the one A4 portrait page that opens the
// PDF and is the PNG, and the list pages Beads needed continues on. Drawn here once for both formats.

/** Rulers number every 10 instead of every 5 when 5 beads are narrower than this. */
const MIN_FIVE_STEP = mm(5.5)

/** The date and time at the right, the wordmark at the left, on the bottom line of the margin. */
function drawFooter(context: CanvasRenderingContext2D, page: PageSize, words: PrintText): void {
  const baseline = page.height - PRINT_MARGIN - mm(1)
  drawMark(context, PRINT_MARGIN, baseline - mm(3.4), mm(4), PRINT_COLORS.accent)
  text(context, 'openbeads', PRINT_MARGIN + mm(5.5), baseline, font('700', 7.5, SANS), PRINT_COLORS.ink)
  text(context, words.exportedAt, page.width - PRINT_MARGIN, baseline, font('400', 7.5, MONO), PRINT_COLORS.muted, 'right')
}

/** The Project's name as the title, "by {maker}" under it and one line of technique, bead, grid and size; the title and
 * the maker are left out when empty. */
function drawTitleBlock(context: CanvasRenderingContext2D, page: PageSize, words: PrintText): void {
  const width = page.width - PRINT_MARGIN * 2
  const rows = titleRows(words)
  let y = PRINT_MARGIN
  if (rows.name) {
    text(context, words.name.trim(), PRINT_MARGIN, y + pt(19), font('700', 22, SANS), PRINT_COLORS.ink, 'left', width)
    y += TITLE_NAME_ROW
  }
  if (rows.maker) {
    text(context, fillBlanks(words.labels.byMaker, { maker: words.maker }), PRINT_MARGIN, y + pt(11), font('italic 400', 13, SERIF), PRINT_COLORS.muted, 'left', width)
    y += TITLE_MAKER_ROW
  }
  text(context, [words.techniqueWord, words.metaLine].join(' · '), PRINT_MARGIN, y + pt(6), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width)
}

/** Beads needed: the heading, the colors of `slice` in two columns reading down (swatch, name, beads, grams) and, on the
 * page it ends on, the Total line and the grams note. */
function drawColors(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, slice: ColorsSlice, top: number): void {
  const { labels } = words
  const x = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2
  const both = [words.colorsCount, words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  text(context, labels.beadsNeeded, x, top + mm(2), font('700', 10, SANS), PRINT_COLORS.ink)
  let y = top + TABLE_HEAD

  if (words.colors.length === 0) {
    text(context, labels.noColors, x, y + mm(3), font('400', 8, SANS), PRINT_COLORS.muted, 'left', width)
    return
  }

  const column = (width - TABLE_COLUMN_GAP) / 2
  const { rowHeight } = slice
  const lettered = words.colors.some((color) => color.letter)
  const beadSize = lettered ? Math.min(mm(4.6), rowHeight * 0.95) : Math.min(mm(3.4), rowHeight * 0.7)
  words.colors.slice(slice.from, slice.from + slice.count).forEach((color, index) => {
    const left = x + (index < slice.rows ? 0 : column + TABLE_COLUMN_GAP)
    const rowTop = y + (index % slice.rows) * rowHeight
    const middle = rowTop + rowHeight / 2
    context.strokeStyle = PRINT_COLORS.line
    context.lineWidth = pt(0.5)
    context.beginPath()
    context.moveTo(left, rowTop)
    context.lineTo(left + column, rowTop)
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
  if (!slice.total) return

  y += slice.rows * rowHeight
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

/** The Cover page: title block, the framed Schema with its rulers, Beads needed and the footer. `plan` is the PDF's: with
 * it the lines where the chart parts meet are drawn too (the PNG has no pages to point at). */
export function drawCoverPage(project: Project, words: PrintText, layout: CoverLayout, scale = 1, plan?: PrintPlan): HTMLCanvasElement {
  const { canvas, context } = blankPage(A4_PORTRAIT, scale)
  drawTitleBlock(context, A4_PORTRAIT, words)

  // The whole Project on its board, rulers with a number every 5 (10 when the beads are too small for that).
  const board = { ...layout.board, ...layout.extent }
  const whole = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, layout.zoom, project.rotation, frameWeave(project).cell)
  drawBoard(context, project, { x: 0, y: 0, width: whole.width, height: whole.height }, layout.zoom, board, shownLetters(project), true)
  const grid = displayedGrid(project)
  const every = grid.stepAcross * layout.zoom * 5 >= MIN_FIVE_STEP ? 5 : 10
  // A Custom frame's beads keep no rows and columns to number (ticket 0594).
  if (sheetGeometry(project).inRowsAndColumns) drawRulers(context, project, layout.zoom, board, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 }, every)
  if (plan && plan.parts.length > 1) drawParts(context, project, plan, words.labels, layout.zoom, board)

  drawColors(context, A4_PORTRAIT, words, layout.cover, layout.cover.y)
  drawFooter(context, A4_PORTRAIT, words)
  return canvas
}

/** A list page (`index` from 0 in `layout.lists`): where Beads needed goes on when the cover has no room for it all. */
export function drawListPage(words: PrintText, layout: CoverLayout, index: number, scale = 1): HTMLCanvasElement {
  const { canvas, context } = blankPage(A4_PORTRAIT, scale)
  if (listHeader(words) > 0) text(context, words.name.trim(), PRINT_MARGIN, PRINT_MARGIN + pt(12), font('700', 13, SANS), PRINT_COLORS.ink, 'left', A4_PORTRAIT.width - PRINT_MARGIN * 2)
  drawColors(context, A4_PORTRAIT, words, layout.lists[index]!, PRINT_MARGIN + listHeader(words))
  drawFooter(context, A4_PORTRAIT, words)
  return canvas
}

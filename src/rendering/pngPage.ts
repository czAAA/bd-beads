import { mm, type PageSize } from './printPlan'
import { drawAccentLine, drawBackgroundName, drawMark, font, MONO, pt, SANS, SERIF, text, wrap } from './printPages'
import { PRINT_COLORS } from './printColors'
import type { PrintText } from './printText'

/**
 * The PNG's story column (ticket 164; printed-output.md's PNG image section, the PngExport and PrintStrips cards): the
 * chart is drawn straight onto the same canvas the picture streams from (projectExport.ts); this is the rest — the
 * words, in a column beside a typical Project or under a wide one, told in the shared print pieces from ticket 162 so
 * the picture and the PDF read alike. Reused for layout (a throwaway context, to find how tall it needs to be) and for
 * drawing (the real one, offset for the band being streamed): both calls go through `drawStory`, so they can't drift.
 */

/** The gap between the chart and the story, and between the story's own blocks. */
const PNG_GUTTER = mm(8)
/** The story column's width beside a typical Project. */
const PNG_STORY_WIDTH = mm(58)
const ROW = mm(6.5)
const SWATCH = mm(3.2)

export interface PngLayout {
  width: number
  height: number
  chart: { width: number; height: number }
  wide: boolean
  storyX: number
  storyY: number
  storyWidth: number
}

/** Where the chart and the story column sit: beside a typical Project, under a wide one (printed-output.md). Whole px throughout: the streamed encoder needs an exact pixel height, and mm()/pt() math isn't naturally whole. */
export function pngLayout(chart: { width: number; height: number }, words: PrintText): PngLayout {
  const wide = chart.width > chart.height
  const scratch = document.createElement('canvas').getContext('2d')!
  if (wide) {
    const bottom = Math.ceil(drawStory(scratch, words, 0, 0, chart.width, true))
    return { width: chart.width, height: chart.height + Math.ceil(PNG_GUTTER) + bottom, chart, wide, storyX: 0, storyY: chart.height + Math.ceil(PNG_GUTTER), storyWidth: chart.width }
  }
  const storyWidth = Math.ceil(PNG_STORY_WIDTH)
  const bottom = Math.ceil(drawStory(scratch, words, 0, 0, storyWidth, false))
  return { width: chart.width + Math.ceil(PNG_GUTTER) + storyWidth, height: Math.max(chart.height, bottom), chart, wide, storyX: chart.width + Math.ceil(PNG_GUTTER), storyY: 0, storyWidth }
}

/** Draws the story onto the band being streamed: `bandTop` is the top of that band in the whole picture. */
export function drawPngStory(context: CanvasRenderingContext2D, words: PrintText, layout: PngLayout, bandTop: number): void {
  drawStory(context, words, layout.storyX, layout.storyY - bandTop, layout.storyWidth, layout.wide)
}

/** Clips to the board's rounded corners before the chart is drawn onto the same canvas: call `context.restore()` after. `bandTop` is the top of the band being streamed, in the whole picture. */
export function clipToPngBoard(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, bandTop: number): void {
  context.save()
  context.beginPath()
  context.roundRect(x, y - bandTop, width, height, mm(2))
  context.clip()
}

/** The title, "by {maker}" (left out when empty) and the bead/size line every layout starts with; returns where it ends. */
function drawStoryHeader(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
  const word = text(context, words.techniqueWord, x, y + pt(15), font('italic 400', 17, SERIF), PRINT_COLORS.accent)
  text(context, words.name, x + word + mm(2), y + pt(15), font('700', 11, SANS), PRINT_COLORS.ink, 'left', width - word - mm(2))
  y += mm(7)
  if (words.maker) {
    text(context, words.labels.byMaker.replace('{maker}', words.maker), x, y + pt(7), font('italic 400', 9, SERIF), PRINT_COLORS.muted, 'left', width)
    y += mm(5)
  }
  text(context, words.metaLine, x, y + pt(6), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width)
  return y + mm(7)
}

/** The date, the X1 mark and "bd-beads": the last thing every layout shows, bottom-left of its own block. */
function drawStoryBrand(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number): number {
  text(context, words.exportedAt, x, y, font('400', 7, MONO), PRINT_COLORS.muted)
  drawMark(context, x, y + mm(3.5), mm(4.5), PRINT_COLORS.accent)
  text(context, 'bd-beads', x + mm(6), y + mm(5), font('700', 7.5, SANS), PRINT_COLORS.ink)
  return y + mm(7)
}

/** Beads needed, one or two columns; returns where it ends. */
function drawStoryColors(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number, columns: 1 | 2): number {
  const { labels } = words
  text(context, labels.beadsNeeded, x, y + pt(8), font('700', 9, SANS), PRINT_COLORS.ink)
  y += mm(6)
  const both = [words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  text(context, both, x, y + pt(6), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width)
  y += mm(7)

  if (words.colors.length === 0) {
    text(context, labels.noColors, x, y + pt(6), font('400', 8, SANS), PRINT_COLORS.muted)
    return y + mm(5)
  }

  const colWidth = columns === 2 ? (width - mm(6)) / 2 : width
  const row = (colX: number, rowY: number, color: PrintText['colors'][number] | undefined, bold: boolean) => {
    const middle = rowY + ROW / 2
    if (color) {
      context.fillStyle = color.hex
      context.beginPath()
      context.roundRect(colX, middle - SWATCH / 2, SWATCH, SWATCH, SWATCH * 0.28)
      context.fill()
      context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      context.stroke()
    }
    const weight = bold ? '700' : '400'
    const gramsX = colX + colWidth
    const beadsX = colX + colWidth - (color?.grams || (bold && words.totalGrams) ? mm(11) : 0)
    const nameX = colX + SWATCH + mm(2)
    text(context, color ? color.name : labels.total, nameX, middle + pt(3), font(weight, 8, SANS), PRINT_COLORS.ink, 'left', beadsX - nameX - mm(3))
    text(context, color ? color.beads : words.totalBeads.replace(/\D+$/, ''), beadsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.ink, 'right')
    if (color ? color.grams : words.totalGrams) {
      text(context, (color ? color.grams : words.totalGrams)!, gramsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.muted, 'right')
    }
  }

  const rows = [...words.colors, undefined]
  const perColumn = columns === 2 ? Math.ceil(rows.length / 2) : rows.length
  let bottom = y
  for (let index = 0; index < rows.length; index += 1) {
    const column = Math.floor(index / perColumn)
    const rowIndex = index % perColumn
    const colX = x + column * (colWidth + mm(6))
    const rowY = y + rowIndex * ROW
    row(colX, rowY, rows[index], index === rows.length - 1)
    bottom = Math.max(bottom, rowY + ROW)
  }

  if (words.gramsNote) {
    bottom += mm(1)
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      bottom += pt(9)
      text(context, line, x, bottom, font('400', 6.5, SANS), PRINT_COLORS.muted)
    }
  }
  return bottom + mm(3)
}

/** The whole story, beside (one column) or under (two) a Project; returns where it ends. */
function drawStory(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number, wide: boolean): number {
  if (!wide) {
    const afterHeader = drawStoryHeader(context, words, x, y, width)
    const afterColors = drawStoryColors(context, words, x, afterHeader + mm(2), width, 1)
    return drawStoryBrand(context, words, x, afterColors + mm(1))
  }

  const leftWidth = Math.min(mm(46), width * 0.32)
  const rightX = x + leftWidth + PNG_GUTTER
  const rightWidth = width - leftWidth - PNG_GUTTER
  const afterHeader = drawStoryHeader(context, words, x, y, leftWidth)
  const afterBrand = drawStoryBrand(context, words, x, afterHeader + mm(4))
  const afterColors = drawStoryColors(context, words, rightX, y, rightWidth, 2)
  return Math.max(afterBrand, afterColors)
}

/** The background name large and pale under the board, and the accent line's curve behind it, drawn before the chart and the story. `bandTop` is the top of the band being streamed, in the whole picture. */
export function drawPngBackground(context: CanvasRenderingContext2D, page: PageSize, background: string, board: { x: number; top: number; bottom: number; right: number }, bandTop: number): void {
  drawBackgroundName(context, background, board.x, board.bottom - bandTop, 'left')
  drawAccentLine(context, page, { x: 0, y: page.height - mm(6) - bandTop }, { right: board.right, top: board.top - bandTop, bottom: board.bottom - bandTop })
}

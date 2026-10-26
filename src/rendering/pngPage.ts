import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { mm } from './printPlan'
import { drawMark, font, MONO, pt, SANS, SERIF, text, wrap } from './printPages'
import { PRINT_COLORS } from './printColors'
import type { PrintText } from './printText'

// The PNG's story (ticket 164; printed-output.md, PngExport and PrintStrips cards): the chart is drawn onto the
// canvas the picture streams from (projectExport.ts); this is the words, under it, via the shared print pieces
// (ticket 162). Used for layout (throwaway context) and drawing (real one) through `drawStory`, so they can't drift.

/** The gap between the chart and the story, and between the story's own blocks. */
const PNG_GUTTER = mm(8)
/** The narrowest picture: the story's two columns need this much room, so a small Schema is centred on a wider board. */
const PNG_MIN_WIDTH = mm(190)
/** The left block (technique, name, maker, size) of the story; the beads needed take the rest. */
export const PNG_STORY_LEFT = mm(62)
const ROW = mm(6.5)
const SWATCH = mm(3.2)
/** A swatch that carries a Swatch letter (ticket 0573): bigger, so the letter prints at the 6.5 pt floor. */
const SWATCH_LETTER = mm(4.6)

export interface PngLayout {
  width: number
  height: number
  /** Where the chart's left edge sits: 0 unless the picture was widened for the story. */
  chartX: number
  chart: { width: number; height: number }
  storyY: number
}

/** The chart on top at full width, the story under it, for every Schema (printed-output.md). Whole px throughout: the
 * streamed encoder needs an exact pixel height, and mm()/pt() math isn't naturally whole. */
export function pngLayout(chart: { width: number; height: number }, words: PrintText): PngLayout {
  const width = Math.max(chart.width, Math.ceil(PNG_MIN_WIDTH))
  const scratch = document.createElement('canvas').getContext('2d')!
  const bottom = Math.ceil(drawStory(scratch, words, 0, 0, width))
  const storyY = chart.height + Math.ceil(PNG_GUTTER)
  return { width, height: storyY + bottom, chartX: Math.floor((width - chart.width) / 2), chart, storyY }
}

/** Draws the story onto the band being streamed: `bandTop` is the top of that band in the whole picture. */
export function drawPngStory(context: CanvasRenderingContext2D, words: PrintText, layout: PngLayout, bandTop: number): void {
  drawStory(context, words, 0, layout.storyY - bandTop, layout.width)
}

/** Clips to the board's rounded corners before the chart is drawn onto the same canvas: call `context.restore()`
 * after. `bandTop` is the top of the band being streamed, in the whole picture. */
export function clipToPngBoard(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, bandTop: number): void {
  context.save()
  context.beginPath()
  context.roundRect(x, y - bandTop, width, height, mm(2))
  context.clip()
}

/** The title, "by {maker}" (left out when empty) and the bead/size line the story starts with; returns where it
 * ends. */
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

/** The bottom row of the story: the X1 mark and "bd-beads" on the left, the date and time on the right; returns where
 * it ends. */
function drawStoryBrand(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
  drawMark(context, x, y, mm(4.5), PRINT_COLORS.accent)
  text(context, 'bd-beads', x + mm(6), y + mm(3.5), font('700', 7.5, SANS), PRINT_COLORS.ink)
  text(context, words.exportedAt, x + width, y + mm(3.5), font('400', 7, MONO), PRINT_COLORS.muted, 'right')
  return y + mm(5)
}

/** Beads needed, in two columns; returns where it ends. */
function drawStoryColors(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
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

  const colWidth = (width - mm(6)) / 2
  const row = (colX: number, rowY: number, color: PrintText['colors'][number] | undefined, bold: boolean) => {
    const middle = rowY + ROW / 2
    const swatch = color?.letter ? SWATCH_LETTER : SWATCH
    if (color) {
      context.fillStyle = color.hex
      context.beginPath()
      context.roundRect(colX, middle - swatch / 2, swatch, swatch, swatch * 0.28)
      context.fill()
      context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      context.stroke()
      if (color.letter) drawBeadLetter(context, { x: colX, y: middle - swatch / 2, size: swatch, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    }
    const weight = bold ? '700' : '400'
    const gramsX = colX + colWidth
    const beadsX = colX + colWidth - (color?.grams || (bold && words.totalGrams) ? mm(11) : 0)
    const nameX = colX + SWATCH_LETTER + mm(2)
    text(context, color ? color.name : labels.total, nameX, middle + pt(3), font(weight, 8, SANS), PRINT_COLORS.ink, 'left', beadsX - nameX - mm(3))
    text(context, color ? color.beads : words.totalBeads.replace(/\D+$/, ''), beadsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.ink, 'right')
    if (color ? color.grams : words.totalGrams) {
      text(context, (color ? color.grams : words.totalGrams)!, gramsX, middle + pt(3), font(weight, 7.5, MONO), PRINT_COLORS.muted, 'right')
    }
  }

  const rows = [...words.colors, undefined]
  const perColumn = Math.ceil(rows.length / 2)
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

/** The whole story under the chart: header on the left, Beads needed in two columns on the right, the brand row
 * across the bottom; returns where it ends. */
function drawStory(context: CanvasRenderingContext2D, words: PrintText, x: number, y: number, width: number): number {
  const rightX = x + PNG_STORY_LEFT + PNG_GUTTER
  const afterHeader = drawStoryHeader(context, words, x, y, PNG_STORY_LEFT)
  const afterColors = drawStoryColors(context, words, rightX, y, width - PNG_STORY_LEFT - PNG_GUTTER)
  return drawStoryBrand(context, words, x, Math.max(afterHeader, afterColors) + mm(2), width)
}

import { drawBeadLetter, PRINT_THEME } from './beadLook'
import { PRINT_COLORS } from './printColors'
import { blankPage, drawMark, font, MONO, pt, SANS, text, wrap } from './printPages'
import { mm, PRINT_MARGIN, PRINT_PART_OVERLAP, type PrintPlan } from './printPlan'
import { headerMaker, type PrintText } from './printText'
import { fillBlanks } from '../domain/fillBlanks'

// The Specification page of the PDF (ticket 0581; PrintSpecification card): the full Beads needed table a weaver takes
// to the shop, then the Schema's facts and where each part is.

const HEADER = mm(20)
const RULE = pt(0.75)
const FOOTER = mm(8)
/** What the facts and the part map need under the table, and the table's row heights from comfortable to cramped. */
const LOWER_SECTION = mm(66)
const ROW_HEIGHT = mm(6.2)
const MIN_ROW_HEIGHT = mm(3.4)
const COLUMN_GAP = mm(8)
const FACT_STEP = mm(5.5)
const LABEL_WIDTH = mm(30)
/** The room the fact labels have before they would touch their values.
 * @internal Its test checks every language's labels against it. */
export const SPEC_LABEL_ROOM = LABEL_WIDTH - mm(2)
const MAX_MAP_CELL = mm(14)
/** The table's right-hand columns (to buy, grams, beads) and the code's room, from the right edge leftwards. */
const TO_BUY_WIDTH = mm(24)
const NUMBER_WIDTH = mm(22)
const CODE_WIDTH = mm(18)

/** The page after the chart pages: header, Beads needed in full with the Total and the grams note, then the facts and the
 * map of the parts. `rowByRowPage` is the Word chart's first page, named in the footer when one follows. */
export function drawSpecificationPage(words: PrintText, plan: PrintPlan, rowByRowPage: number | undefined, scale = 1): HTMLCanvasElement {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const { labels } = words
  const left = PRINT_MARGIN
  const width = page.width - PRINT_MARGIN * 2

  drawMark(context, left, PRINT_MARGIN, mm(5), PRINT_COLORS.accent)
  const meta = [words.techniqueWord, words.name, headerMaker(words.maker)].filter(Boolean).join(' · ')
  text(context, meta, left + mm(7), PRINT_MARGIN + mm(3.8), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', width - mm(40))
  text(context, fillBlanks(labels.page, { page: plan.specificationPage, pages: plan.pageCount }), left + width, PRINT_MARGIN + mm(3.8), font('700', 9, SANS), PRINT_COLORS.ink, 'right')
  text(context, labels.specification, left, PRINT_MARGIN + mm(13), font('600', 14, SANS), PRINT_COLORS.ink)

  let y = drawBeadsNeededTable(context, words, plan, left, PRINT_MARGIN + HEADER, width)
  y += mm(8)
  const half = (width - COLUMN_GAP) / 2
  drawFacts(context, words, plan, left, y, half)
  drawPartMap(context, words, plan, left + half + COLUMN_GAP, y, half)

  const footer = page.height - PRINT_MARGIN - mm(1.5)
  drawMark(context, left, footer - mm(3.4), mm(4), PRINT_COLORS.accent)
  text(context, 'openbeads', left + mm(5.5), footer, font('700', 7.5, SANS), PRINT_COLORS.ink)
  if (rowByRowPage) text(context, fillBlanks(labels.rowByRowOn, { page: rowByRowPage }), left + width, footer, font('400', 7.5, SANS), PRINT_COLORS.muted, 'right')
  return canvas
}

/** The table under a 1.5 px rule: letter (with Letters on), swatch, color, brand code, beads, grams, to buy; the Total
 * under a rule; the grams note. Returns where it ends. */
function drawBeadsNeededTable(context: CanvasRenderingContext2D, words: PrintText, plan: PrintPlan, left: number, top: number, width: number): number {
  const { labels } = words
  const right = left + width
  const hair = (y: number, color: string, lineWidth: number) => {
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.beginPath()
    context.moveTo(left, y)
    context.lineTo(right, y)
    context.stroke()
  }

  hair(top, PRINT_COLORS.ink, RULE)
  if (words.colors.length === 0) {
    text(context, labels.noColors, left, top + mm(8), font('400', 8, SANS), PRINT_COLORS.muted, 'left', width)
    return top + mm(12)
  }

  const lettered = words.colors.some((color) => color.letter)
  const toBuyX = right
  const gramsX = toBuyX - TO_BUY_WIDTH
  const beadsX = gramsX - NUMBER_WIDTH
  const codeX = beadsX - NUMBER_WIDTH
  const swatchX = left + (lettered ? mm(9) : 0)
  const nameX = swatchX + mm(8)
  const head = font('400', 6.5, MONO)
  const headY = top + mm(4.5)
  if (lettered) text(context, labels.columnLetter.toLowerCase(), left, headY, head, PRINT_COLORS.muted)
  text(context, labels.columnColor.toLowerCase(), swatchX, headY, head, PRINT_COLORS.muted)
  text(context, labels.columnCode.toLowerCase(), codeX - CODE_WIDTH, headY, head, PRINT_COLORS.muted)
  text(context, labels.columnBeads.toLowerCase(), beadsX, headY, head, PRINT_COLORS.muted, 'right')
  text(context, labels.columnGrams.toLowerCase(), gramsX, headY, head, PRINT_COLORS.muted, 'right')
  text(context, labels.columnToBuy.toLowerCase(), toBuyX, headY, head, PRINT_COLORS.muted, 'right')

  const rowsTop = top + mm(7)
  const room = plan.page.height - PRINT_MARGIN - FOOTER - LOWER_SECTION - rowsTop - mm(22)
  const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(ROW_HEIGHT, room / words.colors.length))
  const swatch = Math.min(mm(4.4), rowHeight * 0.8)
  const rowStyle = font('400', 8, SANS)
  const numberStyle = font('400', 7.5, MONO)

  words.colors.forEach((color, index) => {
    const rowTop = rowsTop + index * rowHeight
    const middle = rowTop + rowHeight / 2
    const baseline = middle + pt(3)
    if (index > 0) hair(rowTop, PRINT_COLORS.line, pt(0.5))
    if (lettered && color.letter) text(context, color.letter, left, baseline, font('600', 8, SANS), PRINT_COLORS.ink)
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(swatchX, middle - swatch / 2, swatch, swatch, swatch * 0.28)
    context.fill()
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.lineWidth = pt(0.5)
    context.stroke()
    if (color.letter) drawBeadLetter(context, { x: swatchX, y: middle - swatch / 2, size: swatch, color: color.hex, letter: color.letter, dimmed: false, theme: PRINT_THEME })
    const named = color.code ? color.name.replace(` · ${color.code}`, '') : color.name
    text(context, named, nameX, baseline, rowStyle, PRINT_COLORS.ink, 'left', codeX - CODE_WIDTH - mm(2) - nameX)
    if (color.code) text(context, color.code, codeX - CODE_WIDTH, baseline, numberStyle, PRINT_COLORS.ink, 'left', mm(17))
    text(context, color.beads, beadsX, baseline, numberStyle, PRINT_COLORS.ink, 'right')
    if (color.grams) text(context, color.grams, gramsX, baseline, numberStyle, PRINT_COLORS.muted, 'right')
    if (color.tubes) text(context, color.tubes, toBuyX, baseline, numberStyle, PRINT_COLORS.ink, 'right')
  })

  let y = rowsTop + words.colors.length * rowHeight
  hair(y, PRINT_COLORS.ink, RULE)
  y += mm(5)
  text(context, labels.total, left, y, font('700', 8.5, SANS), PRINT_COLORS.ink)
  const total = font('700', 7.5, MONO)
  text(context, words.totalBeadsCount, beadsX, y, total, PRINT_COLORS.ink, 'right')
  if (words.totalGrams) text(context, words.totalGrams, gramsX, y, total, PRINT_COLORS.ink, 'right')
  if (words.totalTubes) text(context, words.totalTubes, toBuyX, y, total, PRINT_COLORS.ink, 'right')
  y += mm(3)
  if (words.gramsNote) {
    for (const line of wrap(context, words.gramsNote, font('400', 6.5, SANS), width)) {
      y += pt(9)
      text(context, line, left, y, font('400', 6.5, SANS), PRINT_COLORS.muted)
    }
  }
  return y
}

/** The Schema's facts: label in mono, value beside it. Made by, finished size and weight are left out when unknown. */
function drawFacts(context: CanvasRenderingContext2D, words: PrintText, plan: PrintPlan, left: number, top: number, width: number): void {
  const { labels } = words
  text(context, labels.schemaFacts, left, top, font('700', 8, SANS), PRINT_COLORS.ink)
  const beads = [words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  const facts: [string, string][] = [
    ...(words.maker ? ([[labels.madeBy, headerMaker(words.maker)]] as [string, string][]) : []),
    [labels.technique, words.techniqueWord],
    [labels.bead, words.bead],
    [labels.shape, words.shape],
    [labels.size, words.size],
    ...(words.estimatedSize ? ([[labels.estimatedSize, words.estimatedSize]] as [string, string][]) : []),
    [labels.factBeads, beads],
    [labels.chartStyleFact, words.chartStyle],
    [labels.pagesFact, String(plan.pageCount)],
  ]
  facts.forEach(([label, value], index) => {
    const y = top + mm(6) + index * FACT_STEP
    text(context, label.toLowerCase(), left, y, font('400', 6.5, MONO), PRINT_COLORS.muted, 'left', SPEC_LABEL_ROOM)
    text(context, value, left + LABEL_WIDTH, y, font('500', 8.5, SANS), PRINT_COLORS.ink, 'left', width - LABEL_WIDTH)
  })
}

/** Where each part is: the parts as the grid they sit in, each with its letter and page, and a line on the part size, the
 * shared sheets and the overlap. */
function drawPartMap(context: CanvasRenderingContext2D, words: PrintText, plan: PrintPlan, left: number, top: number, width: number): void {
  const { labels } = words
  text(context, labels.wherePartsAre, left, top, font('700', 8, SANS), PRINT_COLORS.ink)
  const cell = Math.min(MAX_MAP_CELL, width / plan.partsAcross, mm(40) / plan.partsDown)
  const gridTop = top + mm(3)
  plan.parts.forEach((part) => {
    const x = left + part.across * cell
    const y = gridTop + part.down * cell
    context.fillStyle = PRINT_COLORS.paper
    context.strokeStyle = PRINT_COLORS.muted
    context.lineWidth = pt(0.5)
    context.fillRect(x, y, cell - pt(1), cell - pt(1))
    context.strokeRect(x, y, cell - pt(1), cell - pt(1))
    if (cell < mm(5)) return
    text(context, part.letter, x + cell / 2, y + cell * 0.45, font('700', 8, SANS), PRINT_COLORS.ink, 'center')
    text(context, String(part.page), x + cell / 2, y + cell * 0.8, font('400', 6.5, MONO), PRINT_COLORS.muted, 'center')
  })
  if (plan.parts.length < 2) return
  const block = Math.max(...plan.parts.map((part) => Math.max(part.lastAcross - part.firstAcross, part.lastDown - part.firstDown) + 1))
  const note = fillBlanks(labels.partsNote, { beads: block, overlap: PRINT_PART_OVERLAP })
  let y = gridTop + plan.partsDown * cell + mm(2)
  for (const line of wrap(context, note, font('400', 6.5, SANS), width)) {
    y += pt(9)
    text(context, line, left, y, font('400', 6.5, SANS), PRINT_COLORS.muted)
  }
}

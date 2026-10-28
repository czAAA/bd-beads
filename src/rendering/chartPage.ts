import { beadsAreRound, drawChartParts, drawKeySwatch, K, mmPt } from './chartVector'
import { colorsOnPage, KEY_COLUMNS } from './chartPageKey'
import { blankPage, drawMark, font, MONO, partLabel, SANS, SERIF, text } from './printPages'
import { PRINT_COLORS } from './printColors'
import { continuation, displayedGrid, mm, PRINT_MARGIN, type PrintPart, type PrintPlan } from './printPlan'
import { headerMaker, type PrintText } from './printText'
import type { Project } from '../domain/project'
import { fillBlanks } from '../domain/fillBlanks'

// A chart page for the PDF (ticket 0585; PrintChartPage card): the translated text as one picture and everything else as
// PDF drawing laid over it (ADR 0043). The picture is the paper, so empty positions are plain paper.


/** A, B ... Z, AA: the order the key's letters run in. */
function byLetter(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : 1)
}

/** Where the chart goes on from a sheet: the pages to the right of and below its parts, else the next sheet, else
 * "Last part". */
function continuationText(labels: PrintText['labels'], plan: PrintPlan, parts: PrintPart[]): string {
  const here = parts[0]!.page
  const pages = (pick: (next: ReturnType<typeof continuation>) => number | undefined) =>
    parts.map((part) => pick(continuation(plan, part))).filter((page): page is number => page !== undefined && page !== here)
  const right = Math.min(...pages((next) => next.right))
  const below = Math.min(...pages((next) => next.below))
  if (Number.isFinite(right) && Number.isFinite(below)) return fillBlanks(labels.continuesBoth, { right, below })
  if (Number.isFinite(right)) return fillBlanks(labels.continuesRight, { right })
  if (Number.isFinite(below)) return fillBlanks(labels.continuesBelow, { below })
  return here < plan.specificationPage - 1 ? fillBlanks(labels.continuesOn, { next: here + 1 }) : labels.lastPart
}

/** The mini map's rectangles in px from its top left corner: every part of the Schema to scale in a 9.4 mm square, 0.4 mm
 * apart, the parts on this sheet marked.
 * @internal Its test checks the mini map on its own. */
export function miniMapRects(plan: PrintPlan, project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame' | 'beads' | 'rotation'>, page: number): { x: number; y: number; width: number; height: number; here: boolean }[] {
  const grid = displayedGrid(project)
  const side = mm(9.4)
  const gap = mm(0.4)
  const scale = side / Math.max(grid.across, grid.down)
  const left = (side - grid.across * scale) / 2
  const top = (side - grid.down * scale) / 2
  return plan.parts.map((part) => ({
    x: left + part.firstAcross * scale + gap / 2,
    y: top + part.firstDown * scale + gap / 2,
    width: Math.max(mm(0.2), (part.lastAcross - part.firstAcross + 1) * scale - gap),
    height: Math.max(mm(0.2), (part.lastDown - part.firstDown + 1) * scale - gap),
    here: part.page === page,
  }))
}

export interface ChartPage {
  canvas: HTMLCanvasElement
  /** The page's PDF drawing operators, in points. */
  drawing: string
}

/** A chart page: its parts (a sheet shared by small parts has several), header, "Colors on this page" and footer. */
export function drawChartPage(project: Project, words: PrintText, plan: PrintPlan, parts: PrintPart[], scale = 1): ChartPage {
  const { page } = plan
  const { canvas, context } = blankPage(page, scale)
  const { labels } = words
  const letters = project.paletteLetters ?? {}
  const here = parts[0]!
  const { content, pads } = drawChartParts(project, plan, parts, page.height, letters)
  const right = page.width - PRINT_MARGIN

  // Header: the page number, then the mini map to its left, then the technique word and name, and the part line under them.
  const total = text(context, `/ ${plan.pageCount}`, right, mm(18.6), font('400', 8, MONO), PRINT_COLORS.muted, 'right')
  const number = text(context, String(here.page), right - total - mm(0.8), mm(18.6), font('600', 18, SANS), PRINT_COLORS.ink, 'right')
  const mapRight = right - total - mm(0.8) - number - mm(3)
  const mapLeft = mapRight - mm(9.4)
  for (const cell of miniMapRects(plan, project, here.page)) {
    content.roundRect((mapLeft + cell.x) * K, (mm(11.6) + cell.y) * K, cell.width * K, cell.height * K, mmPt(0.3), cell.here ? { fill: PRINT_COLORS.accent } : { stroke: PRINT_COLORS.faint, lineWidth: mmPt(0.15) })
  }
  const room = mapLeft - mm(3) - PRINT_MARGIN
  const word = text(context, words.techniqueWord, PRINT_MARGIN, mm(16.4), font('italic 400', 14, SERIF), PRINT_COLORS.accent)
  text(context, words.name, PRINT_MARGIN + word + mm(1.6), mm(16.4), font('600', 13, SANS), PRINT_COLORS.ink, 'left', Math.max(mm(20), room - word - mm(1.6)))
  const by = words.maker ? fillBlanks(labels.byMaker, { maker: headerMaker(words.maker) }) : ''
  const line = parts.length === 1 ? [partLabel(project, labels, here), by].filter(Boolean).join(' · ') : by
  if (line) text(context, line, PRINT_MARGIN, mm(21.4), font('400', 7.5, MONO), PRINT_COLORS.muted, 'left', room)

  // A sheet shared by several parts labels each above its pad.
  if (parts.length > 1) {
    parts.forEach((part, index) => text(context, partLabel(project, labels, part), pads[index]!.x, pads[index]!.y - mm(2), font('400', 7.5, MONO), PRINT_COLORS.muted))
  }

  // Colors on this page: swatches are drawing, the names are text.
  const bottom = Math.max(...pads.map((pad) => pad.y + pad.height))
  text(context, labels.keyOnPage, PRINT_MARGIN, bottom + mm(6.3), font('600', 7, SANS), PRINT_COLORS.ink)
  const named = new Map(words.colors.map((color) => [color.hex, color.name]))
  const hexes = colorsOnPage(project, parts).sort((a, b) => byLetter(letters[a] ?? '?', letters[b] ?? '?'))
  const capacity = plan.keyRows * KEY_COLUMNS
  const shown = hexes.length > capacity ? hexes.slice(0, capacity - 1) : hexes
  const columnWidth = (page.width - PRINT_MARGIN * 2) / KEY_COLUMNS
  const round = beadsAreRound(project)
  const slot = (index: number) => ({ x: PRINT_MARGIN + (index % KEY_COLUMNS) * columnWidth, y: bottom + mm(8) + Math.floor(index / KEY_COLUMNS) * mm(4.5) })
  shown.forEach((hex, index) => {
    const { x, y } = slot(index)
    drawKeySwatch(content, x, y, hex, letters[hex] ?? '?', round)
    text(context, named.get(hex) ?? hex, x + mm(4.6), y + mm(2.32), font('400', 7, SANS), PRINT_COLORS.ink, 'left', columnWidth - mm(6.1))
  })
  if (hexes.length > shown.length) {
    const { x, y } = slot(shown.length)
    text(context, '…', x, y + mm(2.32), font('400', 7, SANS), PRINT_COLORS.muted)
  }

  // Footer: the mark, the brand and the date, and where the chart goes on.
  drawMark(context, PRINT_MARGIN, mm(282.3), mm(3.6), PRINT_COLORS.ink)
  const brand = text(context, 'openbeads', PRINT_MARGIN + mm(4.8), mm(285.4), font('600', 7.5, SANS), PRINT_COLORS.ink)
  text(context, words.exportedAt, PRINT_MARGIN + mm(4.8) + brand + mm(2), mm(285.4), font('400', 7.5, MONO), PRINT_COLORS.muted)
  text(context, continuationText(labels, plan, parts), right, mm(285.4), font('500', 7.5, SANS), PRINT_COLORS.ink, 'right')
  return { canvas, drawing: content.toString() }
}


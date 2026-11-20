import { drawFlatBead, parseColor, PRINT_THEME, type BeadDrawer, type ProjectTheme } from './beadLook'
import { coverPageLayout, type CoverPageLayout } from './coverPageLayout'
import { drawFooter } from './pageOnePage'
import { blankPage, font, MONO, pt, SANS, SERIF, text, wrap } from './printPages'
import { PRINT_COLORS } from './printColors'
import { mm, PRINT_MARGIN, type PageSize } from './printPlan'
import type { PrintText } from './printText'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { fillBlanks } from '../domain/fillBlanks'
import type { Project } from '../domain/project'

// The Cover page (ticket 1096; PrintCover card): its technique word, title, maker, colors and tech line at the top (ticket
// 1141), then the finished piece in color on the pale board, and the footer. It opens the PDF while the Cover page switch
// is on; the page a maker shows or sells the pattern with, so it holds no chart and no Beads needed.

/** The piece as the app draws it in the light theme (its own-color rim and satin light) on the print board, with nothing
 * behind its beads, so the board shows through the gaps and the piece casts its shadow on it. */
const COVER_THEME: ProjectTheme = { ...PRINT_THEME, canvas: PRINT_THEME.background, background: 'rgba(0, 0, 0, 0)', ownColorRim: true }

/** An empty position is bare board, with no cross: the cover is a picture, not a chart. */
const paintedOnly: BeadDrawer = (context, bead) => {
  if (bead.color !== null) drawFlatBead(context, bead)
}

/** The piece's one soft shadow on the board: 2.6 mm down, 3.7 mm of blur, `ink` at 16%. */
const SHADOW = { down: mm(2.6), blur: mm(3.7), alpha: 0.16 }
/** Between the tech line and the board under it, and between the title block and the tech line's rule. */
const BOARD_GAP = mm(9.5)
const TECH_GAP = mm(5.8)
/** Between the rows of the title block, and between the title and the colors beside it. */
const ROW_GAP = mm(1.6)
const COLUMN_GAP = mm(6)
/** The colors as plain squares, the most used first, rounded as a letter swatch is. */
const SQUARE = mm(5)
const SQUARE_GAP = mm(1.6)
const SQUARE_CORNER = 0.28
const MOST_SQUARES = 12
/** A title runs to two lines at most, then an ellipsis. */
const TITLE_LINES = 2
const ELLIPSIS = '…'
const TITLE_TRACKING = -0.02
/** How far a row's baseline sits above its bottom, as a share of its type size. */
const DESCENT = 0.22
/** The tech line's rule, Page 1's table rule. */
const RULE = pt(0.75)

/** The type sizes, in points: the technique word, the title, "by {maker}", and the Total's words and the tech line. */
const SIZE = { technique: 18, title: 39, maker: 17, meta: 8 }
const TECHNIQUE_FONT = font('italic 400', SIZE.technique, SERIF)
const TITLE_FONT = font('700', SIZE.title, SANS)
const MAKER_FONT = font('italic 400', SIZE.maker, SERIF)
const META_FONT = font('400', SIZE.meta, MONO)
/** The board's corner, the overview's; the colors' hairline edge; the tech line under its rule. */
const BOARD_CORNER = mm(4)
const SQUARE_EDGE = pt(0.5)
const TECH_LINE_GAP = mm(1.6)

function shadowColor(): string {
  const ink = parseColor(PRINT_COLORS.ink)!
  return `rgba(${ink.r}, ${ink.g}, ${ink.b}, ${SHADOW.alpha})`
}

/** The board and the piece on it, drawn at the page's own resolution, then laid in with its shadow. */
function drawPiece(context: CanvasRenderingContext2D, project: Project, layout: CoverPageLayout): void {
  const { board, piece, zoom, start } = layout
  context.fillStyle = PRINT_COLORS.board
  context.beginPath()
  context.roundRect(board.x, board.y, board.width, board.height, BOARD_CORNER)
  context.fill()

  const scale = context.getTransform().a
  const tile = document.createElement('canvas')
  tile.width = Math.max(1, Math.ceil(piece.width * scale))
  tile.height = Math.max(1, Math.ceil(piece.height * scale))
  const tileContext = tile.getContext('2d')
  if (!tileContext) return
  const region = { x: start.x * zoom * scale, y: start.y * zoom * scale, width: tile.width, height: tile.height }
  renderProject(tileContext, { project, space: spaceOf(project, false), region, zoom: zoom * scale, theme: COVER_THEME, rowMarks: false, positionMarks: false, drawBead: paintedOnly })
  // A shadow's offset and blur are in device px, whatever the transform.
  context.save()
  context.shadowColor = shadowColor()
  context.shadowOffsetY = SHADOW.down * scale
  context.shadowBlur = SHADOW.blur * scale
  context.drawImage(tile, piece.x, piece.y, tile.width / scale, tile.height / scale)
  context.restore()
  tile.width = 0
  tile.height = 0
}

/** The title's lines: at most two, the second ending in an ellipsis when the title runs on. */
function titleLines(context: CanvasRenderingContext2D, title: string, width: number): string[] {
  const lines = wrap(context, title, TITLE_FONT, width)
  if (lines.length <= TITLE_LINES) return lines
  let last = lines.slice(TITLE_LINES - 1).join(' ')
  while (last.length > 1 && context.measureText(`${last}${ELLIPSIS}`).width > width) last = last.slice(0, -1).trimEnd()
  return [...lines.slice(0, TITLE_LINES - 1), `${last}${ELLIPSIS}`]
}

/** The title block: the technique word, the title and "by {maker}" on the left, the piece's colors and the Total's words
 * on the right, the two columns sharing a bottom line. Returns that line. */
function drawTitleBlock(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, top: number): number {
  const right = page.width - PRINT_MARGIN
  const squares = words.colors.slice(0, MOST_SQUARES)
  const sums = [words.colorsCount, words.totalBeads, words.totalGrams && `≈ ${words.totalGrams}`].filter(Boolean).join(' · ')
  context.font = META_FONT
  const columnWidth = Math.max(squares.length * SQUARE + Math.max(0, squares.length - 1) * SQUARE_GAP, context.measureText(sums).width)
  const columnLeft = right - columnWidth
  const titleWidth = columnLeft - COLUMN_GAP - PRINT_MARGIN

  // The tracking is the title's alone: −0.02 em, set before its lines are measured.
  context.save()
  context.letterSpacing = `${TITLE_TRACKING * pt(SIZE.title)}px`
  const title = words.name.trim() ? titleLines(context, words.name.trim(), titleWidth) : []
  const rows = [
    { value: words.techniqueWord, style: TECHNIQUE_FONT, size: pt(SIZE.technique), color: PRINT_COLORS.accentStrong },
    ...title.map((value) => ({ value, style: TITLE_FONT, size: pt(SIZE.title), color: PRINT_COLORS.ink })),
    ...(words.maker ? [{ value: fillBlanks(words.labels.byMaker, { maker: words.maker }), style: MAKER_FONT, size: pt(SIZE.maker), color: PRINT_COLORS.muted }] : []),
  ]
  const leftHeight = rows.reduce((sum, row) => sum + row.size, 0) + (rows.length - 1) * ROW_GAP
  const rightHeight = (squares.length > 0 ? SQUARE + ROW_GAP : 0) + pt(SIZE.meta)
  const bottom = top + Math.max(leftHeight, rightHeight)

  let y = bottom - leftHeight
  for (const row of rows) {
    y += row.size
    context.letterSpacing = row.style === TITLE_FONT ? `${TITLE_TRACKING * row.size}px` : '0px'
    text(context, row.value, PRINT_MARGIN, y - row.size * DESCENT, row.style, row.color, 'left', titleWidth)
    y += ROW_GAP
  }
  context.restore()

  const squaresTop = bottom - pt(SIZE.meta) - ROW_GAP - SQUARE
  squares.forEach((color, index) => {
    const x = columnLeft + index * (SQUARE + SQUARE_GAP)
    context.fillStyle = color.hex
    context.beginPath()
    context.roundRect(x, squaresTop, SQUARE, SQUARE, SQUARE * SQUARE_CORNER)
    context.fill()
    context.strokeStyle = PRINT_COLORS.lineStrong
    context.lineWidth = SQUARE_EDGE
    context.stroke()
  })
  text(context, sums, columnLeft, bottom - pt(SIZE.meta) * DESCENT, META_FONT, PRINT_COLORS.muted)
  return bottom
}

/** The Cover page (ticket 1096; PrintCover card), `pageNumber` of `pageCount`, `scale` times the layout's px. */
export function drawCoverPage(project: Project, words: PrintText, page: PageSize, pageNumber: number, pageCount: number, scale = 1): HTMLCanvasElement {
  const { canvas, context } = blankPage(page, scale)
  const bottom = drawTitleBlock(context, page, words, PRINT_MARGIN)

  const ruleY = bottom + TECH_GAP
  context.strokeStyle = PRINT_COLORS.ink
  context.lineWidth = RULE
  context.beginPath()
  context.moveTo(PRINT_MARGIN, ruleY)
  context.lineTo(page.width - PRINT_MARGIN, ruleY)
  context.stroke()
  const techBottom = ruleY + TECH_LINE_GAP + pt(SIZE.meta)
  text(context, words.metaLine, PRINT_MARGIN, techBottom - pt(SIZE.meta) * DESCENT, META_FONT, PRINT_COLORS.muted, 'left', page.width - PRINT_MARGIN * 2)
  drawPiece(context, project, coverPageLayout(project, page, techBottom + BOARD_GAP))

  drawFooter(context, page, words, pageNumber, pageCount)
  return canvas
}

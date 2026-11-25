import { PdfContent } from '../domain/pdfContent'
import { K } from './chartVector'
import { PRINT_COLORS } from './printColors'
import { drawMark, font, MONO, SANS, text } from './printPages'
import { mm, PRINT_MARGIN, type PageSize } from './printPlan'
import type { PrintText } from './printText'
import { qrMatrix } from './qrCode'

// The Cover page's footer (ticket 1233; PrintCover card, "The address"): on the left the X1 mark with "Made with
// openbeads.com", the tag and the date and time; on the right the QR code, its top level with "Made with",
// and the page number beside it on the date's line.

/** The address printed beside the mark and what the QR code says: never translated. */
const COVER_ADDRESS = 'openbeads.com'
/** @internal The Cover page's test reads the code back. */
export const COVER_URL = `https://${COVER_ADDRESS}`

const MARK = mm(5)
const QR = mm(13)
const QR_MODULES = 25
const NUMBER_GAP = mm(4)
const MARK_GAP = mm(2.5)

/** A rectangle on the page in layout px, a link's area. */
export interface PageLink {
  x: number
  y: number
  width: number
  height: number
  uri: string
}

/** Where the footer's parts sit, in layout px: the bottom is the same line Page 1's footer stands on.
 * @internal The Cover page's test holds the board and its caption above `top`. */
export function coverFooterBox(page: PageSize) {
  const bottom = page.height - PRINT_MARGIN
  const numberBaseline = bottom - mm(1)
  const tagBaseline = numberBaseline - mm(4)
  const markTop = tagBaseline - mm(8.1)
  return {
    numberBaseline,
    tagBaseline,
    dateBaseline: numberBaseline,
    markTop,
    brandBaseline: markTop + mm(3.65),
    qr: { x: page.width - PRINT_MARGIN - QR, y: markTop, size: QR },
    /** The footer's highest point: the board and its caption close above it. */
    top: markTop,
  }
}

/** The three corner squares a scanner finds the code by, as `[row, column]` of their top-left module. */
const FINDER = 7
const FINDERS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, QR_MODULES - FINDER],
  [QR_MODULES - FINDER, 0],
]
const inFinder = (row: number, column: number) => FINDERS.some(([r, c]) => row >= r && row < r + FINDER && column >= c && column < c + FINDER)
/** How round a data module is, as a share of its side: soft like a bead, still square enough to scan. */
const DOT_ROUND = 0.32
/** The corner square's outer frame, its paper ring and its inner bead: corner radii in modules. */
const EYE_RADII = [2, 1.2, 1] as const

/** The QR code of the address, made of the app's own shapes (ticket 1233 follow-up): data modules as small rounded beads in
 * ink, the three corner squares as rounded frames around a bead in the accent. Vector in `pdf` (points) when there is one,
 * else drawn on the page's canvas. */
function drawQr(context: CanvasRenderingContext2D, box: { x: number; y: number; size: number }, pdf?: PdfContent): void {
  const matrix = qrMatrix(COVER_URL)
  const module = box.size / matrix.length
  const shape = (x: number, y: number, size: number, radius: number, color: string) => {
    const left = box.x + x * module
    const top = box.y + y * module
    if (pdf) pdf.roundRect(left * K, top * K, size * module * K, size * module * K, radius * module * K, { fill: color })
    else {
      context.fillStyle = color
      context.beginPath()
      context.roundRect(left, top, size * module, size * module, radius * module)
      context.fill()
    }
  }
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark && !inFinder(r, c)) shape(c, r, 1, DOT_ROUND, PRINT_COLORS.ink)
    }),
  )
  for (const [r, c] of FINDERS) {
    shape(c, r, FINDER, EYE_RADII[0], PRINT_COLORS.accentStrong)
    shape(c + 1, r + 1, FINDER - 2, EYE_RADII[1], PRINT_COLORS.paper)
    shape(c + 2, r + 2, FINDER - 4, EYE_RADII[2], PRINT_COLORS.accentStrong)
  }
}

/** The footer, always in color (the Cover page is). With a `pdf` the QR code is drawing in points over the picture; the
 * links to lay over the address and the code come back in layout px. */
export function drawCoverFooter(context: CanvasRenderingContext2D, page: PageSize, words: PrintText, pageNumber: number, pageCount: number, pdf?: PdfContent): PageLink[] {
  const { labels } = words
  const box = coverFooterBox(page)
  const x = PRINT_MARGIN
  drawMark(context, x, box.markTop, MARK, PRINT_COLORS.accent)
  const textX = x + MARK + MARK_GAP
  const made = text(context, `${labels.madeWith} `, textX, box.brandBaseline, font('400', 9, SANS), PRINT_COLORS.muted)
  const address = text(context, COVER_ADDRESS, textX + made, box.brandBaseline, font('600', 9, SANS), PRINT_COLORS.ink)
  text(context, labels.coverTag, x, box.tagBaseline, font('400', 7.5, SANS), PRINT_COLORS.muted)
  text(context, words.exportedAt, x, box.dateBaseline, font('400', 7, MONO), PRINT_COLORS.muted)

  drawQr(context, box.qr, pdf)
  text(context, `${pageNumber} / ${pageCount}`, box.qr.x - NUMBER_GAP, box.numberBaseline, font('400', 7, MONO), PRINT_COLORS.muted, 'right')

  return [
    { x: textX + made, y: box.brandBaseline - mm(3), width: address, height: mm(4), uri: COVER_URL },
    { x: box.qr.x, y: box.qr.y, width: box.qr.size, height: box.qr.size, uri: COVER_URL },
  ]
}

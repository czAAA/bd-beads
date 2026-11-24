import { PdfContent } from '../domain/pdfContent'
import { K } from './chartVector'
import { PRINT_COLORS } from './printColors'
import { drawMark, font, MONO, SANS, text } from './printPages'
import { mm, PRINT_MARGIN, type PageSize } from './printPlan'
import type { PrintText } from './printText'
import { qrMatrix } from './qrCode'

// The Cover page's footer (ticket 1233; PrintCover card, "The address"): on the left the X1 mark with "Made with
// openbeads.com", the tag and the date and time; on the right the QR code with "scan to open" beside it and the page number
// under it. Only the Cover page carries it: Page 1, the chart pages and the list pages keep Page 1's footer.

/** The address printed beside the mark and what the QR code says: never translated. */
const COVER_ADDRESS = 'openbeads.com'
/** @internal The Cover page's test reads the code back. */
export const COVER_URL = `https://${COVER_ADDRESS}`

const MARK = mm(5)
const QR = mm(13)
/** The quiet zone round the code is four modules; the page number keeps clear of it. */
const QUIET_MODULES = 4
const QR_MODULES = 25
const QR_NUMBER_GAP = (QR / QR_MODULES) * QUIET_MODULES
const QR_LABEL_GAP = mm(2)
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
  const qrBottom = numberBaseline - mm(2.5) - QR_NUMBER_GAP
  const tagBaseline = numberBaseline - mm(4)
  const markTop = tagBaseline - mm(8.1)
  return {
    numberBaseline,
    tagBaseline,
    dateBaseline: numberBaseline,
    markTop,
    brandBaseline: markTop + mm(3.65),
    qr: { x: page.width - PRINT_MARGIN - QR, y: qrBottom - QR, size: QR },
    /** The footer's highest point with the QR code's quiet zone: the board and its caption close above it. */
    top: Math.min(markTop, qrBottom - QR - (QR / QR_MODULES) * QUIET_MODULES),
  }
}

/** The dark modules as runs along a row, `[row, firstColumn, length]`: fewer rectangles, and no hairline between neighbours. */
function runs(matrix: readonly (readonly boolean[])[]): [number, number, number][] {
  const found: [number, number, number][] = []
  matrix.forEach((row, r) => {
    let from = -1
    for (let c = 0; c <= row.length; c += 1) {
      if (row[c]) {
        if (from < 0) from = c
      } else if (from >= 0) {
        found.push([r, from, c - from])
        from = -1
      }
    }
  })
  return found
}

/** The QR code of the address: vector squares in `pdf` (points) when there is one, else filled on the page's own pixels,
 * each edge snapped to a device pixel so no seam shows. */
function drawQr(context: CanvasRenderingContext2D, box: { x: number; y: number; size: number }, pdf?: PdfContent): void {
  const matrix = qrMatrix(COVER_URL)
  const module = box.size / matrix.length
  if (pdf) {
    for (const [r, c, length] of runs(matrix)) pdf.fillRect((box.x + c * module) * K, (box.y + r * module) * K, length * module * K, module * K, PRINT_COLORS.ink)
    return
  }
  const scale = context.getTransform().a
  const snap = (value: number) => Math.round(value * scale) / scale
  context.fillStyle = PRINT_COLORS.ink
  for (const [r, c, length] of runs(matrix)) {
    const left = snap(box.x + c * module)
    const top = snap(box.y + r * module)
    context.fillRect(left, top, snap(box.x + (c + length) * module) - left, snap(box.y + (r + 1) * module) - top)
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

  const right = page.width - PRINT_MARGIN
  drawQr(context, box.qr, pdf)
  text(context, labels.scanToOpen, box.qr.x - QR_LABEL_GAP, box.qr.y + box.qr.size / 2 + mm(1), font('400', 6.5, MONO), PRINT_COLORS.muted, 'right')
  text(context, `${pageNumber} / ${pageCount}`, right, box.numberBaseline, font('400', 7, MONO), PRINT_COLORS.muted, 'right')

  return [
    { x: textX + made, y: box.brandBaseline - mm(3), width: address, height: mm(4), uri: COVER_URL },
    { x: box.qr.x, y: box.qr.y, width: box.qr.size, height: box.qr.size, uri: COVER_URL },
  ]
}

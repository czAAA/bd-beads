import { computeColorQuantities, type ColorQuantity } from '../domain/beadQuantities'
import { CELL_SIZE_PX } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { buildPdf, type PdfPage } from '../domain/pdfDocument'
import { encodePng } from '../domain/pngEncoder'
import { DEFAULT_THEME, type DrawingContext } from './beadLook'
import { displayedExtentPx, renderPattern, rowPitchPx, type Region } from './patternRenderer'

/**
 * Pattern exports (tickets 73, 74): the Pattern drawn by the same renderer the editor uses, so an exported bead looks
 * like the on-screen one, but onto canvases made here instead of the Drawing surface.
 *
 * Nothing here assumes the Pattern fits one canvas. A picture is drawn a band of rows at a time and streamed into the
 * PNG encoder; a printed chart is cut into page-sized pieces, each drawn on its own. So the work, and the memory it
 * needs at any moment, is bounded by the band or the page, not the Pattern (ADR 0018's 250 × 250 included).
 */

/** A finished row's fade is a weaving aid; a chart shows every bead at full color, so Row progress is switched off for the drawing. */
function forExport(pattern: Pattern): Pattern {
  return { ...pattern, rowProgress: { ...pattern.rowProgress, enabled: false } }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('No 2D canvas is available to draw the export on.')
  }
  return context
}

// ---- PNG -----------------------------------------------------------------------------------------------------------

/** A bead is this many px across in a PNG, unless the Pattern is too large for that (see pngZoom). */
export const PNG_BEAD_PX = 30
/** The most pixels a PNG is drawn with: what a phone can be asked to hold while it is compressed, and about what a 70 × 250 Pattern needs at 30 px a bead. */
export const PNG_MAX_PIXELS = 16_000_000
/** A blank border around the chart, in image px. */
export const PNG_MARGIN_PX = 24
/** How many pixels one band of the picture holds while it is drawn and compressed. */
const STRIP_PIXELS = 1_000_000

/** How far to enlarge the Pattern for a PNG: to a legible bead size, and no further than the pixel budget allows. */
export function pngZoom(pattern: Pick<Pattern, 'technique' | 'columns' | 'rows' | 'rotated'>): number {
  const wanted = PNG_BEAD_PX / CELL_SIZE_PX
  const { width, height } = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, 1, pattern.rotated)
  if (width === 0 || height === 0) {
    return wanted
  }
  // The largest zoom whose picture, border and the pixel each side rounds up by included, still fits: (w·z + b)(h·z + b) = budget.
  const border = PNG_MARGIN_PX * 2 + 2
  const a = width * height
  const b = border * (width + height)
  const c = border * border - PNG_MAX_PIXELS
  const budget = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return Math.min(wanted, budget)
}

/** The Pattern as a PNG picture, as it looks on screen (turned if it is turned) on white. */
export async function exportPatternPng(source: Pattern): Promise<Blob> {
  const pattern = forExport(source)
  const zoom = pngZoom(pattern)
  const displayed = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, zoom, pattern.rotated)
  const width = Math.ceil(displayed.width) + PNG_MARGIN_PX * 2
  const height = Math.ceil(displayed.height) + PNG_MARGIN_PX * 2
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / width))

  const canvas = createCanvas(width, Math.min(stripRows, height))
  const context = contextOf(canvas)

  return encodePng(width, height, stripRows, (y, rows) => {
    // The last band can be shorter: a canvas keeps its size, so read only the rows this band has.
    renderPattern(context, {
      pattern,
      region: { x: -PNG_MARGIN_PX, y: y - PNG_MARGIN_PX, width, height: canvas.height },
      zoom,
    })
    return context.getImageData(0, 0, width, rows).data
  })
}

// ---- PDF -----------------------------------------------------------------------------------------------------------

/** The sheets are A4, drawn at 150 dpi: sharp enough that a bead's edge prints clean, small enough that a page is a few hundred kB of JPEG. */
const PDF_DPI = 150
const PAGE_WIDTH_PX = 1240
const PAGE_HEIGHT_PX = 1754
const PAGE_MARGIN_PX = 75
const HEADER_PX = 70
/** A bead is 27 px, 4.6 mm, across on paper. */
export const PDF_ZOOM = 1.35
const LEGEND_ROW_PX = 48
const JPEG_QUALITY = 0.92
const INK = '#1d3658'

export interface PdfLabels {
  /** The legend's column headings and title. */
  legendHeading: string
  colorHeading: string
  countHeading: string
  /** "Total": the beads the whole Pattern needs. */
  totalLabel: string
  /** Shown when nothing is painted yet. */
  noColorsMessage: string
  /** "Page {page} of {pages}" and "Part {across} of {acrossTotal} across, {down} of {downTotal} down". */
  pageLabel: string
  partLabel: string
}

export interface ChartPiece {
  /** Where the piece starts in the displayed chart, in displayed px, and how big it is. */
  region: Region
  /** Which piece it is, counting from 1, in the grid of pieces the chart is cut into. */
  across: number
  down: number
}

export interface ChartPlan {
  pieces: ChartPiece[]
  acrossTotal: number
  downTotal: number
}

/**
 * How the displayed chart is cut into pieces that each fit `pageWidth` × `pageHeight` px. Cuts fall between beads
 * wherever they can, so a bead is on one page whole, and pieces are ordered across then down, the way a page of text is read.
 */
export function planChart(
  pattern: Pick<Pattern, 'technique' | 'columns' | 'rows' | 'rotated'>,
  zoom: number,
  pageWidth: number,
  pageHeight: number,
): ChartPlan {
  const { width, height } = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, zoom, pattern.rotated)
  const columnStep = CELL_SIZE_PX * zoom
  const rowStep = rowPitchPx(pattern.technique) * zoom
  // A turned Pattern's rows run across the page.
  const stepAcross = pattern.rotated ? rowStep : columnStep
  const stepDown = pattern.rotated ? columnStep : rowStep

  const pieceWidth = Math.max(stepAcross, Math.floor(pageWidth / stepAcross) * stepAcross)
  const pieceHeight = Math.max(stepDown, Math.floor(pageHeight / stepDown) * stepDown)
  const acrossTotal = Math.max(1, Math.ceil(width / pieceWidth - 1e-9))
  const downTotal = Math.max(1, Math.ceil(height / pieceHeight - 1e-9))

  const pieces: ChartPiece[] = []
  for (let down = 0; down < downTotal; down += 1) {
    for (let across = 0; across < acrossTotal; across += 1) {
      const x = across * pieceWidth
      const y = down * pieceHeight
      pieces.push({
        region: { x, y, width: Math.ceil(Math.min(pieceWidth, width - x)), height: Math.ceil(Math.min(pieceHeight, height - y)) },
        across: across + 1,
        down: down + 1,
      })
    }
  }
  return { pieces, acrossTotal, downTotal }
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole))
}

function jpegOf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject) : reject(new Error('The page could not be turned into a picture.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

function blankPage(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = createCanvas(PAGE_WIDTH_PX, PAGE_HEIGHT_PX)
  const context = contextOf(canvas)
  context.fillStyle = DEFAULT_THEME.background
  context.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX)
  context.fillStyle = INK
  context.textBaseline = 'middle'
  return { canvas, context }
}

function drawHeader(context: CanvasRenderingContext2D, title: string, pageNote: string): void {
  context.font = 'bold 34px sans-serif'
  context.textAlign = 'left'
  context.fillText(title, PAGE_MARGIN_PX, PAGE_MARGIN_PX + HEADER_PX / 2 - 10, PAGE_WIDTH_PX - PAGE_MARGIN_PX * 2 - 300)
  context.font = '26px sans-serif'
  context.textAlign = 'right'
  context.fillText(pageNote, PAGE_WIDTH_PX - PAGE_MARGIN_PX, PAGE_MARGIN_PX + HEADER_PX / 2 - 10)
  context.textAlign = 'left'
}

/** The legend pages: every color the Pattern uses, the beads of each, and the total. Split over as many pages as the colors need. */
function legendPages(quantities: ColorQuantity[], labels: PdfLabels): HTMLCanvasElement[] {
  const top = PAGE_MARGIN_PX + HEADER_PX + LEGEND_ROW_PX
  const perPage = Math.floor((PAGE_HEIGHT_PX - PAGE_MARGIN_PX - top) / LEGEND_ROW_PX) - 2
  const total = quantities.reduce((sum, quantity) => sum + quantity.count, 0)
  const chunks: ColorQuantity[][] = []
  for (let start = 0; start < quantities.length; start += perPage) {
    chunks.push(quantities.slice(start, start + perPage))
  }

  return (chunks.length > 0 ? chunks : [[]]).map((chunk, index, all) => {
    const { canvas, context } = blankPage()
    context.font = 'bold 30px sans-serif'
    context.fillText(labels.legendHeading, PAGE_MARGIN_PX, top - LEGEND_ROW_PX / 2)

    if (quantities.length === 0) {
      context.font = '28px sans-serif'
      context.fillText(labels.noColorsMessage, PAGE_MARGIN_PX, top + LEGEND_ROW_PX / 2)
      return canvas
    }

    const countX = 640
    context.font = 'bold 26px sans-serif'
    context.fillText(labels.colorHeading, PAGE_MARGIN_PX, top + LEGEND_ROW_PX / 2)
    context.fillText(labels.countHeading, countX, top + LEGEND_ROW_PX / 2)
    context.fillRect(PAGE_MARGIN_PX, top + LEGEND_ROW_PX - 2, countX + 200 - PAGE_MARGIN_PX, 2)

    context.font = '26px sans-serif'
    chunk.forEach((quantity, row) => {
      const y = top + LEGEND_ROW_PX * (row + 1)
      context.fillStyle = quantity.hex
      context.fillRect(PAGE_MARGIN_PX, y + 6, 72, LEGEND_ROW_PX - 12)
      context.fillStyle = INK
      context.strokeStyle = INK
      context.lineWidth = 2
      context.strokeRect(PAGE_MARGIN_PX, y + 6, 72, LEGEND_ROW_PX - 12)
      context.fillText(quantity.hex.toUpperCase(), PAGE_MARGIN_PX + 96, y + LEGEND_ROW_PX / 2)
      context.fillText(String(quantity.count), countX, y + LEGEND_ROW_PX / 2)
    })

    if (index === all.length - 1) {
      const y = top + LEGEND_ROW_PX * (chunk.length + 1)
      context.font = 'bold 26px sans-serif'
      context.fillRect(PAGE_MARGIN_PX, y + 4, countX + 200 - PAGE_MARGIN_PX, 2)
      context.fillText(labels.totalLabel, PAGE_MARGIN_PX, y + LEGEND_ROW_PX / 2 + 6)
      context.fillText(String(total), countX, y + LEGEND_ROW_PX / 2 + 6)
    }
    return canvas
  })
}

/**
 * The Pattern as a PDF for printing on A4: the legend (each color and how many beads of it, the total) first, then the
 * chart, cut into as many pages as it needs at a bead size that reads at the craft table.
 */
export async function exportPatternPdf(source: Pattern, labels: PdfLabels): Promise<Blob> {
  const pattern = forExport(source)
  const quantities = computeColorQuantities(pattern)
  const chartWidth = PAGE_WIDTH_PX - PAGE_MARGIN_PX * 2
  const chartHeight = PAGE_HEIGHT_PX - PAGE_MARGIN_PX * 2 - HEADER_PX
  const plan = planChart(pattern, PDF_ZOOM, chartWidth, chartHeight)

  const legend = legendPages(quantities, labels)
  const pageCount = legend.length + plan.pieces.length
  const pages: PdfPage[] = []

  for (const [index, canvas] of legend.entries()) {
    drawHeader(contextOf(canvas), `${pattern.name} · ${pattern.columns}×${pattern.rows}`, fill(labels.pageLabel, { page: index + 1, pages: pageCount }))
    pages.push({ jpeg: await jpegOf(canvas), pixelWidth: PAGE_WIDTH_PX, pixelHeight: PAGE_HEIGHT_PX })
  }

  for (const [index, piece] of plan.pieces.entries()) {
    const { canvas: page, context } = blankPage()
    const note = fill(labels.pageLabel, { page: legend.length + index + 1, pages: pageCount })
    drawHeader(context, `${pattern.name} · ${pattern.columns}×${pattern.rows}`, note)
    if (plan.pieces.length > 1) {
      context.font = '22px sans-serif'
      context.fillText(
        fill(labels.partLabel, { across: piece.across, acrossTotal: plan.acrossTotal, down: piece.down, downTotal: plan.downTotal }),
        PAGE_MARGIN_PX,
        PAGE_MARGIN_PX + HEADER_PX - 8,
      )
    }

    const tile = createCanvas(piece.region.width, piece.region.height)
    renderPattern(contextOf(tile) as DrawingContext, { pattern, region: piece.region, zoom: PDF_ZOOM })
    context.drawImage(tile, PAGE_MARGIN_PX, PAGE_MARGIN_PX + HEADER_PX)
    pages.push({ jpeg: await jpegOf(page), pixelWidth: PAGE_WIDTH_PX, pixelHeight: PAGE_HEIGHT_PX })
  }

  return buildPdf(pages, (PAGE_WIDTH_PX * 72) / PDF_DPI, (PAGE_HEIGHT_PX * 72) / PDF_DPI)
}

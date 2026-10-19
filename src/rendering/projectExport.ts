import { frameWeave, projectDimensions } from '../domain/project'
import type { Project } from '../domain/project'
import { buildPdf, type PdfPage } from '../domain/pdfDocument'
import { encodePng } from '../domain/pngEncoder'
import { PRINT_THEME } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { displayedGrid, planPrint, PRINT_BOARD_PAD, PRINT_DPI, type PrintPart } from './printPlan'
import type { PrintText } from './printText'
import { CELL_SIZE_PX, displayedExtentPx } from './surfaceView'

// Project exports (tickets 73, 74): drawn by the editor's renderer onto canvases made here; a picture is streamed band
// by band and a printed chart cut into pages, so memory is bounded by the band or page, not the Project (ADR 0018, 250
// × 250).

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

/** A bead is this many px across in a PNG, unless the Project is too large for that (see pngZoom). */
export const PNG_BEAD_PX = 30
// The most pixels a PNG is drawn with: what a phone can be asked to hold while it is compressed, and about what a 70 ×
// 250 Project needs at 30 px a bead.
export const PNG_MAX_PIXELS = 16_000_000
// Around the chart's top, left and right, in image px: room for its rulers (the PngExport card) as well as a blank
// border.
export const PNG_MARGIN_PX = 40

// Taller bottom margin (ticket 183): the large background name tucked behind the board's lower edge needs room to clear
// it.
export const PNG_BOTTOM_MARGIN_PX = 100

// The bead board's rect in the chart canvas (ticket 183): margins plus PRINT_BOARD_PAD, as the PDF page-1 board
// (printPages.ts). The background name and accent line tuck behind this rect, not the full chart rect, or the margin
// crops them.
export function pngBoardRect(chart: { width: number; height: number }): { x: number; top: number; right: number; bottom: number } {
  return {
    x: PNG_MARGIN_PX,
    top: PNG_MARGIN_PX - PRINT_BOARD_PAD,
    right: chart.width - PNG_MARGIN_PX + PRINT_BOARD_PAD,
    bottom: chart.height - PNG_BOTTOM_MARGIN_PX + PRINT_BOARD_PAD,
  }
}

/** How many pixels one band of the picture holds while it is drawn and compressed. */
const STRIP_PIXELS = 1_000_000
// Set aside for the story column (ticket 164) before solving for the chart's own zoom, so the whole picture — chart and
// story together — still keeps to PNG_MAX_PIXELS. Generous: the story is a few hundred px across or tall, never
// anywhere near this.
const PNG_STORY_RESERVE_PIXELS = 2_500_000

// How far to enlarge the Project for a PNG: to a legible bead size, and no further than the pixel budget (less the
// story's own room) allows.
export function pngZoom(project: Pick<Project, 'technique' | 'frame' | 'beads' | 'rotation'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>): number {
  const wanted = PNG_BEAD_PX / CELL_SIZE_PX
  const { width, height } = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, project.rotation, frameWeave(project).cell)
  if (width === 0 || height === 0) {
    return wanted
  }
  // The largest zoom whose picture, borders and the pixel each side rounds up by included, still fits: (w·z + bx)(h·z +
  // by) = budget. The bottom margin is taller than the other three (PNG_BOTTOM_MARGIN_PX, ticket 183), so the two
  // borders differ.
  const borderX = PNG_MARGIN_PX * 2 + 2
  const borderY = PNG_MARGIN_PX + PNG_BOTTOM_MARGIN_PX + 2
  const budget = PNG_MAX_PIXELS - PNG_STORY_RESERVE_PIXELS
  const a = width * height
  const b = width * borderY + height * borderX
  const c = borderX * borderY - budget
  return Math.min(wanted, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
}

// The Project as a PNG (ticket 164; printed-output.md): chart with rulers plus the PDF's story column, drawn band by
// band to stay within the pixel budget (see pngZoom); redrawing the small story on every band is cheap.
export async function exportProjectPng(project: Project, words: PrintText): Promise<Blob> {
  const zoom = pngZoom(project)
  const displayed = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, zoom, project.rotation, frameWeave(project).cell)
  const beadsWidth = Math.ceil(displayed.width)
  const beadsHeight = Math.ceil(displayed.height)
  // The bottom margin is taller than the other three (PNG_BOTTOM_MARGIN_PX, ticket 183): room for the background name.
  const chart = { width: beadsWidth + PNG_MARGIN_PX * 2, height: beadsHeight + PNG_MARGIN_PX + PNG_BOTTOM_MARGIN_PX }
  // Loaded when a PNG is asked for: the story's words and the mark it reads from the design system aren't needed
  // before.
  const { clipToPngBoard, drawPngBackground, drawPngStory, pngLayout } = await import('./pngPage')
  const { drawRulers, loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()
  const layout = pngLayout(chart, words)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / layout.width))

  const canvas = createCanvas(layout.width, Math.min(stripRows, layout.height))
  const context = contextOf(canvas)
  const board = pngBoardRect(chart)
  // The beads' own box, inside the margin the rulers sit in — its own extent, not derived from the (asymmetric) chart
  // margins.
  const beads = { x: PNG_MARGIN_PX, y: PNG_MARGIN_PX, width: beadsWidth, height: beadsHeight }
  const grid = displayedGrid(project)

  return encodePng(layout.width, layout.height, stripRows, (y, rows) => {
    // The last band can be shorter: a canvas keeps its size, so read only the rows this band has.
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    // The margin-inclusive card's own rounded corners (not the board fetched above, which is the tighter bead rect).
    clipToPngBoard(context, 0, 0, chart.width, chart.height, y)
    renderProject(context, {
      project,
      space: spaceOf(project, false),
      region: { x: -PNG_MARGIN_PX, y: y - PNG_MARGIN_PX, width: chart.width, height: canvas.height },
      zoom,
      theme: PRINT_THEME,
      // A finished row's fade is a weaving aid; a chart shows every bead at full color (ticket 434).
      rowMarks: false,
    })
    context.restore()
    // After the board, not before (ticket 183 regression): renderProject repaints its own whole region — taller than
    // the chart alone whenever the picture carries extra height below it (a wide Project's story, say) — so drawing
    // the background name any earlier left it painted over and invisible in exactly those pictures.
    drawPngBackground(context, layout, words.background, board, y)
    // Rulers every 10 beads, and the 10-bead lines (printed-output.md, PNG image): drawn outside the board, offset for
    // this band.
    drawRulers(context, project, zoom, { x: beads.x, y: beads.y - y, width: beads.width, height: beads.height }, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 }, 10)
    drawPngStory(context, words, layout, y)
    return context.getImageData(0, 0, layout.width, rows).data
  })
}

// ---- PDF -----------------------------------------------------------------------------------------------------------

const JPEG_QUALITY = 0.92

function jpegOf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject) : reject(new Error('The page could not be turned into a picture.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

// The Project as a PDF (ticket 162): page 1 summary, then equal chart pages (planPrint), drawn one at a time so memory
// stays bounded (ADR 0019).
export async function exportProjectPdf(project: Project, words: PrintText): Promise<Blob> {
  const plan = planPrint(project)
  // Loaded when a PDF is asked for: the page drawing (and the mark it reads from the design system) isn't needed
  // before.
  const { drawChartPage, drawPageOne, loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()

  const pages: PdfPage[] = []
  const add = async (canvas: HTMLCanvasElement) => {
    pages.push({ jpeg: await jpegOf(canvas), pixelWidth: plan.page.width, pixelHeight: plan.page.height })
    // Let the canvas go before the next page is drawn.
    canvas.width = 0
    canvas.height = 0
  }

  await add(drawPageOne(project, words, plan))
  // Usually one part per page; PrintStrips can put several small parts on the same sheet, so pages come from grouping
  // them.
  const sheets = new Map<number, PrintPart[]>()
  for (const part of plan.parts) sheets.set(part.page, [...(sheets.get(part.page) ?? []), part])
  for (const parts of sheets.values()) {
    await add(drawChartPage(project, words, plan, parts))
  }

  return buildPdf(pages, (plan.page.width * 72) / PRINT_DPI, (plan.page.height * 72) / PRINT_DPI)
}

import { frameWeave, projectDimensions, shownLetters } from '../domain/project'
import type { Project } from '../domain/project'
import { buildPdf, type PdfPage } from '../domain/pdfDocument'
import { PNG_BEAD_PX_BY_QUALITY } from '../domain/exportQuality'
import { deflateRgb, encodePng } from '../domain/pngEncoder'
import { PRINT_THEME } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { displayedGrid, planPrint, PRINT_DPI, type PrintPart } from './printPlan'
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

/** A bead is this many px across in a PNG at Medium, the Export quality it starts at (ticket 571; see pngZoom). */
export const PNG_BEAD_PX = PNG_BEAD_PX_BY_QUALITY.medium
// The most raw pixels a PNG is drawn with, on every device (ticket 571, ADR 0043): it bounds pixels, not the compressed
// bytes, which are held whole. Past it a level is drawn smaller.
export const PNG_MAX_PIXELS = 400_000_000
// The widest a picture is drawn: the strip canvas is as wide as the picture and some browsers stop at 16 384 px.
export const PNG_MAX_WIDTH = 16_384
// Around the chart's top, left and right, in image px: room for its rulers (the PngExport card) as well as a blank
// border.
export const PNG_MARGIN_PX = 40

/** How many pixels one band of the picture holds while it is drawn and compressed. */
const STRIP_PIXELS = 1_000_000
// Set aside for the story column (ticket 164) before solving for the chart's own zoom, so the whole picture — chart and
// story together — still keeps to PNG_MAX_PIXELS. Generous: the story is a few hundred px across or tall, never
// anywhere near this.
const PNG_STORY_RESERVE_PIXELS = 2_500_000
// Width the story column may take beside a tall chart (pngPage.ts), kept out of PNG_MAX_WIDTH.
const PNG_STORY_RESERVE_WIDTH = 600

// How far to enlarge the Project for a PNG: to a legible bead size, and no further than the pixel budget (less the
// story's own room) allows.
export function pngZoom(project: Pick<Project, 'technique' | 'frame' | 'beads' | 'rotation'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>, beadPx = PNG_BEAD_PX): number {
  const wanted = beadPx / CELL_SIZE_PX
  const { width, height } = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, project.rotation, frameWeave(project).cell)
  if (width === 0 || height === 0) {
    return wanted
  }
  // The largest zoom whose picture, borders and the pixel each side rounds up by included, still fits: (w·z + b)(h·z +
  // b) = budget, the border b being the same on both axes.
  const borderX = PNG_MARGIN_PX * 2 + 2
  const budget = PNG_MAX_PIXELS - PNG_STORY_RESERVE_PIXELS
  const a = width * height
  const b = (width + height) * borderX
  const c = borderX * borderX - budget
  const widest = (PNG_MAX_WIDTH - PNG_STORY_RESERVE_WIDTH - borderX) / width
  const largest = Math.min(wanted, widest, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
  // A reduced bead is a whole number of px across: between pixels its edges blur and the file grows several times over.
  return largest < wanted ? Math.floor(largest * CELL_SIZE_PX) / CELL_SIZE_PX : largest
}

// The Project as a PNG (ticket 164; printed-output.md): chart with rulers plus the PDF's story column, drawn band by
// band to stay within the pixel budget (see pngZoom); redrawing the small story on every band is cheap.
export async function exportProjectPng(project: Project, words: PrintText, beadPx = PNG_BEAD_PX): Promise<Blob> {
  const zoom = pngZoom(project, beadPx)
  const displayed = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, zoom, project.rotation, frameWeave(project).cell)
  const beadsWidth = Math.ceil(displayed.width)
  const beadsHeight = Math.ceil(displayed.height)
  const chart = { width: beadsWidth + PNG_MARGIN_PX * 2, height: beadsHeight + PNG_MARGIN_PX * 2 }
  // Loaded when a PNG is asked for: the story's words and the mark it reads from the design system aren't needed
  // before.
  const { clipToPngBoard, drawPngStory, pngLayout } = await import('./pngPage')
  const { drawRulers, loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()
  const layout = pngLayout(chart, words)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / layout.width))

  const canvas = createCanvas(layout.width, Math.min(stripRows, layout.height))
  const context = contextOf(canvas)
  // The beads' own box, inside the margin the rulers sit in — its own extent, not derived from the chart
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
      letters: shownLetters(project),
    })
    context.restore()
    // Rulers every 10 beads, and the 10-bead lines (printed-output.md, PNG image): drawn outside the board, offset for
    // this band.
    drawRulers(context, project, zoom, { x: beads.x, y: beads.y - y, width: beads.width, height: beads.height }, { first: 0, last: grid.across - 1 }, { first: 0, last: grid.down - 1 })
    drawPngStory(context, words, layout, y)
    return context.getImageData(0, 0, layout.width, rows).data
  })
}

/** The Word chart as a PNG (ticket 0574): one tall picture of the written rows, at the same Export quality as the
 * pattern's (the text is drawn larger as a bead is). Drawn band by band like the pattern. */
export async function exportWordChartPng(words: PrintText, beadPx = PNG_BEAD_PX): Promise<Blob> {
  const { wordChartPicture } = await import('./wordChartPages')
  const { loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()
  const scale = beadPx / PNG_BEAD_PX
  const picture = wordChartPicture(words)
  const width = Math.ceil(picture.width * scale)
  const height = Math.ceil(picture.height * scale)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / width))
  const canvas = createCanvas(width, Math.min(stripRows, height))
  const context = contextOf(canvas)
  return encodePng(width, height, stripRows, (y, rows) => {
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(scale, scale)
    picture.draw(context, y / scale, canvas.height / scale)
    return context.getImageData(0, 0, width, rows).data
  })
}

// ---- PDF -----------------------------------------------------------------------------------------------------------

/** The page as lossless compressed scanlines: measured at half the size of a JPEG of it (ticket 572, ADR 0043). */
function flateOf(canvas: HTMLCanvasElement): Promise<Uint8Array[]> {
  const context = contextOf(canvas)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / canvas.width))
  return deflateRgb(canvas.width, canvas.height, stripRows, (y, rows) => context.getImageData(0, y, canvas.width, rows).data)
}

// The Project as a PDF (ticket 162): page 1 summary, then equal chart pages (planPrint), drawn one at a time so memory
// stays bounded (ADR 0019). The pages are drawn at `dpi`; the sheet is the same size in points whatever it is.
export async function exportProjectPdf(project: Project, words: PrintText, dpi = PRINT_DPI): Promise<Blob> {
  const plan = planPrint(project)
  const scale = dpi / PRINT_DPI
  // Loaded when a PDF is asked for: the page drawing (and the mark it reads from the design system) isn't needed
  // before.
  const { blankPage, drawChartPage, drawPageOne, loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()
  // The Specification (ticket 0581) follows the chart pages and the Word chart (ticket 0574) follows it; both count in
  // every page's "of N".
  const { drawSpecificationPage } = await import('./printSpecification')
  const { drawWordChartPages, wordChartPageCount } = await import('./wordChartPages')
  const wordPages = wordChartPageCount(words, plan.page)
  const counted = wordPages > 0 ? { ...plan, pageCount: plan.specificationPage + wordPages } : plan

  const pages: PdfPage[] = []
  const add = async (canvas: HTMLCanvasElement) => {
    const size = { pixelWidth: canvas.width, pixelHeight: canvas.height }
    pages.push({ ...size, flate: await flateOf(canvas) })
    // Let the canvas go before the next page is drawn.
    canvas.width = 0
    canvas.height = 0
  }

  await add(drawPageOne(project, words, counted, scale))
  // Usually one part per page; PrintStrips can put several small parts on the same sheet, so pages come from grouping
  // them.
  const sheets = new Map<number, PrintPart[]>()
  for (const part of plan.parts) sheets.set(part.page, [...(sheets.get(part.page) ?? []), part])
  for (const parts of sheets.values()) {
    await add(drawChartPage(project, words, counted, parts, scale))
  }
  await add(drawSpecificationPage(project, words, counted, wordPages > 0 ? plan.specificationPage + 1 : undefined, scale))
  for (const canvas of drawWordChartPages(words, plan.page, () => blankPage(plan.page, scale), plan.specificationPage + 1, counted.pageCount)) {
    await add(canvas)
  }

  return buildPdf(pages, (plan.page.width * 72) / PRINT_DPI, (plan.page.height * 72) / PRINT_DPI)
}

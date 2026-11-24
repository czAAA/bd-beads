import { PDF_PAGE_DPI } from '../domain/exportQuality'
import type { Project } from '../domain/project'
import { buildPdf, type PdfPage } from '../domain/pdfDocument'
import { exactColors, packPage, type PackedPage } from '../domain/pagePacking'
import { withLaidTurn } from '../domain/framePlacement'
import { projectColors } from '../domain/layerBeads'
import { deflateText, encodePng } from '../domain/pngEncoder'
import { K } from './chartVector'
import type { PageLink } from './coverFooter'
import { pageOneLayout } from './pageOneLayout'
import { A4_PORTRAIT, PRINT_DPI, type PrintPart } from './printPlan'
import type { PrintText } from './printText'
import { drawWordChartPages, pdfPageCount } from './wordChartPages'

// Project exports (tickets 73, 74, 0583, 0914, 0915): drawn onto page canvases made here, one page at a time and compressed strip by
// strip, so memory is bounded by the page, not the Project (ADR 0018, 250 × 250).

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('No 2D canvas is available to draw the export on.')
  }
  return context
}

// ---- PNG -----------------------------------------------------------------------------------------------------------

/** How many pixels one strip of a page holds while it is compressed. */
const STRIP_PIXELS = 1_000_000

/** The page as a PNG, compressed strip by strip. */
function pngOf(canvas: HTMLCanvasElement, project: Project): Promise<Blob> {
  const context = contextOf(canvas)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / canvas.width))
  return encodePng(canvas.width, canvas.height, stripRows, (y, rows) => context.getImageData(0, y, canvas.width, rows).data, exactColors(projectColors(project)))
}

// The Project as a PNG (tickets 164, 0583, 1096; PngExport card): the Cover page as a picture, one file whatever the piece,
// drawn at `dpi` and always in color. It is saved whatever the Cover page switch says (that switch is the PDF's), so its
// footer reads "1 / 1".
export async function exportProjectPng(shown: Project, words: PrintText, dpi = PRINT_DPI): Promise<Blob> {
  const project = withLaidTurn(shown, undefined, words.frame)
  // Loaded when a PNG is asked for: the page drawing (and the mark it reads from the design system) isn't needed before.
  const { drawCoverPage } = await import('./coverPage')
  const { loadPrintFonts } = await import('./printPages')
  await loadPrintFonts()
  const { canvas } = drawCoverPage(project, words, A4_PORTRAIT, 1, 1, dpi / PRINT_DPI)
  const blob = await pngOf(canvas, project)
  canvas.width = 0
  canvas.height = 0
  return blob
}

// ---- PDF -----------------------------------------------------------------------------------------------------------

/** The page as compressed scanlines, packed as small as keeps every color of the Project (tickets 572, 1142, ADR 0043). */
function flateOf(canvas: HTMLCanvasElement, project: Project): Promise<PackedPage> {
  const context = contextOf(canvas)
  const stripRows = Math.max(1, Math.floor(STRIP_PIXELS / canvas.width))
  return packPage(canvas.width, canvas.height, stripRows, (y, rows) => context.getImageData(0, y, canvas.width, rows).data, exactColors(projectColors(project)))
}

// The Project as a PDF (tickets 162, 0914, 1096): the Cover page when it is asked for, page 1 (the chart whole, or the
// overview of its parts) and its list pages, the chart pages when there are any, then the Word chart, drawn one at a time so memory stays bounded (ADR 0019). Pictures are
// drawn at `dpi` (ADR 0076: the PDF has no Export quality); the sheet is the same size in points whatever it is.
export async function exportProjectPdf(shown: Project, words: PrintText, dpi = PDF_PAGE_DPI): Promise<Blob> {
  const project = withLaidTurn(shown, undefined, words.frame)
  const layout = pageOneLayout(project, words)
  const scale = dpi / PRINT_DPI
  // Loaded when a PDF is asked for: the page drawing (and the mark it reads from the design system) isn't needed
  // before.
  const { blankPage, loadPrintFonts } = await import('./printPages')
  const { drawChartPage } = await import('./chartPage')
  const { drawNeededListPage, drawPageOne } = await import('./pageOnePage')
  const { drawCoverPage } = await import('./coverPage')
  await loadPrintFonts()
  // The Word chart (ticket 0574) follows the chart pages and counts in every page's "of N".
  const plan = { ...layout.plan, pageCount: pdfPageCount(layout.plan, words) }

  const pages: PdfPage[] = []
  const add = async (canvas: HTMLCanvasElement, drawing?: string, links?: PageLink[]) => {
    const size = { pixelWidth: canvas.width, pixelHeight: canvas.height }
    const { flate, palette } = await flateOf(canvas, project)
    pages.push({ ...size, flate, ...(palette ? { palette } : {}), ...(drawing ? { drawing: await deflateText(drawing) } : {}), ...(links?.length ? { links: links.map((link) => ({ x: link.x * K, y: link.y * K, width: link.width * K, height: link.height * K, uri: link.uri })) } : {}) })
    // Let the canvas go before the next page is drawn.
    canvas.width = 0
    canvas.height = 0
  }

  // The Cover page is a picture, always in color (PrintCover card).
  if (words.cover) {
    const cover = drawCoverPage(project, words, plan.page, 1, plan.pageCount, scale, true)
    await add(cover.canvas, cover.drawing, cover.links)
  }
  // Page 1 is the lines and letters of a whole chart as PDF drawing (ADR 0043) over a picture of its text, as a chart page is.
  const first = drawPageOne(project, words, layout, plan, scale)
  await add(first.canvas, first.drawing)
  for (let index = 0; index < layout.lists.length; index += 1) await add(drawNeededListPage(project, words, layout, index, plan, scale))
  // Usually one part per page; PrintStrips can put several small parts on the same sheet, so pages come from grouping
  // them.
  const sheets = new Map<number, PrintPart[]>()
  for (const part of plan.parts) if (part.page > plan.pageOneNumber) sheets.set(part.page, [...(sheets.get(part.page) ?? []), part])
  for (const parts of sheets.values()) {
    // A chart page is the lines and letters as PDF drawing (ticket 0585, ADR 0043) over a picture of its text alone.
    const chart = drawChartPage(project, words, plan, parts, scale)
    await add(chart.canvas, chart.drawing)
  }
  for (const canvas of drawWordChartPages(words, plan.page, () => blankPage(plan.page, scale), layout.plan.pageCount + 1, plan.pageCount)) {
    await add(canvas)
  }

  return buildPdf(pages, (plan.page.width * 72) / PRINT_DPI, (plan.page.height * 72) / PRINT_DPI, words.name.trim())
}

import { PDF_PAGE_DPI } from '../domain/exportQuality'
import { planWithKey } from './chartPageKey'
import { A4_PORTRAIT, PRINT_DPI } from './printPlan'

// Lossless, per A4 page of 150 dpi pixels: 0.06 to 0.33 bytes a pixel measured, growing about with the dpi, not its square
// (ticket 572). A PNG page is the same drawing as a PDF page, so it shares the figure (ticket 0583); a dense Schema comes out
// larger than it says, one of few big beads smaller. Shown as "≈".
const BYTES_PER_PIXEL = 0.11

/** About how many bytes a PNG is at this dpi: the cover and the `lists` list pages Beads needed runs over onto, each a
 * typical page. */
export function estimatePngBytes(dpi: number, lists: number): number {
  return Math.round((1 + lists) * A4_PORTRAIT.width * A4_PORTRAIT.height * BYTES_PER_PIXEL * (dpi / PRINT_DPI))
}

/** What a chart page comes to: its text picture (mostly paper) and its drawing, compressed (ticket 0585, ADR 0043). An
 * upper bound for a full 60 × 75 page. */
const CHART_PAGE_BYTES = 150_000

/** About how many bytes the PDF is: its chart pages are drawing and a small text picture whatever the Schema, the rest (the
 * Cover, the `lists` list pages, the Specification, the Word chart) pictures at the PDF's fixed dpi. */
export function estimatePdfBytes(project: Parameters<typeof planWithKey>[0], lists = 0): number {
  const plan = planWithKey(project, lists)
  const chartPages = new Set(plan.parts.map((part) => part.page)).size
  return Math.round(chartPages * CHART_PAGE_BYTES + estimatePngBytes(PDF_PAGE_DPI, plan.pageCount - chartPages - 1))
}

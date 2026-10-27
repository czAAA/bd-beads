import { A4_PORTRAIT, planPrint, PRINT_DPI } from './printPlan'

// Lossless, per A4 page of 150 dpi pixels: 0.06 to 0.33 bytes a pixel measured, growing about with the dpi, not its square
// (ticket 572). A PNG page is the same drawing as a PDF page, so it shares the figure (ticket 0583); a dense Schema comes out
// larger than it says, one of few big beads smaller. Shown as "≈".
const BYTES_PER_PIXEL = 0.11

/** About how many bytes a PNG is at this dpi: the cover and the `lists` list pages Beads needed runs over onto, each a
 * typical page. */
export function estimatePngBytes(dpi: number, lists: number): number {
  return Math.round((1 + lists) * A4_PORTRAIT.width * A4_PORTRAIT.height * BYTES_PER_PIXEL * (dpi / PRINT_DPI))
}

/** About how many bytes the PDF is at this DPI: its pages (the `lists` list pages included) times a typical page, which
 * grows about with the DPI. */
export function estimatePdfBytes(project: Parameters<typeof planPrint>[0], dpi: number, lists = 0): number {
  const plan = planPrint(project, undefined, lists)
  return Math.round(plan.pageCount * plan.page.width * plan.page.height * BYTES_PER_PIXEL * (dpi / PRINT_DPI))
}

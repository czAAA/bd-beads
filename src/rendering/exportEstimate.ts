import { projectDimensions } from '../domain/project'
import { pngZoom } from './projectExport'
import { planPrint, PRINT_DPI } from './printPlan'
import { CELL_SIZE_PX } from './surfaceView'

type Shape = Parameters<typeof pngZoom>[0]

// PNG bytes per bead at 45 px and how that grows with bead size, measured in Chromium (exportEstimate.browser.test.ts keeps
// it within a quarter of real files). PDF: lossless, per A4 page of 150 dpi pixels, 0.06 to 0.33 measured, growing about
// with the dpi, not its square (ticket 572). Shown as "≈".
const PNG_BYTES_PER_BEAD = 64
const PNG_BEAD_GROWTH = 1.65
const PNG_FIXED_BYTES = 40_000
const PDF_BYTES_PER_PIXEL = 0.11

/** How many px a bead is across in the PNG at this quality, after the pixel ceiling has reduced it (QualitySlider card). */
export function pngBeadPx(project: Shape, wanted: number): number {
  return Math.round(pngZoom(project, wanted) * CELL_SIZE_PX)
}

/** About how many bytes the PNG is at this bead size: the beads times what a bead takes at that size, plus the story. */
export function estimatePngBytes(project: Shape, beadPx: number): number {
  const { columns, rows } = projectDimensions(project)
  const shown = pngBeadPx(project, beadPx)
  const perBead = PNG_BYTES_PER_BEAD * (shown / 45) ** PNG_BEAD_GROWTH
  return Math.round(columns * rows * perBead + PNG_FIXED_BYTES * (shown / 45))
}

/** About how many bytes the PDF is at this DPI: its pages times a typical page, which grows about with the DPI. */
export function estimatePdfBytes(project: Parameters<typeof planPrint>[0], dpi: number): number {
  const plan = planPrint(project)
  const pages = 1 + new Set(plan.parts.map((part) => part.page)).size
  return Math.round(pages * plan.page.width * plan.page.height * PDF_BYTES_PER_PIXEL * (dpi / PRINT_DPI))
}

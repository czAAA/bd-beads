import { frameWeave, projectDimensions } from '../domain/project'
import { PNG_MARGIN_PX, pngZoom } from './projectExport'
import { mm, planPrint, PRINT_DPI } from './printPlan'
import { CELL_SIZE_PX, displayedExtentPx } from './surfaceView'

type Shape = Parameters<typeof pngZoom>[0]

// Bytes per pixel. PNG: 0.024 to 0.047 in Chromium, falling as beads grow (ticket 571). PDF: per A4 page of 150 dpi pixels,
// lossless, 0.06 to 0.33 on charts of 30 × 20 to 250 × 250, growing about with the dpi, not its square (ticket 572).
// Estimates are out by a half either way and shown as "≈".
const PNG_BYTES_PER_PIXEL = 0.04
const PDF_BYTES_PER_PIXEL = 0.11

/** How many px a bead is across in the PNG at this quality, after the pixel ceiling has reduced it (QualitySlider card). */
export function pngBeadPx(project: Shape, wanted: number): number {
  return Math.round(pngZoom(project, wanted) * CELL_SIZE_PX)
}

// The story column's room beside a tall chart (pngPage.ts: 8 mm gutter, 58 mm wide) or under a wide one (about 60 mm
// tall; its text height is only known once drawn). pngPage is loaded on demand, so its constants are not imported.
const STORY_BESIDE_PX = Math.ceil(mm(8)) + Math.ceil(mm(58))
const STORY_UNDER_PX = Math.ceil(mm(8)) + Math.ceil(mm(60))

/** About how many bytes the PNG is at this bead size: the picture's pixels, chart and story column, times a typical density. */
export function estimatePngBytes(project: Shape, beadPx: number): number {
  const zoom = pngZoom(project, beadPx)
  const { width, height } = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, zoom, project.rotation, frameWeave(project).cell)
  const chart = { width: Math.ceil(width) + PNG_MARGIN_PX * 2, height: Math.ceil(height) + PNG_MARGIN_PX * 2 }
  const wide = chart.width > chart.height
  const pixels = (chart.width + (wide ? 0 : STORY_BESIDE_PX)) * (chart.height + (wide ? STORY_UNDER_PX : 0))
  return Math.round(pixels * PNG_BYTES_PER_PIXEL)
}

/** About how many bytes the PDF is at this DPI: its pages times a typical page, which grows about with the DPI. */
export function estimatePdfBytes(project: Parameters<typeof planPrint>[0], dpi: number): number {
  const plan = planPrint(project)
  const pages = 1 + new Set(plan.parts.map((part) => part.page)).size
  return Math.round(pages * plan.page.width * plan.page.height * PDF_BYTES_PER_PIXEL * (dpi / PRINT_DPI))
}

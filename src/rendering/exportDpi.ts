import { PDF_PAGE_DPI, PNG_DPI_BY_QUALITY, type ExportQuality } from '../domain/exportQuality'
import { A4_PORTRAIT, PRINT_DPI } from './printPlan'

const probed = new Map<number, boolean>()

/** Whether this browser can hold an A4 page canvas at `dpi` (ticket 572): tried, not guessed from the device, since the
 * limit differs by browser and memory (iPad Safari stops near 16 megapixels). A canvas past it gives no context or a
 * blank one, so the last pixel is written and read back. */
function canDrawAt(dpi: number): boolean {
  const known = probed.get(dpi)
  if (known !== undefined) return known
  const scale = dpi / PRINT_DPI
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(A4_PORTRAIT.width * scale)
  canvas.height = Math.round(A4_PORTRAIT.height * scale)
  let works = false
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context) {
      context.fillStyle = '#ff0000'
      context.fillRect(canvas.width - 1, canvas.height - 1, 1, 1)
      works = context.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data[0] === 255
    }
  } catch {
    works = false
  }
  canvas.width = 0
  canvas.height = 0
  probed.set(dpi, works)
  return works
}

/** The dpi the PNG is drawn at for this Export quality on this device: the quality's own, or the next one down when a
 * page that large cannot be allocated (the PRINT_DPI floor is always drawn). */
export function pngDpiFor(quality: ExportQuality): number {
  const steps = Object.values(PNG_DPI_BY_QUALITY).sort((a, b) => b - a)
  return steps.find((dpi) => dpi <= PNG_DPI_BY_QUALITY[quality] && (dpi === PRINT_DPI || canDrawAt(dpi))) ?? PRINT_DPI
}

/** The dpi the PDF's picture pages are drawn at on this device: 300, or 150 where a page that large cannot be allocated
 * (ADR 0076); no Export quality changes it. */
export function pdfPageDpi(): number {
  return canDrawAt(PDF_PAGE_DPI) ? PDF_PAGE_DPI : PRINT_DPI
}

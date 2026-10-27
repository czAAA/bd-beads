/** The Export quality choices (QualitySlider card, glossary: Export quality): one pick for both exports. */
export const EXPORT_QUALITIES = ['low', 'medium', 'high'] as const
export type ExportQuality = (typeof EXPORT_QUALITIES)[number]

/** Medium until a person picks another (QualitySlider card). */
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'medium'

/** The export quality a saved string stands for, or undefined when it is not one. */
export function parseExportQuality(raw: string): ExportQuality | undefined {
  return EXPORT_QUALITIES.find((quality) => quality === raw)
}

/** How much larger than at Medium the Word chart's picture is drawn at each quality (QualitySlider card, ticket 0574). */
export const WORD_CHART_SCALE_BY_QUALITY: Record<ExportQuality, number> = { low: 0.75, medium: 1, high: 1.5 }

/** The dpi the PNG's pages are drawn at for each quality (QualitySlider card, tickets 572, 0583, 0585); the sheet is A4
 * whatever it is. The PDF is not on the slider (ADR 0076). */
export const PNG_DPI_BY_QUALITY: Record<ExportQuality, number> = { low: 150, medium: 300, high: 450 }

/** A file size in whole megabytes, rounded the way an estimate should read: never to the digit ("≈ 12 MB", not 11.8). */
export function roundedMegabytes(bytes: number): number {
  const mb = bytes / 1_000_000
  if (mb < 10) return Math.max(1, Math.round(mb))
  const step = mb < 100 ? 5 : 50
  return Math.round(mb / step) * step
}

/** The dpi the PDF's picture pages and the text picture under each chart page are drawn at (`print-dpi`, ADR 0076). */
export const PDF_PAGE_DPI = 300

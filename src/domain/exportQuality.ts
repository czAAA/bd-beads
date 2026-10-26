/** The Export quality choices (QualitySlider card, glossary: Export quality): one pick for both exports. */
export const EXPORT_QUALITIES = ['low', 'medium', 'high'] as const
export type ExportQuality = (typeof EXPORT_QUALITIES)[number]

/** Medium until a person picks another (QualitySlider card). */
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'medium'

/** The export quality a saved string stands for, or undefined when it is not one. */
export function parseExportQuality(raw: string): ExportQuality | undefined {
  return EXPORT_QUALITIES.find((quality) => quality === raw)
}

/** How many px a bead is across in the PNG at each quality (QualitySlider card); a large Frame is drawn smaller. */
export const PNG_BEAD_PX_BY_QUALITY: Record<ExportQuality, number> = { low: 45, medium: 60, high: 90 }

/** The dpi the PDF's pages are drawn at for each quality (QualitySlider card, ticket 572); the sheet is A4 whatever it is. */
export const PDF_DPI_BY_QUALITY: Record<ExportQuality, number> = { low: 150, medium: 300, high: 450 }

/** A file size in whole megabytes, rounded the way an estimate should read: never to the digit ("≈ 12 MB", not 11.8). */
export function roundedMegabytes(bytes: number): number {
  const mb = bytes / 1_000_000
  if (mb < 10) return Math.max(1, Math.round(mb))
  const step = mb < 100 ? 5 : 50
  return Math.round(mb / step) * step
}

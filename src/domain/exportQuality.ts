/** The Export quality choices (QualitySlider card, glossary: Export quality): one pick for both exports. */
export const EXPORT_QUALITIES = ['low', 'medium', 'high'] as const
export type ExportQuality = (typeof EXPORT_QUALITIES)[number]

/** Medium until a person picks another (QualitySlider card). */
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'medium'

/** The export quality a saved string stands for, or undefined when it is not one. */
export function parseExportQuality(raw: string): ExportQuality | undefined {
  return EXPORT_QUALITIES.find((quality) => quality === raw)
}

/** The dpi the PNG's pages are drawn at for each quality (QualitySlider card, tickets 572, 0583, 0585); the sheet is A4
 * whatever it is. The PDF is not on the slider (ADR 0076). */
export const PNG_DPI_BY_QUALITY: Record<ExportQuality, number> = { low: 150, medium: 300, high: 450 }

/** A file size as it is shown (QualitySlider card, ADR 0076): rounded **up** to 0.1 MB, to a whole MB from 10 MB, and
 * `undefined` under 0.1 MB, which reads "< 0.1 MB". Up, so the figure is never less than the file. */
export function shownMegabytes(bytes: number): number | undefined {
  if (bytes < 100_000) return undefined
  const tenths = Math.ceil(bytes / 100_000)
  return tenths >= 100 ? Math.ceil(bytes / 1_000_000) : tenths / 10
}

/** The dpi the PDF's picture pages and the text picture under each chart page are drawn at (`print-dpi`, ADR 0076). */
export const PDF_PAGE_DPI = 300

/** The Export quality choices (QualitySlider card, glossary: Export quality): one pick for both exports. */
export const EXPORT_QUALITIES = ['low', 'medium', 'high'] as const
export type ExportQuality = (typeof EXPORT_QUALITIES)[number]

/** Medium until a person picks another (QualitySlider card). */
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'medium'

/** The export quality a saved string stands for, or undefined when it is not one. */
export function parseExportQuality(raw: string): ExportQuality | undefined {
  return EXPORT_QUALITIES.find((quality) => quality === raw)
}

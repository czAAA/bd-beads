import { computed } from 'vue'
import { convertResult } from '../../domain/convertSize'
import { useI18n } from '../../i18n/useI18n'
import type { ConvertImageWizard } from './useConvertImageWizard'

/** The wizard's result line in the app's language (ConvertImage card): the Size step's box, its summary and the preview's
 * band read the same parts. With a part of the beads kept (ticket 0780), `kept` is that part's grid and measure. None
 * without a picture. */
export function useConvertResult(wizard: ConvertImageWizard) {
  const { t, locale } = useI18n()
  return computed(() => {
    if (!wizard.hasPicture.value) return undefined
    const words = t.value.convertImage.wizard
    const labels = { grid: words.resultGrid, exact: words.resultExact, approximate: words.resultApprox, perPixel: words.resultPerPixel, mm: t.value.form.unitMm, cm: t.value.form.unitCm }
    const input = { bead: wizard.bead.value, technique: wizard.technique.value, sizing: wizard.sizing.value }
    const part = wizard.kept.value
    return {
      ...convertResult(input, labels, locale.value),
      kept: part && convertResult({ ...input, sizing: { ...input.sizing, grid: { columns: part.columns, rows: part.rows } } }, labels, locale.value),
    }
  })
}

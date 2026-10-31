import { computed } from 'vue'
import { convertResult } from '../../domain/convertSize'
import { useI18n } from '../../i18n/useI18n'
import type { ConvertImageWizard } from './useConvertImageWizard'

/** The wizard's result line in the app's language (ConvertImage card): the Size section's box and the footer read
 * the same three parts. None without a picture. */
export function useConvertResult(wizard: ConvertImageWizard) {
  const { t, locale } = useI18n()
  return computed(() => {
    if (!wizard.hasPicture.value) return undefined
    const words = t.value.convertImage.wizard
    return convertResult(
      { bead: wizard.bead.value, technique: wizard.technique.value, sizing: wizard.sizing.value },
      { grid: words.resultGrid, exact: words.resultExact, approximate: words.resultApprox, perPixel: words.resultPerPixel, mm: t.value.form.unitMm, cm: t.value.form.unitCm },
      locale.value,
    )
  })
}

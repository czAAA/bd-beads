import { computed } from 'vue'
import { imageInputAccept } from '../../domain/imageConversion'
import { imageLimitsText } from '../../i18n/imageLimits'
import { useI18n } from '../../i18n/useI18n'
import { useMediaQuery } from '../ui/useMediaQuery'
import type { ConvertImageWizard } from './useConvertImageWizard'

/** The converter's file inputs, one way in wherever they stand (the drop zone, Replace's menu; ticket 0896): what they
 * accept, whether Take photo is offered (a finger is the main pointer), a picked file handed to the wizard's one
 * validation and decode, and the refused file's message in the app's language. */
export function useConvertFileInput(wizard: ConvertImageWizard) {
  const { t, locale } = useI18n()
  return {
    accept: imageInputAccept(),
    touch: useMediaQuery('(pointer: coarse)'),
    error: computed(() => (wizard.rejection.value ? imageLimitsText(locale.value, t.value.convertImage.errors[wizard.rejection.value]) : undefined)),
    async onFileChange(event: Event) {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      try {
        if (file) await wizard.setFile(file)
      } finally {
        // Clear the input so picking the same file again still counts as a change.
        input.value = ''
      }
    },
  }
}

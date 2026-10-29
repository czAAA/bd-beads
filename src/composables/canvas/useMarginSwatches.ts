import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useBackgroundSwatches } from './useBackgroundSwatches'

/** The margin color's swatches as the background color picker shows them (tickets 0656, 0657, 0683; MarginSheet card):
 * Auto first (split, the Canvas color and the margin color), then the theme's five Canvas colors, the Canvas color's
 * dotted. One source for the Frame panel's margin section and the sheet's Margin color popover, so the two pick alike. */
export function useMarginSwatches() {
  const { t } = useI18n()
  const canvas = useCanvasBackground()
  const margin = canvas.margin
  const words = computed(() => t.value.frame.margin)
  const canvasColor = computed(() => canvas.background.value?.color)
  return useBackgroundSwatches(margin, {
    auto: {
      swatch: computed(() => ({ color: margin.auto.value, split: canvasColor.value, name: words.value.auto, label: words.value.autoLabel })),
      choose: () => margin.setChoice('auto'),
    },
    canvasColor: { color: canvasColor, label: (color) => fillBlanks(words.value.canvasColorLabel, { color }) },
  })
}

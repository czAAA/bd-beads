import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import { frameOf } from '../../domain/layerRecord'

const AUTO = 'auto'

/** The margin color's swatches as the background color picker shows them (tickets 0656, 0657; MarginSheet card): Auto
 * first (split, the Canvas color and the margin color), then the theme's five Canvas colors, the Canvas color's dotted.
 * One source for the Frame panel's margin section and the sheet's Margin color popover, so the two pick alike. */
export function useMarginSwatches() {
  const { t } = useI18n()
  const theme = useResolvedTheme()
  const canvas = useCanvasBackground()
  const margin = canvas.margin

  const listed = computed(() => canvasBackgrounds(theme.value))
  const swatches = computed(() => {
    const words = t.value.frame.margin
    const canvasColor = canvas.background.value?.color
    const auto = { id: AUTO, color: margin.auto.value, split: canvasColor, name: words.auto, label: words.autoLabel }
    return [
      auto,
      ...listed.value.map(({ id, color }, index) => {
        const name = t.value.canvas.canvasColor.names[id]
        const isCanvas = color === canvasColor
        const label = isCanvas
          ? fillBlanks(words.canvasColorLabel, { color: name })
          : fillBlanks(t.value.canvas.canvasColor.swatchLabel, { name, n: index + 1, count: listed.value.length })
        return { id, color, name, label, dot: isCanvas }
      }),
    ]
  })

  /** The swatch shown: Auto, one of the five, or none while the Custom color is. */
  const selectedId = computed(() => {
    const choice = margin.choice.value
    if (choice === 'custom') return margin.customColor.value ? undefined : AUTO
    if (choice === 'auto') return AUTO
    return listed.value[choice - 1]?.id ?? AUTO
  })
  /** The chosen color's name: a section's collapsed summary. */
  const summary = computed(() => {
    const id = selectedId.value
    if (id === undefined) return t.value.palette.customColorLabel
    return swatches.value.find((swatch) => swatch.id === id)?.name
  })

  function choose(id: string): void {
    margin.setChoice(id === AUTO ? 'auto' : listed.value.findIndex((background) => background.id === id) + 1)
  }

  /** High contrast lists no Canvas colors: the sheet stays white and there is nothing to pick. */
  const offered = computed(() => listed.value.length > 0)

  return { swatches, selectedId, summary, offered, customColor: margin.customColor, choose, chooseCustom: margin.setCustomColor }
}

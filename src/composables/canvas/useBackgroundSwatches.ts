import { computed, type ComputedRef, type Ref } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds, type MarginChoice } from '../../rendering/canvasBackgrounds'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

/** What a background color picker stores its pick in: the Canvas color's preferences or the margin color's. */
export interface BackgroundStore {
  /** The stored choice: one of the theme's Canvas colors by position, `custom`, or `auto` where Auto is offered. */
  choice: Readonly<Ref<MarginChoice>>
  customColor: Readonly<Ref<string | undefined>>
  setChoice: (position: number) => void
  setCustomColor: (hex: string) => void
}

/** The Auto swatch a picker may lead with (the margin's): drawn split, `color` with `split` over it. */
interface AutoSwatch {
  color: string
  split?: string
  name: string
  label: string
}

interface BackgroundSwatchOptions {
  /** Auto, first, and how to store it. */
  auto?: { swatch: ComputedRef<AutoSwatch>; choose: () => void }
  /** Dot the swatch that is the Canvas color, `color`, and name it so (the margin's): its accessible name from its own. */
  canvasColor?: { color: ComputedRef<string | undefined>; label: (name: string) => string }
}

const AUTO = 'auto'

/** The background color picker's model for one stored color (tickets 0653, 0656, 0683; CanvasBackground and MarginSheet
 * cards): the theme's five Canvas colors as swatches, the one chosen, its name for a summary, and what a pick stores.
 * The Canvas color and the margin color both build theirs here, so their pickers cannot drift apart. */
export function useBackgroundSwatches(store: BackgroundStore, options: BackgroundSwatchOptions = {}) {
  const { t } = useI18n()
  const theme = useResolvedTheme()

  const listed = computed(() => canvasBackgrounds(theme.value))
  const swatches = computed(() => {
    const dotted = options.canvasColor
    const canvasColor = dotted?.color.value
    const words = t.value.canvas.canvasColor
    const colors = listed.value.map(({ id, color }, index) => {
      const name = words.names[id]
      if (dotted && color === canvasColor) return { id, color, name, label: dotted.label(name), dot: true }
      return { id, color, name, label: fillBlanks(words.swatchLabel, { name, n: index + 1, count: listed.value.length }) }
    })
    return options.auto ? [{ id: AUTO, ...options.auto.swatch.value }, ...colors] : colors
  })

  /** High contrast lists no Canvas colors: the canvas and the sheet stay white and there is nothing to pick. */
  const offered = computed(() => listed.value.length > 0)

  /** The swatch shown: the one stored, the first where that is gone (a Custom color not yet taken, a position this
   * theme lacks), or none while the Custom color is. */
  const selectedId = computed(() => {
    const choice = store.choice.value
    const first = swatches.value[0]?.id
    if (choice === 'custom') return store.customColor.value ? undefined : first
    if (choice === AUTO) return options.auto ? AUTO : first
    return listed.value[choice - 1]?.id ?? first
  })

  /** The chosen color's name, for a section's collapsed summary; none where nothing is offered. */
  const summary = computed(() => {
    if (!offered.value) return undefined
    const id = selectedId.value
    return id === undefined ? t.value.palette.customColorLabel : swatches.value.find((swatch) => swatch.id === id)?.name
  })

  function choose(id: string): void {
    if (id === AUTO && options.auto) options.auto.choose()
    else store.setChoice(listed.value.findIndex((background) => background.id === id) + 1)
  }

  return { swatches, selectedId, summary, offered, customColor: store.customColor, choose, chooseCustom: store.setCustomColor }
}

import { computed, readonly, type ComputedRef, type Ref } from 'vue'
import { canvasBackgroundOf, canvasTheme, marginColorOf, shownChoice, type CanvasBackground, type CanvasChoice, type MarginChoice } from '../rendering/canvasBackgrounds'
import type { ProjectTheme } from '../rendering/beadLook'
import { useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import { useResolvedTheme } from './useResolvedTheme'

/** The Frame's margin color (ticket 0656, MarginSheet card): stored on the device as the Canvas color is. */
export interface MarginColor {
  /** The stored choice: `auto`, 1 to 5, or `custom`. */
  choice: Readonly<Ref<MarginChoice>>
  /** The last Custom color taken for the margin, if any. */
  customColor: Readonly<Ref<string | undefined>>
  /** What Auto shows now: the Canvas color one step off. */
  auto: ComputedRef<string>
  setChoice: (next: MarginChoice) => void
  /** Shows a Custom color on the margin and remembers it. */
  setCustomColor: (hex: string) => void
  /** Whether the sheet shows its title block (ticket 0657, "Name and size on the margin"), kept on the device. */
  titleBlock: Readonly<Ref<boolean>>
  setTitleBlock: (shown: boolean) => void
}

/** The person's Canvas color (tickets 252, 0653) and margin color and title block (tickets 0656, 0657), shared by the app. The stored choice is
 * kept whatever the theme shows of it, and the Custom color is kept while a numbered one shows. */
export function useCanvasBackground(preferences: DevicePreferences = useDevicePreferences()): {
  /** The stored choice: 1 to 5, or `custom`. */
  choice: Readonly<Ref<CanvasChoice>>
  /** The last Custom color taken, if any. */
  customColor: Readonly<Ref<string | undefined>>
  /** The choice shown in the current theme. */
  shown: ComputedRef<CanvasChoice>
  /** The background shown now, or undefined in high contrast. */
  background: ComputedRef<CanvasBackground | undefined>
  /** The Project's colors on that background, its margin sheet in the margin color. */
  projectTheme: ComputedRef<ProjectTheme>
  margin: MarginColor
  setChoice: (next: number) => void
  /** Shows a Custom color and remembers it. */
  setCustomColor: (hex: string) => void
} {
  const choice = preferences.get('canvasBackground')
  const customColor = preferences.get('canvasCustomColor')
  const marginChoice = preferences.get('marginColor')
  const marginCustomColor = preferences.get('marginCustomColor')
  const titleBlock = preferences.get('marginTitleBlock')
  const theme = useResolvedTheme()
  const marginPick = () => ({ choice: marginChoice.value, customColor: marginCustomColor.value })
  return {
    choice: readonly(choice),
    customColor: readonly(customColor),
    shown: computed(() => shownChoice(theme.value, choice.value, customColor.value)),
    background: computed(() => canvasBackgroundOf(theme.value, choice.value, customColor.value)),
    projectTheme: computed(() => canvasTheme(theme.value, choice.value, customColor.value, marginPick())),
    margin: {
      choice: readonly(marginChoice),
      customColor: readonly(marginCustomColor),
      auto: computed(() => marginColorOf(theme.value, choice.value, customColor.value)),
      setChoice(next) {
        marginChoice.value = next
      },
      setCustomColor(hex) {
        marginCustomColor.value = hex
        marginChoice.value = 'custom'
      },
      titleBlock: readonly(titleBlock),
      setTitleBlock(shown) {
        titleBlock.value = shown
      },
    },
    setChoice(next) {
      choice.value = next
    },
    setCustomColor(hex) {
      customColor.value = hex
      choice.value = 'custom'
    },
  }
}

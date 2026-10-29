import { computed, readonly, type ComputedRef, type Ref } from 'vue'
import { canvasBackgroundOf, canvasTheme, shownChoice, type CanvasBackground, type CanvasChoice } from '../rendering/canvasBackgrounds'
import type { ProjectTheme } from '../rendering/beadLook'
import { useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import { useResolvedTheme } from './useResolvedTheme'

/** The person's Canvas color (tickets 252, 0653), shared by the app. The stored choice is kept whatever the theme shows
 * of it, and the Custom color is kept while a numbered one shows. */
export function useCanvasBackground(preferences: DevicePreferences = useDevicePreferences()): {
  /** The stored choice: 1 to 5, or `custom`. */
  choice: Readonly<Ref<CanvasChoice>>
  /** The last Custom color taken, if any. */
  customColor: Readonly<Ref<string | undefined>>
  /** The choice shown in the current theme. */
  shown: ComputedRef<CanvasChoice>
  /** The background shown now, or undefined in high contrast. */
  background: ComputedRef<CanvasBackground | undefined>
  /** The Project's colors on that background. */
  projectTheme: ComputedRef<ProjectTheme>
  setChoice: (next: number) => void
  /** Shows a Custom color and remembers it. */
  setCustomColor: (hex: string) => void
} {
  const choice = preferences.get('canvasBackground')
  const customColor = preferences.get('canvasCustomColor')
  const theme = useResolvedTheme()
  return {
    choice: readonly(choice),
    customColor: readonly(customColor),
    shown: computed(() => shownChoice(theme.value, choice.value, customColor.value)),
    background: computed(() => canvasBackgroundOf(theme.value, choice.value, customColor.value)),
    projectTheme: computed(() => canvasTheme(theme.value, choice.value, customColor.value)),
    setChoice(next) {
      choice.value = next
    },
    setCustomColor(hex) {
      customColor.value = hex
      choice.value = 'custom'
    },
  }
}

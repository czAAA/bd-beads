import { computed, readonly, type ComputedRef, type Ref } from 'vue'
import { canvasBackgroundOf, canvasTheme, canvasWordColor, shownChoice, type CanvasBackground } from '../rendering/canvasBackgrounds'
import type { ProjectTheme } from '../rendering/beadLook'
import type { PositionMarkStyle } from '../rendering/positionMarks'
import { useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import { useResolvedTheme } from './useResolvedTheme'

/**
 * The person's Canvas color (ticket 252), shared by the app: the picker sets it, and the drawing area and the canvas
 * renderer read what it shows in the theme now. The stored number is kept whatever the theme shows of it.
 */
export function useCanvasBackground(preferences: DevicePreferences = useDevicePreferences()): {
  /** The stored number, 1 to 6. */
  choice: Readonly<Ref<number>>
  /** The position shown in the current theme (light has no 6). */
  shown: ComputedRef<number>
  /** The background shown now, or undefined in high contrast. */
  background: ComputedRef<CanvasBackground | undefined>
  /** The Project's colors on that background. */
  projectTheme: ComputedRef<ProjectTheme>
  /** The technique word's own color, where the background needs one. */
  wordColor: ComputedRef<string | undefined>
  setChoice: (next: number) => void
  /** How the open canvas draws its Position marks, Dots or Squares (ticket 348). */
  positionMarks: Readonly<Ref<PositionMarkStyle>>
  setPositionMarks: (next: PositionMarkStyle) => void
} {
  const choice = preferences.get('canvasBackground')
  const marks = preferences.get('positionMarks')
  const theme = useResolvedTheme()
  return {
    choice: readonly(choice),
    shown: computed(() => shownChoice(theme.value, choice.value)),
    background: computed(() => canvasBackgroundOf(theme.value, choice.value)),
    projectTheme: computed(() => canvasTheme(theme.value, choice.value)),
    wordColor: computed(() => canvasWordColor(theme.value, choice.value)),
    setChoice(next) {
      choice.value = next
    },
    positionMarks: readonly(marks),
    setPositionMarks(next) {
      marks.value = next
    },
  }
}

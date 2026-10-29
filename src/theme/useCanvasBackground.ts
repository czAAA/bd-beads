import { computed, readonly, type ComputedRef, type Ref } from 'vue'
import { backgroundOf, frameOf, type Layered } from '../domain/layerRecord'
import type { Layer } from '../domain/grid'
import type { Background } from '../domain/project'
import {
  backgroundOfPick,
  canvasBackgroundOf,
  canvasTheme,
  marginColorOf,
  pickOf,
  shownChoice,
  type CanvasBackground,
  type CanvasChoice,
  type MarginChoice,
} from '../rendering/canvasBackgrounds'
import type { ProjectTheme } from '../rendering/beadLook'
import { useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import { useResolvedTheme } from './useResolvedTheme'

/** The Frame's margin color (ticket 0656, MarginSheet card): stored on the device. */
export interface MarginColor {
  /** The stored choice: `auto`, 1 to 5, or `custom`. */
  choice: Readonly<Ref<MarginChoice>>
  /** The last Custom color taken for the margin, if any. */
  customColor: Readonly<Ref<string | undefined>>
  /** What Auto shows now: the Canvas's background one step off. */
  auto: ComputedRef<string>
  setChoice: (next: MarginChoice) => void
  /** Shows a Custom color on the margin and remembers it. */
  setCustomColor: (hex: string) => void
  /** Whether the sheet shows its title block (ticket 0657, "Name and size on the margin"), kept on the device. */
  titleBlock: Readonly<Ref<boolean>>
  setTitleBlock: (shown: boolean) => void
}

/** What a layer's Background shows in the current theme (ticket 0666). */
export interface ShownBackground {
  /** Its Background: its own, or the device's last pick where it has none. */
  background: Background
  /** The choice shown: a position in the theme's list, or `custom`. */
  choice: CanvasChoice
  /** The color under it now, or undefined in high contrast. */
  color: CanvasBackground | undefined
}

/** The open Project's layers on their own Backgrounds (ADR 0079, ticket 0666), with the device's last pick, the
 * Background a new Project starts with and a layer saved without one shows (tickets 252, 0653), and the margin color
 * and title block (tickets 0656, 0657). With no Project, the device's pick. */
export function useCanvasBackground(
  project: () => Layered | undefined = () => undefined,
  preferences: DevicePreferences = useDevicePreferences(),
): {
  /** The device's last pick: what a new Project starts on. */
  start: ComputedRef<Background>
  /** The last Custom color taken on the device, kept while a numbered one shows. */
  customColor: Readonly<Ref<string | undefined>>
  /** What a layer's Background shows now; the Frame of a Project without one reads the Canvas's. */
  shownOf: (layer: Layer) => ShownBackground
  /** The Canvas's background shown now, or undefined in high contrast. */
  background: ComputedRef<CanvasBackground | undefined>
  /** The Project's colors on the Canvas's background, its margin sheet in the margin color. */
  projectTheme: ComputedRef<ProjectTheme>
  /** The Frame's colors on its own background; the Canvas's without a Frame. */
  frameTheme: ComputedRef<ProjectTheme>
  margin: MarginColor
  /** Keeps a Background as the device's last pick, a Custom color as its last Custom color too. */
  remember: (background: Background) => void
} {
  const choice = preferences.get('canvasBackground')
  const customColor = preferences.get('canvasCustomColor')
  const marginChoice = preferences.get('marginColor')
  const marginCustomColor = preferences.get('marginCustomColor')
  const titleBlock = preferences.get('marginTitleBlock')
  const theme = useResolvedTheme()
  const start = computed(() => backgroundOfPick({ choice: choice.value, customColor: customColor.value }))
  const marginPick = () => ({ choice: marginChoice.value, customColor: marginCustomColor.value })
  const backgroundOfLayer = (layer: Layer): Background => {
    const open = project()
    const own = open && backgroundOf(open, layer === 'frame' && !frameOf(open) ? 'canvas' : layer)
    return own ?? start.value
  }
  const shownOf = (layer: Layer): ShownBackground => {
    const background = backgroundOfLayer(layer)
    const pick = pickOf(background)
    return { background, choice: shownChoice(theme.value, pick.choice, pick.customColor), color: canvasBackgroundOf(theme.value, pick.choice, pick.customColor) }
  }
  // Each layer's Background is a number or a string, so a Project replaced by an edit that leaves it alone changes no
  // look below, and the surface still draws only the rows the edit changed.
  const canvasBackground = computed(() => backgroundOfLayer('canvas'))
  const frameBackground = computed(() => backgroundOfLayer('frame'))
  const canvasPick = computed(() => pickOf(canvasBackground.value))
  return {
    start,
    customColor: readonly(customColor),
    shownOf,
    background: computed(() => canvasBackgroundOf(theme.value, canvasPick.value.choice, canvasPick.value.customColor)),
    projectTheme: computed(() => canvasTheme(theme.value, canvasPick.value.choice, canvasPick.value.customColor, marginPick())),
    frameTheme: computed(() => {
      const { choice: frameChoice, customColor: frameColor } = pickOf(frameBackground.value)
      return canvasTheme(theme.value, frameChoice, frameColor)
    }),
    margin: {
      choice: readonly(marginChoice),
      customColor: readonly(marginCustomColor),
      auto: computed(() => marginColorOf(theme.value, canvasPick.value.choice, canvasPick.value.customColor)),
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
    remember(background) {
      const pick = pickOf(background)
      if (pick.customColor) customColor.value = pick.customColor
      choice.value = pick.choice
    },
  }
}

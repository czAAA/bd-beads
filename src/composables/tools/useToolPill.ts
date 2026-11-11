import { computed, ref, watch } from 'vue'
import { provideRecentColors } from './usePalette'
import { normalizeHex } from '../../domain/color'
import { RECENT_SHORTCUTS, type Palette } from '../../domain/palette'
import { RECENTS_IN_PILL, pushRecentColor, recentsBeside } from '../../domain/toolPill'
import type { DevicePreferences } from '../../services/devicePreferences'

/** What the Tool pill needs from the app shell: the paint color and the ways to choose one. Read lazily. */
export interface ToolPillDeps {
  preferences: DevicePreferences
  /** The current paint color's hex, or null when none is chosen. */
  selectedColorHex: () => string | null
  palette: () => Palette
  onSelectColor: (colorId: string) => void
  onSelectCustomColor: (hex: string) => void
}

// The Tool pill's own state (ticket 439, ADR 0046): docked edge, the eight recents, and whether the colour popover
// is open. The first two are kept on this device like the theme (ADR 0020). A colour joins the recents at the front
// when the paint colour changes, with the one it replaced.
export function useToolPill(deps: ToolPillDeps) {
  const position = deps.preferences.get('toolPillPosition')
  const recents = deps.preferences.get('recentColors')
  const popoverOpen = ref(false)

  watch(
    () => deps.selectedColorHex(),
    (hex, previous) => {
      let next = recents.value
      if (previous) next = pushRecentColor(next, previous)
      if (hex) next = pushRecentColor(next, hex)
      recents.value = next
    },
  )

  const recentsInPill = computed(() => recentsBeside(recents.value, deps.selectedColorHex(), RECENTS_IN_PILL))

  provideRecentColors(recentsInPill)

  /** A recent colour is chosen the way it was first: as a Palette swatch, or else a Custom color. */
  function pickRecent(hex: string) {
    const color = normalizeHex(hex)
    if (!color) return
    const swatch = deps.palette().byHex(color)
    if (swatch) deps.onSelectColor(swatch.id)
    else deps.onSelectCustomColor(color)
  }

  /** Shift+1…3 pick the pill's chips (ticket 529); the keys after them pick the Palette's first slots, in order, a chip's
   * color too (ticket 0865). A key with nothing behind it does nothing. */
  function pickByKey(key: number) {
    if (key < RECENT_SHORTCUTS) {
      const hex = recentsInPill.value[key]
      if (hex) pickRecent(hex)
      return
    }
    const swatch = deps.palette().colors[key - RECENT_SHORTCUTS]
    if (swatch) deps.onSelectColor(swatch.id)
  }

  return {
    toolPillPosition: position,
    toolPillPopoverOpen: popoverOpen,
    recentsInPill,
    pickRecent,
    pickByKey,
  }
}

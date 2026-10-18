import { computed, ref, watch } from 'vue'
import { normalizeHex, type PaletteColor } from '../../domain/palette'
import { RECENTS_IN_PILL, RECENTS_IN_POPOVER, pushRecentColor, recentsBeside } from '../../domain/toolPill'
import type { DevicePreferences } from '../../services/devicePreferences'

/** What the Tool pill needs from the app shell: the paint color and the ways to choose one. Read lazily. */
export interface ToolPillDeps {
  preferences: DevicePreferences
  /** The current paint color's hex, or null when none is chosen. */
  selectedColorHex: () => string | null
  palette: () => readonly PaletteColor[]
  onSelectColor: (colorId: string) => void
  onSelectCustomColor: (hex: string) => void
}

// The Tool pill's own state (ticket 439, ADR 0059): docked edge, the eight recents, and whether the colour popover
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
  const recentsInPopover = computed(() => recentsBeside(recents.value, deps.selectedColorHex(), RECENTS_IN_POPOVER))

  /** A recent colour is chosen the way it was first: as a Palette swatch, or else a Custom color. */
  function pickRecent(hex: string) {
    const color = normalizeHex(hex)
    if (!color) return
    const swatch = deps.palette().find((candidate) => candidate.hex === color)
    if (swatch) deps.onSelectColor(swatch.id)
    else deps.onSelectCustomColor(color)
  }

  return {
    toolPillPosition: position,
    toolPillPopoverOpen: popoverOpen,
    recentsInPill,
    recentsInPopover,
    pickRecent,
  }
}

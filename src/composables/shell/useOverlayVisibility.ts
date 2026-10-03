import { ref } from 'vue'
import type { PhoneSheet } from './phoneSheet'

/**
 * The UI-shell overlays' open/close state (tickets 79, 168, 188, 204; ADR 0023): the Drawer, the phone tier's Tool
 * sheets, its theme sheet, and its New Pattern and Saved Patterns sheets. The Shortcuts-help boolean stays in the app
 * shell: a single boolean with no logic isn't worth extracting.
 */
export function useOverlayVisibility(deps: { selectPattern: (id: string, opened?: () => void) => void }) {
  /** Whether the Drawer (ticket 168; the iPad mini tier's left column) is open. Only the Tools button (744-1023px) ever sets it true. */
  const drawerOpen = ref(false)

  /** Which of the phone tier's six ToolSheets is open (ticket 79; Dock card), or none. Tapping the Dock button of the open sheet closes it, same as pressing it again. */
  const openPhoneSheet = ref<PhoneSheet | null>(null)

  function onSelectPhoneSheet(sheet: PhoneSheet) {
    openPhoneSheet.value = openPhoneSheet.value === sheet ? null : sheet
  }

  /** The phone header's theme sheet (ticket 188): a small four-way choice, the same one ThemeToggle offers in the header menu. */
  const themeSheetOpen = ref(false)

  /** New Pattern on the phone tier (PhoneForms card): its own full-height modal sheet, opened from the Pattern sheet. */
  const phoneNewPatternOpen = ref(false)

  /** Saved Patterns on the phone tier: a separate non-modal sheet, opened from the Pattern sheet's Saved Patterns icon. */
  const phoneSavedPatternsOpen = ref(false)

  /** Picking a Pattern from the phone's Saved Patterns sheet opens it and puts both the sheet and the Pattern sheet under it away. */
  function onSelectPatternFromPhoneDrawer(id: string) {
    deps.selectPattern(id, () => {
      phoneSavedPatternsOpen.value = false
      openPhoneSheet.value = null
    })
  }

  return {
    drawerOpen,
    openPhoneSheet,
    onSelectPhoneSheet,
    themeSheetOpen,
    phoneNewPatternOpen,
    phoneSavedPatternsOpen,
    onSelectPatternFromPhoneDrawer,
  }
}

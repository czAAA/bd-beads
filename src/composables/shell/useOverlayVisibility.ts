import { ref, watch, type Ref } from 'vue'
import type { PhoneSheet } from './phoneSheet'

// The UI-shell overlays' open/close state (tickets 79, 188, 204, 295; ADR 0020): the Canvas strip's Menu, Project and Saved
// Projects sheets. The Shortcuts-help boolean stays in the app shell: one boolean with no logic isn't
// worth extracting.
export function useOverlayVisibility(deps: { selectProject: (id: string, opened?: () => void) => void; openPanel?: Ref<PhoneSheet | null> }) {
  /** Which panel or bottom sheet is open (tickets 79, 295, 439, 510), or none: opening one closes the others. Tapping the strip button of the open sheet closes
   * it, same as pressing it again. */
  const openPanel = deps.openPanel ?? ref<PhoneSheet | null>(null)

  function onSelectPhoneSheet(sheet: PhoneSheet) {
    openPanel.value = openPanel.value === sheet ? null : sheet
  }

  /** Whether Menu opens on its New Project sub-view (the empty-canvas bar's button, spec 0478); Menu also does when
   * the library is empty. Clears once the panel is gone or swapped. */
  const menuOpensOnForm = ref(false)
  watch(openPanel, (sheet) => {
    if (sheet !== 'menu') menuOpensOnForm.value = false
  }, { flush: 'sync' })

  function openMenuOnForm() {
    menuOpensOnForm.value = true
    openPanel.value = 'menu'
  }

  /** Saved Projects on the phone tier: a separate non-modal sheet, opened from the Project sheet's Saved Projects
   * icon. */
  const phoneSavedProjectsOpen = ref(false)

  /** Picking a Project from the phone's Saved Projects sheet opens it and puts both the sheet and the Project sheet
   * under it away. */
  function onSelectProjectFromPhoneDrawer(id: string) {
    deps.selectProject(id, () => {
      phoneSavedProjectsOpen.value = false
      openPanel.value = null
    })
  }

  return {
    openPanel,
    onSelectPhoneSheet,
    menuOpensOnForm,
    openMenuOnForm,
    phoneSavedProjectsOpen,
    onSelectProjectFromPhoneDrawer,
  }
}

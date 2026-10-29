import { ref, watch, type Ref } from 'vue'
import type { ExportOpener, OpenPanel } from './openPanel'

// The UI-shell overlays' open/close state (tickets 79, 188, 204, 295; ADR 0020): the Canvas strip's Menu and Project panels. The Shortcuts-help boolean stays in the app shell: one boolean with no logic isn't
// worth extracting.
export function useOverlayVisibility(deps: { selectProject: (id: string, opened?: () => void) => void; openPanel?: Ref<OpenPanel | null> }) {
  /** Which panel is open (tickets 79, 295, 439, 510), or none: opening one closes the others. Tapping the strip button of the open sheet closes
   * it, same as pressing it again. */
  const openPanel = deps.openPanel ?? ref<OpenPanel | null>(null)

  /** The button the Export panel hangs from (ticket 0657): the Canvas strip's or the margin sheet's own. */
  const exportOpener = ref<ExportOpener>('strip-export')

  function onSelectPanel(sheet: OpenPanel) {
    if (sheet === 'export') return onOpenExport('strip-export')
    openPanel.value = openPanel.value === sheet ? null : sheet
  }

  /** Export from the strip or from the margin sheet: the same panel, hung from the button pressed. Pressing the
   * button it hangs from again closes it; the other one moves it there. */
  function onOpenExport(from: ExportOpener) {
    const shown = openPanel.value === 'export' && exportOpener.value === from
    exportOpener.value = from
    openPanel.value = shown ? null : 'export'
  }

  /** Whether Menu opens on its New Project subpanel (the empty-canvas bar's button, spec 0478); Menu also does when
   * the library is empty. Clears once the panel is gone or swapped. */
  const menuOpensOnForm = ref(false)
  watch(openPanel, (sheet) => {
    if (sheet !== 'menu') menuOpensOnForm.value = false
  }, { flush: 'sync' })

  function openMenuOnForm() {
    menuOpensOnForm.value = true
    openPanel.value = 'menu'
  }

  /** Whether Menu's subpanel is Saved Projects rather than New Project. Clears once the panel is gone or swapped. */
  const phoneSavedProjectsOpen = ref(false)
  watch(openPanel, () => {
    phoneSavedProjectsOpen.value = false
  }, { flush: 'sync' })

  /** Picking a Project from Menu's Saved Projects opens it and puts the panel away. */
  function onSelectProjectFromPhoneDrawer(id: string) {
    deps.selectProject(id, () => {
      phoneSavedProjectsOpen.value = false
      openPanel.value = null
    })
  }

  return {
    openPanel,
    onSelectPanel,
    exportOpener,
    onOpenExport,
    menuOpensOnForm,
    openMenuOnForm,
    phoneSavedProjectsOpen,
    onSelectProjectFromPhoneDrawer,
  }
}

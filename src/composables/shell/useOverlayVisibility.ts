import { ref, watch, type Ref } from 'vue'
import type { ExportChoice, ExportOpener, OpenPanel } from './openPanel'

// The UI-shell overlays' open/close state (tickets 79, 188, 204, 295; ADR 0020): the Canvas strip's Menu and Project
// panels, and which Subpanel Menu shows (New Project, Saved Projects, Sign in, Keyboard shortcuts).
export function useOverlayVisibility(deps: { selectProject: (id: string, opened?: () => void) => void; openPanel?: Ref<OpenPanel | null> }) {
  /** Which panel is open (tickets 79, 295, 439, 510), or none: opening one closes the others. Tapping the strip button of the open sheet closes
   * it, same as pressing it again. */
  const openPanel = deps.openPanel ?? ref<OpenPanel | null>(null)

  /** The button the Export panel hangs from (ticket 0657): the Canvas strip's or the margin sheet's own. */
  const exportOpener = ref<ExportOpener>('strip-export')
  /** The row the Export panel opens on: Picture from the Progress bar's Fit a Frame and export a picture (ticket 0847);
   * none from a button or the Project panel's Export row (ticket 0956). */
  const exportChoice = ref<ExportChoice>()

  /** A strip button's panel; the Project panel's Export row opens Export as the strip's button does (ticket 0956). */
  function onSelectPanel(sheet: OpenPanel) {
    if (sheet === 'export') return onOpenExport('strip-export')
    openPanel.value = openPanel.value === sheet ? null : sheet
  }

  /** Export from the strip or from the margin sheet: the same panel, hung from the button pressed. Pressing the
   * button it hangs from again closes it; the other one moves it there. */
  function onOpenExport(from: ExportOpener) {
    if (openPanel.value === 'export' && exportOpener.value === from) openPanel.value = null
    else showExport(from)
  }

  /** Export opened, never closed, by what leads to it from no Frame (ticket 0847): the Progress bar's Fit a Frame and
   * export a picture, and a Frame selected from the Export panel. */
  function showExport(from: ExportOpener, choice?: ExportChoice) {
    exportOpener.value = from
    exportChoice.value = choice
    openPanel.value = 'export'
  }

  /** Whether Menu opens on a subpanel: New Project (the empty-canvas bar's button, spec 0478), or Saved Projects when
   * `phoneSavedProjectsOpen` is set with it (ticket 0716); Menu also does when the library is empty. Clears once the
   * panel is gone or swapped. */
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

  /** Opens Menu straight on Saved Projects (ticket 0716): its address, or a load that opened no Project. */
  function openMenuOnSavedProjects() {
    menuOpensOnForm.value = true
    openPanel.value = 'menu'
    phoneSavedProjectsOpen.value = true
  }

  /** Whether Menu's subpanel is Sign in (ticket 0078), and whether Menu opens on its own list whatever the library
   * holds (back from Google signed in, on the Account section). Both clear once the panel is gone or swapped. */
  const signInOpen = ref(false)
  const menuOpensOnList = ref(false)
  watch(openPanel, () => {
    signInOpen.value = false
    menuOpensOnList.value = false
  }, { flush: 'sync' })

  /** Opens Menu straight on the Sign in Subpanel: back from Google refused. */
  function openMenuOnSignIn() {
    menuOpensOnForm.value = true
    openPanel.value = 'menu'
    signInOpen.value = true
  }

  /** Opens Menu on its list, where Account is the first section: back from Google signed in. */
  function openMenuOnAccount() {
    openPanel.value = 'menu'
    menuOpensOnList.value = true
  }

  /** Whether Menu's subpanel is Keyboard shortcuts (ticket 1159, ShortcutsHelp card). Clears once the panel is gone or
   * swapped. */
  const shortcutsOpen = ref(false)
  watch(openPanel, () => {
    shortcutsOpen.value = false
  }, { flush: 'sync' })

  /** `?`: opens Menu straight on Keyboard shortcuts, or closes the Menu it opened there (ShortcutsHelp card). */
  function toggleMenuOnShortcuts() {
    if (openPanel.value === 'menu' && shortcutsOpen.value) return void (openPanel.value = null)
    openPanel.value = 'menu'
    shortcutsOpen.value = true
  }

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
    showExport,
    exportChoice,
    menuOpensOnForm,
    openMenuOnForm,
    openMenuOnSavedProjects,
    phoneSavedProjectsOpen,
    onSelectProjectFromPhoneDrawer,
    signInOpen,
    menuOpensOnList,
    openMenuOnSignIn,
    openMenuOnAccount,
    shortcutsOpen,
    toggleMenuOnShortcuts,
  }
}

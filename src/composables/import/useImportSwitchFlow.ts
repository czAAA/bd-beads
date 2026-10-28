import { computed, ref } from 'vue'
import { mostRecentlyUpdated, type Project } from '../../domain/project'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What importing needs from the app shell: the library's add and open, and its manual save. */
export interface ImportSwitchFlowDeps {
  currentProject: () => Project | undefined
  addProjects: (projects: Project[]) => void
  /** Opens a Project by id, the same switch the library list makes. */
  openProject: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** Project import and the keep / save-and-switch / switch decision when a Project is open (tickets 154, 200; ADR
 * 0020). Touches no history. Deps are lazy. */
export function useImportSwitchFlow(deps: ImportSwitchFlowDeps) {
  /** Imported Projects held back until the person says whether to switch (ticket 154); undefined when nothing to
   * ask. They join the library either way. */
  const pendingImport = (deps.dialogs ?? useDialogs()).question<Project[]>('import-switch')

  /** Whether Save current, offered when the last save failed, was tried and the device refused it too. */
  const importSaveRefused = ref(false)

  /** The Project the import would open: the most recently updated of what came in, the same pick the library makes
   * for an empty library. */
  const pendingImportOpens = computed(() => (pendingImport.value ? mostRecentlyUpdated(pendingImport.value) : undefined))

  /** Imported Projects (ticket 154): with none open they join the library, which opens one; otherwise they wait for
   * the answer so nothing changes first. */
  function onImportProjects(imported: Project[]) {
    if (!deps.currentProject() || imported.length === 0) {
      deps.addProjects(imported)
      return
    }
    importSaveRefused.value = false
    pendingImport.value = imported
  }

  /** Keep current (and Escape): the import joins the library and the open Project stays open, as importing always
   * did. */
  function onKeepCurrentAfterImport() {
    const imported = pendingImport.value
    pendingImport.value = undefined
    if (imported) {
      deps.addProjects(imported)
    }
  }

  /** Switch: the import joins the library and its most recent Project opens (Undo history and Selection reset, the
   * clipboard survives, as on any Project switch). */
  function onSwitchToImported() {
    const imported = pendingImport.value
    const opens = pendingImportOpens.value
    pendingImport.value = undefined
    if (imported) {
      deps.addProjects(imported)
      if (opens) {
        deps.openProject(opens.id)
      }
    }
  }

  /** Save current: writes the library as it stands now; the modal turns to the plain question once that gets through
   * (saveFailed clears), or says so if it didn't. */
  function onSaveBeforeImportSwitch() {
    importSaveRefused.value = !deps.saveNow()
  }

  return {
    pendingImport,
    pendingImportOpens,
    importSaveRefused,
    onImportProjects,
    onKeepCurrentAfterImport,
    onSwitchToImported,
    onSaveBeforeImportSwitch,
  }
}

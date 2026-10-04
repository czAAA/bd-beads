import { computed, ref } from 'vue'
import { mostRecentlyUpdated, type Project } from '../../domain/project'
import type { MessageTone } from '../ui/useToasts'

/** What importing needs from the app shell: the library's add and open, its manual save, and the toast region. */
export interface ImportSwitchFlowDeps {
  currentProject: () => Project | undefined
  addProjects: (projects: Project[]) => void
  /** Opens a Project by id, the same switch the library list makes. */
  openProject: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
  showToast: (id: string, text: string, tone: MessageTone) => void
}

/**
 * Project import and the keep-current / save-and-switch / switch decision when a Project is already open (ticket 154,
 * 200; ADR 0023). Not an undo concern: none of it touches history. Deps are read lazily.
 */
export function useImportSwitchFlow(deps: ImportSwitchFlowDeps) {
  /**
   * The Projects an import brought in while another Project is open, held back until the person says whether to switch
   * to one of them (ticket 154); undefined when there is nothing to ask. They join the library on either answer.
   */
  const pendingImport = ref<Project[] | undefined>()

  /** Whether Save current, offered when the last save failed, was tried and the device refused it too. */
  const importSaveRefused = ref(false)

  /** The Project the import would open: the most recently updated of what came in, the same pick the library makes for an empty library. */
  const pendingImportOpens = computed(() => (pendingImport.value ? mostRecentlyUpdated(pendingImport.value) : undefined))

  /**
   * Imported Projects (ticket 154): with none open they simply join the library, which opens one. With one open they
   * wait for the person's answer, so nothing on screen changes before it.
   */
  function onImportProjects(imported: Project[]) {
    if (!deps.currentProject() || imported.length === 0) {
      deps.addProjects(imported)
      return
    }
    importSaveRefused.value = false
    pendingImport.value = imported
  }

  /** Keep current (and Escape): the import joins the library and the open Project stays open, as importing always did. */
  function onKeepCurrentAfterImport() {
    const imported = pendingImport.value
    pendingImport.value = undefined
    if (imported) {
      deps.addProjects(imported)
    }
  }

  /** Switch: the import joins the library and its most recent Project opens (Undo history and Selection reset, the clipboard survives, as on any Project switch). */
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

  /** Save current: writes the library as it stands now; the modal turns to the plain question once that gets through (saveFailed clears), or says so if it didn't. */
  function onSaveBeforeImportSwitch() {
    importSaveRefused.value = !deps.saveNow()
  }

  /** A toast for the More menu's own ProjectImport (ticket 168): there is no room beside its buttons in there, so a result arrives above the bottom toolbar instead (ImportResult card). */
  function onImportToast(id: string, text: string, tone: MessageTone) {
    deps.showToast(id, text, tone)
  }

  return {
    pendingImport,
    pendingImportOpens,
    importSaveRefused,
    onImportProjects,
    onKeepCurrentAfterImport,
    onSwitchToImported,
    onSaveBeforeImportSwitch,
    onImportToast,
  }
}

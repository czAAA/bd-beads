import { computed, ref } from 'vue'
import { mostRecentlyUpdated } from '../../domain/projectLibrary'
import { projectNameOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What importing needs from the app shell: the library's add and open, and its manual save. */
export interface ImportSwitchFlowDeps {
  currentProject: () => Project | undefined
  /** Adds the Projects to the library under names it doesn't hold yet and hands back what joined (ticket 0860). */
  addProjects: (projects: Project[]) => Project[]
  /** Opens a Project by id, the same switch the library list makes. */
  openProject: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** An import that joined the library while a Project was open, until the person says whether to open it. */
export interface JoinedImport {
  /** The Projects as they joined. */
  projects: Project[]
  /** The name a Project came with, by its id, where the library already held that name (ticket 0860). */
  takenNames: ReadonlyMap<string, string>
}

/** Project import and the question whether to open it when a Project is open (tickets 154, 200, 0860; ADR 0020): the
 * import joins the library at once, so the question only asks where to be. Touches no history. Deps are lazy. */
export function useImportSwitchFlow(deps: ImportSwitchFlowDeps) {
  /** What joined, while the question is open; the registry holds it shallowly, like the library (ticket 0616). */
  const pendingImport = (deps.dialogs ?? useDialogs()).question<JoinedImport>('import-switch')

  /** Whether Save current, offered when the last save failed, was tried and the device refused it too. */
  const importSaveRefused = ref(false)

  /** The Project the question offers: the most recently updated of what came in, the same pick the library makes for
   * an empty library. */
  const pendingImportOpens = computed(() => (pendingImport.value ? mostRecentlyUpdated(pendingImport.value.projects) : undefined))

  /** Imported Projects join the library (which opens one when none is open); with a Project open, the question asks
   * whether to open what came in. */
  function onImportProjects(imported: Project[]) {
    const wasOpen = deps.currentProject() !== undefined
    const joined = deps.addProjects(imported)
    if (!wasOpen || joined.length === 0) return
    const cameAs = new Map(imported.map((project) => [project.id, projectNameOf(project)]))
    const takenNames = new Map<string, string>()
    for (const project of joined) {
      const name = cameAs.get(project.id)
      if (name !== undefined && name !== projectNameOf(project)) takenNames.set(project.id, name)
    }
    importSaveRefused.value = false
    pendingImport.value = { projects: joined, takenNames }
  }

  /** Stay here (and Escape): the open Project stays open; the import is already in the library. */
  function onKeepCurrentAfterImport() {
    pendingImport.value = undefined
  }

  /** Open: the import's most recent Project opens (Undo history and Selection reset, the clipboard survives, as on any
   * Project switch). */
  function onSwitchToImported() {
    const opens = pendingImportOpens.value
    pendingImport.value = undefined
    if (opens) deps.openProject(opens.id)
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

import type { Project } from '../../domain/project'
import type { SealedProject } from '../../domain/sealedProject'
import { normalizeProjectName, withProjectName } from '../../domain/projectName'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What managing the open Project needs from the app shell: the library and its commit points. */
export interface ProjectManageDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** The Projects kept in their stored form (ticket 0716): Delete all removes them too. */
  sealed?: () => SealedProject[]
  /** Saves the renamed Project at once; none of this is an undo step (spec 0440). */
  replaceProject: (project: Project) => void
  removeAllProjects: () => void
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

// Rename for the open Project and Delete all Projects (spec 0440, ticket 443): saved with the library,
// independent of Undo. Deleting one Project is useDeleteProjectFlow's (ticket 0842). Deps are lazy.
export function useProjectManageFlow(deps: ProjectManageDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  const deletingAll = dialogs.flag('delete-all-projects')

  /** Renames the open Project; false (nothing changes) when the name is empty. */
  function onRenameProject(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    deps.replaceProject(withProjectName(project, name))
    return true
  }

  function onRequestDeleteAllProjects() {
    if (deps.projects().length + (deps.sealed?.().length ?? 0) > 0) deletingAll.value = true
  }

  function onCancelDeleteAllProjects() {
    deletingAll.value = false
  }

  /** Removes every Project from this device and leaves the empty state. */
  function onConfirmDeleteAllProjects() {
    deletingAll.value = false
    deps.removeAllProjects()
  }

  return { deletingAll, onRequestDeleteAllProjects, onCancelDeleteAllProjects, onConfirmDeleteAllProjects, onRenameProject }
}

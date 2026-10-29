import type { Project } from '../../domain/project'
import { duplicateProject, normalizeProjectName, suggestCopyName, withProjectName } from '../../domain/projectName'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { projectNameOf } from '../../domain/layerRecord'

/** What managing the open Project needs from the app shell: the library and its commit points. */
export interface ProjectManageDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** Saves the renamed Project at once; none of this is an undo step (spec 0440). */
  replaceProject: (project: Project) => void
  /** Adds the copy and opens it. */
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  removeAllProjects: () => void
  /** Leaves no Project open, so the empty state shows. */
  closeProject: () => void
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

// Rename, Duplicate, Delete for the open Project and Delete all Projects (spec 0440, ticket 443): saved with the
// library, independent of Undo; Duplicate and Delete ask first in the dialogs AppDialogs draws from
// `duplicating`/`deleting`. Deps are lazy.
export function useProjectManageFlow(deps: ProjectManageDeps) {
  /** The suggested name while the Duplicate dialog is open. */
  const dialogs = deps.dialogs ?? useDialogs()
  const duplicating = dialogs.question<string>('duplicate-project')
  const deleting = dialogs.flag('delete-project')
  const deletingAll = dialogs.flag('delete-all-projects')

  /** Renames the open Project; false (nothing changes) when the name is empty. */
  function onRenameProject(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    deps.replaceProject(withProjectName(project, name))
    return true
  }

  function onRequestDuplicate() {
    const project = deps.currentProject()
    if (project) duplicating.value = suggestCopyName(projectNameOf(project), deps.projects().map((existing) => projectNameOf(existing)))
  }

  function onCancelDuplicate() {
    duplicating.value = undefined
  }

  /** Adds the copy under the chosen name, with Row progress and everything else, and opens it; false when the name
   * is empty. */
  function onConfirmDuplicate(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    duplicating.value = undefined
    deps.addProject(duplicateProject(project, name))
    return true
  }

  function onRequestDelete() {
    if (deps.currentProject()) deleting.value = true
  }

  function onCancelDelete() {
    deleting.value = false
  }

  /** Removes the open Project from this device and leaves the empty state, not the next Project. */
  function onConfirmDelete() {
    const project = deps.currentProject()
    deleting.value = false
    if (!project) return
    deps.removeProject(project.id)
    deps.closeProject()
  }

  function onRequestDeleteAllProjects() {
    if (deps.projects().length > 0) deletingAll.value = true
  }

  function onCancelDeleteAllProjects() {
    deletingAll.value = false
  }

  /** Removes every Project from this device and leaves the empty state. */
  function onConfirmDeleteAllProjects() {
    deletingAll.value = false
    deps.removeAllProjects()
  }

  return { duplicating, deleting, deletingAll, onRequestDeleteAllProjects, onCancelDeleteAllProjects, onConfirmDeleteAllProjects, onRenameProject, onRequestDuplicate, onCancelDuplicate, onConfirmDuplicate, onRequestDelete, onCancelDelete, onConfirmDelete }
}

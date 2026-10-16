import { ref, toRaw } from 'vue'
import type { Project } from '../../domain/project'
import { duplicateProject, normalizeProjectName, suggestCopyName, withProjectName } from '../../domain/projectName'

/** What managing the open Project needs from the app shell: the library and its commit points. */
export interface ProjectManageDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** Saves the renamed Project at once; none of this is an undo step (spec 0440). */
  replaceProject: (project: Project) => void
  /** Adds the copy and opens it. */
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  /** Leaves no Project open, so the empty state shows. */
  closeProject: () => void
}

/**
 * Rename, Duplicate and Delete for the open Project (spec 0440, ticket 443): each acts at once, saved with the library
 * and independent of Undo. Duplicate and Delete ask first, in the dialogs AppDialogs draws from `duplicating` and
 * `deleting`. Deps are read lazily.
 */
export function useProjectManageFlow(deps: ProjectManageDeps) {
  /** The suggested name while the Duplicate dialog is open. */
  const duplicating = ref<string | undefined>()
  const deleting = ref(false)

  /** Renames the open Project; false (nothing changes) when the name is empty. */
  function onRenameProject(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    deps.replaceProject(withProjectName(project, name))
    return true
  }

  function onRequestDuplicate() {
    const project = deps.currentProject()
    if (project) duplicating.value = suggestCopyName(project.name, deps.projects().map((existing) => existing.name))
  }

  function onCancelDuplicate() {
    duplicating.value = undefined
  }

  /** Adds the copy under the chosen name, with Row progress and everything else, and opens it; false when the name is empty. */
  function onConfirmDuplicate(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    duplicating.value = undefined
    // The library holds reactive Projects, which structuredClone refuses; the copy is made from the plain data underneath.
    deps.addProject(duplicateProject(toRaw(project), name))
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

  return { duplicating, deleting, onRenameProject, onRequestDuplicate, onCancelDuplicate, onConfirmDuplicate, onRequestDelete, onCancelDelete, onConfirmDelete }
}

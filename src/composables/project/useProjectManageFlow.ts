import type { Project } from '../../domain/project'
import { duplicateProject, normalizeProjectName, suggestCopyName, withProjectName } from '../../domain/projectName'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { projectNameOf } from '../../domain/layerRecord'
import { fillBlanks } from '../../domain/fillBlanks'
import type { Translations } from '../../i18n/translations'
import type { MessageTone } from '../ui/useToasts'

/** What managing the open Project needs from the app shell: the library and its commit points. */
export interface ProjectManageDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** Saves the renamed Project at once; none of this is an undo step (spec 0440). */
  replaceProject: (project: Project) => void
  /** Adds the copy and opens it. */
  addProject: (project: Project) => void
  removeAllProjects: () => void
  /** Says after Duplicate which Project is open now (ticket 0860). */
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

// Rename and Duplicate for the open Project and Delete all Projects (spec 0440, ticket 443): saved with the library,
// independent of Undo; Duplicate asks first. Deleting one Project is useDeleteProjectFlow's (ticket 0842). Deps are lazy.
export function useProjectManageFlow(deps: ProjectManageDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  /** The suggested name while the Duplicate dialog is open. */
  const duplicating = dialogs.question<string>('duplicate-project')
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

  /** Adds the copy under the chosen name, with Row progress and everything else, opens it and says so, as nothing
   * else on screen changes (ticket 0860); false when the name is empty. */
  function onConfirmDuplicate(name: string): boolean {
    const project = deps.currentProject()
    if (!project || !normalizeProjectName(name)) return false
    duplicating.value = undefined
    const copy = duplicateProject(project, name)
    deps.addProject(copy)
    const said = fillBlanks(deps.messages().panels.project.duplicatedToast, { copy: projectNameOf(copy), original: projectNameOf(project) })
    deps.showToast('duplicated', said, 'success')
    return true
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

  return { duplicating, deletingAll, onRequestDeleteAllProjects, onCancelDeleteAllProjects, onConfirmDeleteAllProjects, onRenameProject, onRequestDuplicate, onCancelDuplicate, onConfirmDuplicate }
}

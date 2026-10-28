import { shallowRef } from 'vue'
import { DEFAULT_BEAD } from '../../domain/beads'
import type { CreateProjectInput } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What the Convert image wizard opens on: the New Project form's values it copies, and a picture when one was
 * dropped or pasted on the app. */
export interface ConvertImageStart {
  draft: CreateProjectInput
  file?: File
}

/** What the flow needs from the app shell: the dialog registry and the library's add. */
export interface ConvertImageFlowDeps {
  dialogs?: Dialogs
  addProject: (project: Project) => void
}

/** Convert image (spec 0645, ADR 0010): the wizard as a dialog of the registry, opened from New Project or by a picture
 * dropped or pasted on the app. Its setup is its own; Create adds the Project it made, Cancel adds nothing. */
export function useConvertImageFlow(deps: ConvertImageFlowDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  const start = dialogs.question<ConvertImageStart>('convert-image')
  /** The form's last values, for a picture dropped while the form is not shown. */
  const lastDraft = shallowRef<CreateProjectInput>({ name: '', technique: DEFAULT_TECHNIQUE, beadId: DEFAULT_BEAD.id, makerName: '' })

  function open(draft: CreateProjectInput) {
    start.value = { draft }
  }

  /** A picture dropped or pasted on the app with no dialog showing: the wizard opens with it set. */
  function onPicture(file: File): boolean {
    if (dialogs.open.value) return false
    start.value = { draft: lastDraft.value, file }
    return true
  }

  function onCreate(project: Project) {
    deps.addProject(project)
    start.value = undefined
  }

  function onCancel() {
    start.value = undefined
  }

  return { start, open, onPicture, onCreate, onCancel, onNewProjectDraft: (draft: CreateProjectInput) => (lastDraft.value = draft) }
}

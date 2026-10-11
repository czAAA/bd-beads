import { computed } from 'vue'
import type { Project } from '../../domain/project'
import { removeLineRefusal, removeSelectedLine } from '../../domain/removeLine'
import type { Selection } from '../../domain/selection'
import type { EditFn } from './useEdit'

/** What Remove line needs from the app shell: the open Project, Edit and the Selection. */
export interface RemoveLineFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  selection: () => Selection | undefined
}

/**
 * "Remove line" (tickets 123, 199; ADR 0020, ADR 0026): takes the selected whole row or column out of the Frame as one
 * Edit, which resets the Selection and Mirror's axis counts, built against the old lines. Refused while Row progress
 * is on. Deps are read lazily.
 */
export function useRemoveLineFlow(deps: RemoveLineFlowDeps) {
  /** Whether Remove line applies right now: the Tools group's own enabled state. */
  const canRemoveSelectedLine = computed(() => {
    const project = deps.currentProject()
    return !!project && !removeLineRefusal(project, deps.selection())
  })

  function onRemoveSelectedLine() {
    const selection = deps.selection()
    deps.edit('frame', (project) => removeSelectedLine(project, selection))
  }

  return { canRemoveSelectedLine, onRemoveSelectedLine }
}

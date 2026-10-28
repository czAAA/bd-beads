import { vi } from 'vitest'
import { shallowRef } from 'vue'
import type { Project } from '../domain/project'
import { useEdit } from '../composables/project/useEdit'
import { useUndoHistory } from '../composables/project/useUndoHistory'

/** A real Edit and Undo history over one in-memory Project, so a flow's test asserts what a person would see.
 * Only the app's own seams are spies. */
export function editHarness(initial: Project | undefined) {
  // A ref, so the computeds of the flow under test follow each Edit like the app's reactive Project.
  const project = shallowRef(initial)
  const replaceProject = vi.fn((next: Project) => {
    project.value = next
  })
  const resetAfterFrameChange = vi.fn()
  const flushPendingSave = vi.fn()
  const currentProject = () => project.value

  const history: ReturnType<typeof useUndoHistory> = useUndoHistory({
    currentProject,
    restore: (snapshot) => editing.restore(snapshot),
    settle: () => editing.settle(),
  })
  const editing = useEdit({
    currentProject,
    replaceProject,
    recordHistory: history.record,
    resetAfterFrameChange,
    flushPendingSave,
  })

  return {
    editing,
    edit: editing.edit,
    history,
    currentProject,
    replaceProject,
    resetAfterFrameChange,
    flushPendingSave,
    get project() {
      return project.value!
    },
  }
}

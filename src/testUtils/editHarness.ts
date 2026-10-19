import { vi } from 'vitest'
import type { Project } from '../domain/project'
import { useEdit } from '../composables/project/useEdit'
import { useUndoHistory } from '../composables/project/useUndoHistory'

/** A real Edit and Undo history over one in-memory Project, so a flow's test asserts what a person would see.
 * Only the app's own seams are spies. */
export function editHarness(initial: Project | undefined) {
  let project = initial
  const replaceProject = vi.fn((next: Project) => {
    project = next
  })
  const resetAfterFrameChange = vi.fn()
  const flushPendingSave = vi.fn()
  const currentProject = () => project

  const history: ReturnType<typeof useUndoHistory> = useUndoHistory({
    currentProject,
    restore: (snapshot) => editing.restore(snapshot),
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
      return project!
    },
  }
}

import { vi } from 'vitest'
import { shallowRef } from 'vue'
import type { Project } from '../domain/project'
import { useEdit } from '../composables/project/useEdit'
import { useUndoHistory } from '../composables/project/useUndoHistory'
import { changedBeadCount } from '../domain/beadsSinceFile'
import type { Layered } from '../domain/layerRecord'

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
  const onRowsHeld = vi.fn()
  const currentProject = () => project.value
  /** Beads since last file as the shell counts it (ticket 0796), from what Edit, Undo and Redo report. */
  const counted = { beads: 0 }
  const countChange = (before: Layered, after: Layered, sign: 1 | -1) => {
    counted.beads += sign * changedBeadCount(before, after)
  }

  const history: ReturnType<typeof useUndoHistory> = useUndoHistory({
    currentProject,
    restore: (snapshot) => editing.restore(snapshot),
    settle: () => editing.settle(),
    countChange,
  })
  const editing = useEdit({
    currentProject,
    replaceProject,
    recordHistory: history.record,
    resetAfterFrameChange,
    flushPendingSave,
    countChange,
    onRowsHeld,
  })

  return {
    editing,
    edit: editing.edit,
    history,
    currentProject,
    replaceProject,
    resetAfterFrameChange,
    flushPendingSave,
    onRowsHeld,
    counted,
    get project() {
      return project.value!
    },
  }
}

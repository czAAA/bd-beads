import { vi } from 'vitest'
import { NO_MIRROR_AXES, type MirrorAxisCounts } from '../domain/mirror'
import type { Project } from '../domain/project'
import { useEdit } from '../composables/project/useEdit'
import { useUndoHistory } from '../composables/project/useUndoHistory'

/**
 * A real Edit and Undo history over one in-memory Project, so a flow's test drives the same rules the app does and
 * asserts what a person would see: the Project after, and what Undo brings back. Only the app's own seams are spies.
 */
export function editHarness(initial: Project | undefined, options: { mirrorAxisCounts?: MirrorAxisCounts } = {}) {
  let project = initial
  const mirrorAxisCounts = { current: options.mirrorAxisCounts ?? NO_MIRROR_AXES }
  const replaceProject = vi.fn((next: Project) => {
    project = next
  })
  const restoreMirrorAxisCounts = vi.fn((counts: MirrorAxisCounts) => {
    mirrorAxisCounts.current = counts
  })
  const resetAfterFrameChange = vi.fn(() => {
    mirrorAxisCounts.current = NO_MIRROR_AXES
  })
  const flushPendingSave = vi.fn()
  const currentProject = () => project

  const history: ReturnType<typeof useUndoHistory> = useUndoHistory({
    currentProject,
    mirrorAxisCounts: () => mirrorAxisCounts.current,
    restore: (snapshot) => editing.restore(snapshot),
  })
  const editing = useEdit({
    currentProject,
    replaceProject,
    recordHistory: history.record,
    mirrorAxisCounts: () => mirrorAxisCounts.current,
    restoreMirrorAxisCounts,
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
    restoreMirrorAxisCounts,
    flushPendingSave,
    mirrorAxisCounts,
    get project() {
      return project!
    },
  }
}

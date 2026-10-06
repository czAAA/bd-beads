import { describe, expect, it } from 'vitest'
import { createProject, setRowProgressEnabled, type Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { editHarness } from '../../testUtils/editHarness'
import { useRemoveLineFlow } from './useRemoveLineFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const secondRow: Selection = { top: 1, left: 0, rows: 1, columns: 4 }

function setup(options: { project?: Project | null; selection?: Selection } = {}) {
  const project = options.project === null ? undefined : (options.project ?? base)
  const harness = editHarness(project)
  const flow = useRemoveLineFlow({ currentProject: harness.currentProject, edit: harness.edit, selection: () => options.selection })
  return { harness, ...flow }
}

describe('useRemoveLineFlow', () => {
  it('is available only when the Selection marks out a whole line of the Frame', () => {
    expect(setup({ selection: secondRow }).canRemoveSelectedLine.value).toBe(true)
    expect(setup().canRemoveSelectedLine.value).toBe(false)
    expect(setup({ project: null, selection: secondRow }).canRemoveSelectedLine.value).toBe(false)
  })

  it('is not available under the Row progress lock', () => {
    expect(setup({ project: setRowProgressEnabled(base, true), selection: secondRow }).canRemoveSelectedLine.value).toBe(false)
  })

  it('removes the line, resets the session, and Undo brings the Frame back', () => {
    const { harness, onRemoveSelectedLine } = setup({ selection: secondRow })
    onRemoveSelectedLine()

    expect(harness.project.frame).toMatchObject({ columns: 4, rows: 2 })
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(base.frame)
  })

  it('does nothing without a line selected', () => {
    const { harness, onRemoveSelectedLine } = setup()
    onRemoveSelectedLine()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { createProject, moveToRow, setRowProgressEnabled, type Project, frameGrid, withFrameGrid } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { useDeleteAllFlow } from './useDeleteAllFlow'

const blank = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const painted: Project = withFrameGrid(
  blank,
  frameGrid(blank).map((row, r) => row.map((cell, c) => (r === 0 && c === 0 ? { ...cell, color: '#ff0000' } : cell))),
)

function setup(project: Project | null = painted) {
  const harness = editHarness(project ?? undefined)
  return { harness, ...useDeleteAllFlow({ currentProject: harness.currentProject, edit: harness.edit }) }
}

const isEmpty = (project: Project) => frameGrid(project).flat().every((cell) => !cell.color)

describe('useDeleteAllFlow', () => {
  it('opens the confirmation only with a Project open', () => {
    const open = setup()
    open.onRequestDeleteAll()
    expect(open.deleteAllConfirmOpen.value).toBe(true)

    const none = setup(null)
    none.onRequestDeleteAll()
    expect(none.deleteAllConfirmOpen.value).toBe(false)
  })

  it('closes on cancel without touching the Project', () => {
    const { harness, deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll } = setup()
    onRequestDeleteAll()
    onCancelDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(harness.project).toBe(painted)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming clears the grid, and Undo brings the grid back', () => {
    const { harness, deleteAllConfirmOpen, onRequestDeleteAll, onConfirmDeleteAll } = setup()
    onRequestDeleteAll()
    onConfirmDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(isEmpty(harness.project)).toBe(true)

    harness.history.onUndo()
    expect(frameGrid(harness.project)).toEqual(frameGrid(painted))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('ignores the Row progress lock: progress resets along with the grid, and Undo restores both', () => {
    const inProgress = moveToRow(setRowProgressEnabled(painted, true), 2)
    const { harness, onConfirmDeleteAll } = setup(inProgress)
    onConfirmDeleteAll()
    expect(isEmpty(harness.project)).toBe(true)
    expect(harness.project.rowProgress).not.toEqual(inProgress.rowProgress)

    harness.history.onUndo()
    expect(harness.project.rowProgress).toEqual(inProgress.rowProgress)
  })

  it('is not an undo step when there is nothing to clear', () => {
    const { harness, onConfirmDeleteAll } = setup(blank)
    onConfirmDeleteAll()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})

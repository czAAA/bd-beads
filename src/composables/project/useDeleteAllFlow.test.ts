import { describe, expect, it, vi } from 'vitest'
import { createProject, moveToRow, setRowProgressEnabled, type Project, frameGrid, withFrameGrid } from '../../domain/project'
import { useDeleteAllFlow } from './useDeleteAllFlow'

const blank = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const painted: Project = withFrameGrid(
  blank,
  frameGrid(blank).map((row, r) => row.map((cell, c) => (r === 0 && c === 0 ? { ...cell, color: '#ff0000' } : cell))),
)

function setup(project: Project | null = painted) {
  const deps = {
    currentProject: () => project ?? undefined,
    replaceProject: vi.fn(),
    recordHistory: vi.fn(),
  }
  return { deps, ...useDeleteAllFlow(deps) }
}

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
    const { deps, deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll } = setup()
    onRequestDeleteAll()
    onCancelDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(deps.recordHistory).not.toHaveBeenCalled()
  })

  it('confirming clears the grid as one undo step carrying the grid and Row progress', () => {
    const { deps, deleteAllConfirmOpen, onRequestDeleteAll, onConfirmDeleteAll } = setup()
    onRequestDeleteAll()
    onConfirmDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({ beads: painted.beads, rowProgress: painted.rowProgress })
    expect(deps.replaceProject).toHaveBeenCalledTimes(1)
    const replaced = deps.replaceProject.mock.calls[0]![0] as Project
    expect(frameGrid(replaced).flat().every((cell) => !cell.color)).toBe(true)
  })

  it('ignores the Row progress lock: progress resets along with the grid', () => {
    const inProgress = moveToRow(setRowProgressEnabled(painted, true), 2)
    const { deps, onConfirmDeleteAll } = setup(inProgress)
    onConfirmDeleteAll()
    const replaced = deps.replaceProject.mock.calls[0]![0] as Project
    expect(frameGrid(replaced).flat().every((cell) => !cell.color)).toBe(true)
    expect(replaced.rowProgress).not.toEqual(inProgress.rowProgress)
  })

  it('is not an undo step when there is nothing to clear', () => {
    const { deps, onConfirmDeleteAll } = setup(blank)
    onConfirmDeleteAll()
    expect(deps.recordHistory).not.toHaveBeenCalled()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createPattern, moveToRow, setRowProgressEnabled, type Pattern } from '../../domain/pattern'
import { useDeleteAllFlow } from './useDeleteAllFlow'

const blank = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const painted: Pattern = {
  ...blank,
  grid: blank.grid.map((row, r) => row.map((cell, c) => (r === 0 && c === 0 ? { ...cell, color: '#ff0000' } : cell))),
}

function setup(pattern: Pattern | null = painted) {
  const deps = {
    currentPattern: () => pattern ?? undefined,
    replacePattern: vi.fn(),
    recordHistory: vi.fn(),
  }
  return { deps, ...useDeleteAllFlow(deps) }
}

describe('useDeleteAllFlow', () => {
  it('opens the confirmation only with a Pattern open', () => {
    const open = setup()
    open.onRequestDeleteAll()
    expect(open.deleteAllConfirmOpen.value).toBe(true)

    const none = setup(null)
    none.onRequestDeleteAll()
    expect(none.deleteAllConfirmOpen.value).toBe(false)
  })

  it('closes on cancel without touching the Pattern', () => {
    const { deps, deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll } = setup()
    onRequestDeleteAll()
    onCancelDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(deps.replacePattern).not.toHaveBeenCalled()
    expect(deps.recordHistory).not.toHaveBeenCalled()
  })

  it('confirming clears the grid as one undo step carrying the grid and Row progress', () => {
    const { deps, deleteAllConfirmOpen, onRequestDeleteAll, onConfirmDeleteAll } = setup()
    onRequestDeleteAll()
    onConfirmDeleteAll()
    expect(deleteAllConfirmOpen.value).toBe(false)
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({ grid: painted.grid, rowProgress: painted.rowProgress })
    expect(deps.replacePattern).toHaveBeenCalledTimes(1)
    const replaced = deps.replacePattern.mock.calls[0]![0] as Pattern
    expect(replaced.grid.flat().every((cell) => !cell.color)).toBe(true)
  })

  it('ignores the Row progress lock: progress resets along with the grid', () => {
    const inProgress = moveToRow(setRowProgressEnabled(painted, true), 2)
    const { deps, onConfirmDeleteAll } = setup(inProgress)
    onConfirmDeleteAll()
    const replaced = deps.replacePattern.mock.calls[0]![0] as Pattern
    expect(replaced.grid.flat().every((cell) => !cell.color)).toBe(true)
    expect(replaced.rowProgress).not.toEqual(inProgress.rowProgress)
  })

  it('is not an undo step when there is nothing to clear', () => {
    const { deps, onConfirmDeleteAll } = setup(blank)
    onConfirmDeleteAll()
    expect(deps.recordHistory).not.toHaveBeenCalled()
    expect(deps.replacePattern).not.toHaveBeenCalled()
  })
})

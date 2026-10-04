import { describe, expect, it, vi } from 'vitest'
import { createProject, setRowProgressEnabled, type Project } from '../../domain/project'
import { useRowOps } from './useRowOps'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 5, unit: 'beads' } })
const tracking = setRowProgressEnabled(base, true)

function setup(project: Project | null = base) {
  const deps = {
    currentProject: () => project ?? undefined,
    replaceProject: vi.fn(),
  }
  return { deps, ...useRowOps(deps) }
}

const replaced = (deps: { replaceProject: ReturnType<typeof vi.fn> }) => deps.replaceProject.mock.calls[0]![0] as Project

describe('useRowOps', () => {
  it('turns Row progress on and off', () => {
    const { deps, onToggleRowProgress } = setup()
    onToggleRowProgress(true)
    expect(replaced(deps).rowProgress.enabled).toBe(true)
  })

  it('leaves Row progress off with no Frame to count rows on', () => {
    const { frame: _frame, ...open } = base
    const { deps, onToggleRowProgress } = setup(open as Project)
    onToggleRowProgress(true)
    expect(replaced(deps).rowProgress.enabled).toBe(false)
  })

  it('flips the Row progress direction without touching the rotation', () => {
    const { deps, onToggleRowDirection } = setup(tracking)
    onToggleRowDirection()
    expect(replaced(deps).rowProgress.direction).toBe('columns')
    expect(replaced(deps).rotation).toBe(base.rotation)
  })

  it('moves the Row progress pointer by the given step', () => {
    const { deps, onMoveRow } = setup(tracking)
    onMoveRow(1)
    expect(replaced(deps).rowProgress.currentRow).toBe(tracking.rowProgress.currentRow + 1)
  })

  it('does nothing with no Project open', () => {
    const { deps, onToggleRowProgress, onToggleRowDirection, onMoveRow } = setup(null)
    onToggleRowProgress(true)
    onToggleRowDirection()
    onMoveRow(1)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })
})

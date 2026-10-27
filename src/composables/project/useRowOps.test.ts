import { describe, expect, it, vi } from 'vitest'
import { createProject, moveToRow, toggleRowDirection, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { useRowOps } from './useRowOps'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 5, unit: 'beads' } })
const tracking = base

function setup(project: Project | null = base) {
  const deps = {
    currentProject: () => project ?? undefined,
    replaceProject: vi.fn(),
    showToast: vi.fn(),
    messages: () => en,
  }
  return { deps, ...useRowOps(deps) }
}

const replaced = (deps: { replaceProject: ReturnType<typeof vi.fn> }) => deps.replaceProject.mock.calls[0]![0] as Project

describe('useRowOps', () => {
  it('flips the Row progress direction without touching the rotation', () => {
    const { deps, onToggleRowDirection } = setup(tracking)
    onToggleRowDirection()
    expect(replaced(deps).rowProgress.direction).toBe('columns')
    expect(replaced(deps).rotation).toBe(base.rotation)
  })

  it('says the new direction in a success toast, once per change, whoever turned it (ticket 411)', () => {
    const showToast = vi.fn()
    const deps = { currentProject: () => tracking, replaceProject: vi.fn(), showToast, messages: () => en }
    const { onToggleRowDirection } = useRowOps(deps)
    onToggleRowDirection()
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('row-direction', en.rowProgress.directionToastColumns, 'success')

    const columns = toggleRowDirection(tracking)
    const back = { ...deps, currentProject: () => columns }
    useRowOps(back).onToggleRowDirection()
    expect(showToast).toHaveBeenLastCalledWith('row-direction', en.rowProgress.directionToastRowsReversed, 'success')

    const upward = toggleRowDirection(columns)
    useRowOps({ ...deps, currentProject: () => upward }).onToggleRowDirection()
    expect(showToast).toHaveBeenLastCalledWith('row-direction', en.rowProgress.directionToastColumnsReversed, 'success')

    const leftward = toggleRowDirection(upward)
    useRowOps({ ...deps, currentProject: () => leftward }).onToggleRowDirection()
    expect(showToast).toHaveBeenLastCalledWith('row-direction', en.rowProgress.directionToastRows, 'success')
  })

  it('moves the Row progress pointer by the given step', () => {
    const { deps, onMoveRow } = setup(tracking)
    onMoveRow(1)
    expect(replaced(deps).rowProgress.currentRow).toBe(tracking.rowProgress.currentRow + 1)
  })

  it('does nothing with no Project open', () => {
    const { deps, onToggleRowDirection, onMoveRow } = setup(null)
    onToggleRowDirection()
    onMoveRow(1)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('asks before Reset progress, and only once a row is done (ticket 455)', () => {
    const framed = { ...base, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } }
    const fresh = setup(framed)
    fresh.onResetProgress()
    expect(fresh.resetProgressConfirmOpen.value).toBe(false)

    const started = setup(moveToRow(framed, 2))
    started.onResetProgress()
    expect(started.resetProgressConfirmOpen.value).toBe(true)
    expect(started.deps.replaceProject).not.toHaveBeenCalled()
    started.onCancelResetProgress()
    expect(started.resetProgressConfirmOpen.value).toBe(false)
  })

  it('takes both pointers back to the first row on confirm, keeping the direction (ticket 455)', () => {
    const columns = toggleRowDirection({ ...base, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } })
    const { deps, onResetProgress, onConfirmResetProgress, resetProgressConfirmOpen } = setup(moveToRow(columns, 2))
    onResetProgress()
    onConfirmResetProgress()
    expect(resetProgressConfirmOpen.value).toBe(false)
    expect(replaced(deps).rowProgress).toEqual({ direction: 'columns', currentRow: 0, currentColumn: 0 })
  })
})

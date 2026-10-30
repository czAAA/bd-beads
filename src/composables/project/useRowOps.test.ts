import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { createProject } from '../../domain/createProject'
import { moveToRow, resetRowProgress, rowProgressOf, toggleRowDirection } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { useRowOps } from './useRowOps'
import { withLayers } from '../../testUtils/layerFields'
import { frameOf } from '../../domain/layerRecord'

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
  // The flow and the expected Project each stamp `updatedAt`: a clock that ticks between them fails the comparison.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits the turned Row direction', () => {
    const { deps, onToggleRowDirection } = setup(tracking)
    onToggleRowDirection()
    expect(replaced(deps)).toEqual(toggleRowDirection(tracking))
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
    expect(rowProgressOf(replaced(deps)).currentRow).toBe(rowProgressOf(tracking).currentRow + 1)
  })

  it('does nothing with no Project open', () => {
    const { deps, onToggleRowDirection, onMoveRow } = setup(null)
    onToggleRowDirection()
    onMoveRow(1)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('asks before Reset progress, and only once a row is done (ticket 455)', () => {
    const framed = withLayers(base, { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } })
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

  it('commits Reset progress on confirm and closes the question (ticket 455)', () => {
    const started = moveToRow(tracking, 2)
    const { deps, onResetProgress, onConfirmResetProgress, resetProgressConfirmOpen } = setup(started)
    onResetProgress()
    onConfirmResetProgress()
    expect(resetProgressConfirmOpen.value).toBe(false)
    expect(replaced(deps)).toEqual(resetRowProgress(started))
  })

  describe('the press the Pattern\'s motion plays from (ticket 0730)', () => {
    /** A Frame of three rows, worked from the row given, open in a flow whose writes become the open Project. */
    function working(row = 0) {
      const framed = withLayers(base, { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } })
      const open = shallowRef<Project | undefined>(moveToRow(framed, row))
      const ops = useRowOps({ currentProject: () => open.value, replaceProject: (next) => (open.value = next), showToast: vi.fn(), messages: () => en })
      return { open, ...ops }
    }

    it('records each Row done and Row not done that moves the pointer: the pass it left and the one it reached', () => {
      const { rowPress, onMoveRow } = working()
      expect(rowPress.value).toBeUndefined()
      onMoveRow(1)
      expect(rowPress.value).toMatchObject({ done: true, from: 0, to: 1, patternDone: false })
      const first = rowPress.value!.id
      onMoveRow(-1)
      expect(rowPress.value).toMatchObject({ done: false, from: 1, to: 0, patternDone: false })
      expect(rowPress.value!.id).not.toBe(first)
    })

    it('marks Pattern done on the press that finishes the last pass, and on no other', () => {
      const { rowPress, onMoveRow } = working(2)
      onMoveRow(1)
      expect(rowPress.value).toMatchObject({ done: true, from: 2, to: 3, patternDone: true })
      // Every pass is done: a press that moves nothing is no press, and Row not done leaves Pattern done.
      const finished = rowPress.value
      onMoveRow(1)
      expect(rowPress.value).toBe(finished)
      onMoveRow(-1)
      expect(rowPress.value).toMatchObject({ done: false, patternDone: false })
    })

    it('records nothing when the pointer changes without a press: a Project opened finished, or Undo', async () => {
      const { open, rowPress } = working()
      open.value = moveToRow(open.value!, 3)
      await nextTick()
      expect(rowPress.value).toBeUndefined()
    })

    it('stops on Reset progress, a turn of the row direction, Remove Frame, leaving the Project, and when asked (Undo, Redo)', async () => {
      const reset = working(2)
      reset.onMoveRow(1)
      reset.onResetProgress()
      reset.onConfirmResetProgress()
      expect(reset.rowPress.value).toBeUndefined()

      const turned = working(2)
      turned.onMoveRow(1)
      turned.onToggleRowDirection()
      expect(turned.rowPress.value).toBeUndefined()

      const removed = working(2)
      removed.onMoveRow(1)
      removed.open.value = withLayers(removed.open.value!, { frame: undefined })
      await nextTick()
      expect(removed.rowPress.value).toBeUndefined()

      const left = working(2)
      left.onMoveRow(1)
      left.open.value = { ...left.open.value!, id: 'another' }
      await nextTick()
      expect(left.rowPress.value).toBeUndefined()

      const undone = working(2)
      undone.onMoveRow(1)
      undone.stopRowMotion()
      expect(undone.rowPress.value).toBeUndefined()
    })

    it('keeps playing through an edit that leaves the Project and its Frame in place', async () => {
      const { open, rowPress, onMoveRow } = working(2)
      onMoveRow(1)
      open.value = withLayers(open.value!, { name: 'Renamed' })
      await nextTick()
      expect(frameOf(open.value)).toBeDefined()
      expect(rowPress.value?.patternDone).toBe(true)
    })
  })
})

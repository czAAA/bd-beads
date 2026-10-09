import { describe, expect, it } from 'vitest'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createProject, type Project, frameGrid, withFrameGrid } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'

function newProject(): Project {
  return createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
}

function painted(project: Project): Project {
  const grid = frameGrid(project).map((row) => [...row])
  grid[0]![0] = { color: 'x' }
  return withFrameGrid(project, grid)
}

describe('useUndoHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const { history } = editHarness(newProject())
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('undoes and redoes an Edit step by step', () => {
    const ctx = editHarness(newProject())
    const before = ctx.project
    const after = painted(before)

    ctx.edit('drawing', () => after)
    expect(frameGrid(ctx.project)).toEqual(frameGrid(after))
    expect(ctx.history.canUndo.value).toBe(true)

    ctx.history.onUndo()
    expect(frameGrid(ctx.project)).toEqual(frameGrid(before))
    expect(ctx.history.canRedo.value).toBe(true)

    ctx.history.onRedo()
    expect(frameGrid(ctx.project)).toEqual(frameGrid(after))
    expect(ctx.history.canRedo.value).toBe(false)
  })

  it('does nothing without an open Project', () => {
    const ctx = editHarness(undefined)
    ctx.history.onUndo()
    ctx.history.onRedo()
    expect(ctx.replaceProject).not.toHaveBeenCalled()
  })

  it('restores Mirror axis counts from the snapshot, and clears the Selection when the Frame differs', () => {
    const ctx = editHarness(newProject())
    ctx.history.record({
      beads: ctx.project.beads,
      rowProgress: ctx.project.rowProgress,
      beadId: ctx.project.beadId,
      technique: ctx.project.technique,
      frame: { row: 0, column: 0, columns: 5, rows: 5 },
      mirrorAxisCounts: NO_MIRROR_AXES,
    })
    ctx.history.onUndo()
    expect(ctx.restoreMirrorAxisCounts).toHaveBeenCalledWith(NO_MIRROR_AXES)
    expect(ctx.resetAfterFrameChange).toHaveBeenCalled()
  })

  it('leaves the Selection alone when the Frame is the same', () => {
    const ctx = editHarness(newProject())
    ctx.edit('drawing', painted)
    ctx.history.onUndo()
    expect(ctx.resetAfterFrameChange).not.toHaveBeenCalled()
  })

  it('reset empties both stacks', () => {
    const ctx = editHarness(newProject())
    ctx.edit('drawing', painted)
    ctx.history.reset()
    expect(ctx.history.canUndo.value).toBe(false)
  })
})

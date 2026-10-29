import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { frameGrid, withFrameGrid } from '../../testUtils/frameGrid'
import { frameOf, withFrameSheet } from '../../domain/layerRecord'
import { snapshotOf } from '../../domain/undoSnapshot'

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

  it('puts back the very state it recorded, not a reactive copy of it (ticket 0616)', () => {
    const ctx = editHarness(newProject())
    const before = ctx.project

    ctx.edit('drawing', () => painted(before))
    ctx.history.onUndo()

    expect(frameOf(ctx.project)).toBe(frameOf(before))
  })

  it('does nothing without an open Project', () => {
    const ctx = editHarness(undefined)
    ctx.history.onUndo()
    ctx.history.onRedo()
    expect(ctx.replaceProject).not.toHaveBeenCalled()
  })

  it('clears the Selection when the Frame differs', () => {
    const ctx = editHarness(newProject())
    ctx.history.record({
      ...snapshotOf(withFrameSheet(ctx.project, { technique: 'loom', row: 0, column: 0, columns: 5, rows: 5, beads: {} })),
    })
    ctx.history.onUndo()
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

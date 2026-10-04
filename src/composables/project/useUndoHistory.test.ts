import { describe, expect, it, vi } from 'vitest'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createProject, type Project, frameGrid, withFrameGrid } from '../../domain/project'
import { useUndoHistory } from './useUndoHistory'

function setup(initial: Project) {
  let project: Project | undefined = initial
  const restoreMirrorAxisCounts = vi.fn()
  const clearSelectionAndHover = vi.fn()
  const history = useUndoHistory({
    currentProject: () => project,
    replaceProject: (p) => {
      project = p
    },
    mirrorAxisCounts: () => NO_MIRROR_AXES,
    restoreMirrorAxisCounts,
    clearSelectionAndHover,
  })
  return { history, get project() { return project! }, restoreMirrorAxisCounts, clearSelectionAndHover, clear: () => { project = undefined } }
}

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
    const { history } = setup(newProject())
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('commits a grid change as one undo step, then undoes and redoes it', () => {
    const ctx = setup(newProject())
    const before = ctx.project
    const after = painted(before)

    ctx.history.commitGridChange(before, after)
    expect(frameGrid(ctx.project)).toEqual(frameGrid(after))
    expect(ctx.history.canUndo.value).toBe(true)

    ctx.history.onUndo()
    expect(frameGrid(ctx.project)).toEqual(frameGrid(before))
    expect(ctx.history.canRedo.value).toBe(true)

    ctx.history.onRedo()
    expect(frameGrid(ctx.project)).toEqual(frameGrid(after))
    expect(ctx.history.canRedo.value).toBe(false)
  })

  it('records nothing when the change leaves the Project unchanged', () => {
    const ctx = setup(newProject())
    ctx.history.commitGridChange(ctx.project, ctx.project)
    expect(ctx.history.canUndo.value).toBe(false)
  })

  it('does nothing without an open Project', () => {
    const ctx = setup(newProject())
    ctx.history.commitGridChange(ctx.project, painted(ctx.project))
    ctx.clear()
    ctx.history.onUndo()
    ctx.history.onRedo()
    expect(ctx.history.canUndo.value).toBe(true)
  })

  it('restores Mirror axis counts and clears Selection when a step changes the grid size', () => {
    const ctx = setup(newProject())
    const before = ctx.project
    ctx.history.record({
      beads: before.beads,
      size: { frame: { row: 0, column: 0, columns: 5, rows: 5 }, mirrorAxisCounts: NO_MIRROR_AXES },
    })
    ctx.history.onUndo()
    expect(ctx.restoreMirrorAxisCounts).toHaveBeenCalledWith(NO_MIRROR_AXES)
    expect(ctx.clearSelectionAndHover).toHaveBeenCalled()
  })

  it('reset empties both stacks', () => {
    const ctx = setup(newProject())
    ctx.history.commitGridChange(ctx.project, painted(ctx.project))
    ctx.history.reset()
    expect(ctx.history.canUndo.value).toBe(false)
  })
})

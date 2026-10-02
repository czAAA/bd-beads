import { describe, expect, it, vi } from 'vitest'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createPattern, type Pattern } from '../../domain/pattern'
import { useUndoHistory } from './useUndoHistory'

function setup(initial: Pattern) {
  let pattern: Pattern | undefined = initial
  const restoreMirrorAxisCounts = vi.fn()
  const clearSelectionAndHover = vi.fn()
  const history = useUndoHistory({
    currentPattern: () => pattern,
    replacePattern: (p) => {
      pattern = p
    },
    mirrorAxisCounts: () => NO_MIRROR_AXES,
    restoreMirrorAxisCounts,
    clearSelectionAndHover,
  })
  return { history, get pattern() { return pattern! }, restoreMirrorAxisCounts, clearSelectionAndHover, clear: () => { pattern = undefined } }
}

function newPattern(): Pattern {
  return createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
}

function painted(pattern: Pattern): Pattern {
  const grid = pattern.grid.map((row) => [...row])
  grid[0][0] = { color: 'x' }
  return { ...pattern, grid: grid as Pattern['grid'] }
}

describe('useUndoHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const { history } = setup(newPattern())
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('commits a grid change as one undo step, then undoes and redoes it', () => {
    const ctx = setup(newPattern())
    const before = ctx.pattern
    const after = painted(before)

    ctx.history.commitGridChange(before, after)
    expect(ctx.pattern.grid).toEqual(after.grid)
    expect(ctx.history.canUndo.value).toBe(true)

    ctx.history.onUndo()
    expect(ctx.pattern.grid).toEqual(before.grid)
    expect(ctx.history.canRedo.value).toBe(true)

    ctx.history.onRedo()
    expect(ctx.pattern.grid).toEqual(after.grid)
    expect(ctx.history.canRedo.value).toBe(false)
  })

  it('records nothing when the change leaves the Pattern unchanged', () => {
    const ctx = setup(newPattern())
    ctx.history.commitGridChange(ctx.pattern, ctx.pattern)
    expect(ctx.history.canUndo.value).toBe(false)
  })

  it('does nothing without an open Pattern', () => {
    const ctx = setup(newPattern())
    ctx.history.commitGridChange(ctx.pattern, painted(ctx.pattern))
    ctx.clear()
    ctx.history.onUndo()
    ctx.history.onRedo()
    expect(ctx.history.canUndo.value).toBe(true)
  })

  it('restores Mirror axis counts and clears Selection when a step changes the grid size', () => {
    const ctx = setup(newPattern())
    const before = ctx.pattern
    ctx.history.record({
      grid: before.grid,
      size: { columns: 5, rows: 5, mirrorAxisCounts: NO_MIRROR_AXES },
    })
    ctx.history.onUndo()
    expect(ctx.restoreMirrorAxisCounts).toHaveBeenCalledWith(NO_MIRROR_AXES)
    expect(ctx.clearSelectionAndHover).toHaveBeenCalled()
  })

  it('reset empties both stacks', () => {
    const ctx = setup(newPattern())
    ctx.history.commitGridChange(ctx.pattern, painted(ctx.pattern))
    ctx.history.reset()
    expect(ctx.history.canUndo.value).toBe(false)
  })
})

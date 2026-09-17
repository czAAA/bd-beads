import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, emptyHistory, pushHistory, redoStep, undoStep } from './history'

describe('emptyHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const history = emptyHistory<string>()

    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })
})

describe('pushHistory', () => {
  it('records a step, so it becomes available to undo', () => {
    const history = pushHistory(emptyHistory<string>(), 'a')

    expect(canUndo(history)).toBe(true)
  })

  it('clears whatever was available to redo: a fresh edit invalidates the steps Redo used to reach', () => {
    const history = pushHistory(emptyHistory<string>(), 'a')
    const afterUndo = undoStep(history, 'b')!
    expect(canRedo(afterUndo.history)).toBe(true)

    const afterNewEdit = pushHistory(afterUndo.history, 'b')

    expect(canRedo(afterNewEdit)).toBe(false)
  })
})

describe('undoStep', () => {
  it('returns undefined when there is nothing to undo', () => {
    expect(undoStep(emptyHistory<string>(), 'a')).toBeUndefined()
  })

  it('steps back to the most recently pushed snapshot', () => {
    const history = pushHistory(pushHistory(emptyHistory<string>(), 'a'), 'b')

    const step = undoStep(history, 'c')!

    expect(step.snapshot).toBe('b')
  })

  it('records the current value on the redo stack, so Redo can step forward again', () => {
    const history = pushHistory(emptyHistory<string>(), 'a')

    const step = undoStep(history, 'b')!

    expect(canRedo(step.history)).toBe(true)
    expect(redoStep(step.history, step.snapshot)!.snapshot).toBe('b')
  })

  it('leaves the rest of the undo stack in place for a further undo', () => {
    const history = pushHistory(pushHistory(emptyHistory<string>(), 'a'), 'b')

    const step = undoStep(history, 'c')!

    expect(canUndo(step.history)).toBe(true)
    expect(undoStep(step.history, step.snapshot)!.snapshot).toBe('a')
  })
})

describe('redoStep', () => {
  it('returns undefined when there is nothing to redo', () => {
    expect(redoStep(emptyHistory<string>(), 'a')).toBeUndefined()
  })

  it('steps forward to the snapshot the most recent undo stepped back from', () => {
    const history = pushHistory(emptyHistory<string>(), 'a')
    const undone = undoStep(history, 'b')!

    const step = redoStep(undone.history, undone.snapshot)!

    expect(step.snapshot).toBe('b')
  })

  it('records the current value back on the undo stack, so a further undo can reach it again', () => {
    const history = pushHistory(emptyHistory<string>(), 'a')
    const undone = undoStep(history, 'b')!

    const step = redoStep(undone.history, undone.snapshot)!

    expect(canUndo(step.history)).toBe(true)
    expect(undoStep(step.history, step.snapshot)!.snapshot).toBe(undone.snapshot)
  })

  it('alternates undo and redo freely without losing or duplicating a step', () => {
    // a -> b -> c, three snapshots pushed in order.
    let history = pushHistory(pushHistory(emptyHistory<string>(), 'a'), 'b')
    let current = 'c'

    const undo1 = undoStep(history, current)!
    history = undo1.history
    current = undo1.snapshot
    expect(current).toBe('b')

    const undo2 = undoStep(history, current)!
    history = undo2.history
    current = undo2.snapshot
    expect(current).toBe('a')

    const redo1 = redoStep(history, current)!
    history = redo1.history
    current = redo1.snapshot
    expect(current).toBe('b')

    const redo2 = redoStep(history, current)!
    history = redo2.history
    current = redo2.snapshot
    expect(current).toBe('c')

    expect(canRedo(history)).toBe(false)
    expect(canUndo(history)).toBe(true)
  })
})

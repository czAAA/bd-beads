// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, emptyHistory, pushHistory, redoStep, undoStep, type History, type HistoryCap } from './history'

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

// Ticket 0677: the Undo steps together stay under a memory cap, each step's size estimated against the step after it.
describe('a capped history', () => {
  // Each snapshot is a word; a step holds as many bytes as its word has letters the next word lacks.
  const cap = (bytes: number): HistoryCap<string> => ({
    bytes,
    sizeOf: (older, newer) => [...older].filter((letter) => !newer.includes(letter)).length,
  })
  const pushed = (words: string[], limit: HistoryCap<string>) => words.reduce((history, word) => pushHistory(history, word, limit), emptyHistory<string>())
  /** Every snapshot Undo steps back through, newest first. */
  function undoAll(history: History<string>): string[] {
    const reached: string[] = []
    for (let step = undoStep(history, 'now'); step; step = undoStep(step.history, step.snapshot)) reached.push(step.snapshot)
    return reached
  }

  it('keeps every step while their sizes fit', () => {
    expect(undoAll(pushed(['ab', 'bc', 'cd', 'de'], cap(3)))).toEqual(['de', 'cd', 'bc', 'ab'])
  })

  it('drops the oldest steps once their sizes pass the cap', () => {
    // 'ab' holds 1 byte 'bc' lacks, 'bc' 1 that 'cd' lacks, 'cd' 1 that 'de' lacks: 3 bytes, over a cap of 2.
    expect(undoAll(pushed(['ab', 'bc', 'cd', 'de'], cap(2)))).toEqual(['de', 'cd', 'bc'])
    expect(undoAll(pushed(['ab', 'bc', 'cd', 'de'], cap(1)))).toEqual(['de', 'cd'])
  })

  it('always keeps the newest step, however large the one before it', () => {
    expect(undoAll(pushed(['abcdef', 'xyz'], cap(2)))).toEqual(['xyz'])
  })

  it('counts a step Redo puts back like one pushed', () => {
    const history = pushed(['ab', 'bc', 'cd'], cap(2))
    const undone = undoStep(undoStep(history, 'de')!.history, 'cd')!
    const redone = redoStep(redoStep(undone.history, 'bc', cap(2))!.history, 'cd', cap(2))!

    expect(undoAll(redone.history)).toEqual(['cd', 'bc', 'ab'])
    expect(undoAll(pushHistory(redone.history, 'de', cap(2)))).toEqual(['de', 'cd', 'bc'])
  })
})

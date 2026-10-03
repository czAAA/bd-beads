import { describe, expect, it, vi } from 'vitest'
import { createPattern } from '../../domain/pattern'
import { useKeyboardCursor } from './useKeyboardCursor'

function setup(hasSelection = false) {
  const pattern = createPattern({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: 5, height: 4, unit: 'beads' },
  })
  const deps = {
    currentPattern: () => pattern,
    reveal: vi.fn(),
    hasSelection: () => hasSelection,
    onCellHover: vi.fn(),
    onHoverEnd: vi.fn(),
    announceCursor: vi.fn(),
    invokeToolAt: vi.fn(),
    extendSelectionTo: vi.fn(),
    finishExtending: vi.fn(),
  }
  return { pattern, deps, ...useKeyboardCursor(deps) }
}

function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.createElement('div')
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('useKeyboardCursor', () => {
  it('moves with the arrows, past the Frame and into the negative, keeps itself in view, and announces', () => {
    const { beadCursor, deps, onPatternKey } = setup()
    onPatternKey(press('ArrowRight'))
    onPatternKey(press('ArrowDown'))
    expect(beadCursor.value).toEqual({ row: 1, column: 1 })
    onPatternKey(press('ArrowUp'))
    onPatternKey(press('ArrowUp'))
    expect(beadCursor.value).toEqual({ row: -1, column: 1 })
    expect(deps.onCellHover).toHaveBeenLastCalledWith(-1, 1)
    expect(deps.reveal).toHaveBeenLastCalledWith({ row: -1, column: 1 })
    expect(deps.announceCursor).toHaveBeenCalledTimes(4)
  })

  it('jumps with Home, End and Page Up / Down', () => {
    const { beadCursor, onPatternKey } = setup()
    onPatternKey(press('End'))
    expect(beadCursor.value.column).toBe(4)
    onPatternKey(press('PageDown'))
    expect(beadCursor.value.row).toBe(10)
    onPatternKey(press('Home'))
    onPatternKey(press('PageUp'))
    expect(beadCursor.value).toEqual({ row: 0, column: 0 })
  })

  it('remaps the arrows for a rotated Pattern', () => {
    const { pattern, beadCursor, onPatternKey } = setup()
    pattern.rotation = 90
    onPatternKey(press('ArrowLeft'))
    expect(beadCursor.value).toEqual({ row: 1, column: 0 })
  })

  it('uses the tool on Space and Enter and swallows the key', () => {
    const { deps, onPatternKey } = setup()
    const event = press(' ')
    onPatternKey(event)
    onPatternKey(press('Enter'))
    expect(deps.invokeToolAt).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
  })

  it('extends a Selection with Shift + arrows and finishes on Shift release', () => {
    const { deps, onPatternKey, onPatternKeyUp } = setup()
    onPatternKey(press('ArrowRight', { shiftKey: true }))
    expect(deps.extendSelectionTo).toHaveBeenCalledWith({ row: 0, column: 0 }, { row: 0, column: 1 })
    onPatternKeyUp(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(deps.finishExtending).toHaveBeenCalled()
  })

  it('leaves the Pattern on Escape, unless a Selection is up', () => {
    const free = setup()
    const event = press('Escape')
    free.onPatternKey(event)
    expect(event.defaultPrevented).toBe(true)
    const held = setup(true)
    const kept = press('Escape')
    held.onPatternKey(kept)
    expect(kept.defaultPrevented).toBe(false)
  })

  it('ignores other keys', () => {
    const { deps, onPatternKey } = setup()
    const event = press('a')
    onPatternKey(event)
    expect(event.defaultPrevented).toBe(false)
    expect(deps.announceCursor).not.toHaveBeenCalled()
  })

  it('shows the cursor on keyboard focus and announces it; hides it on blur', () => {
    const { keyboardOnPattern, deps, onPatternKeyboardFocus } = setup()
    onPatternKeyboardFocus(true)
    expect(keyboardOnPattern.value).toBe(true)
    expect(deps.announceCursor).toHaveBeenCalled()
    onPatternKeyboardFocus(false)
    expect(keyboardOnPattern.value).toBe(false)
    expect(deps.finishExtending).toHaveBeenCalled()
    expect(deps.onHoverEnd).toHaveBeenCalled()
  })
})

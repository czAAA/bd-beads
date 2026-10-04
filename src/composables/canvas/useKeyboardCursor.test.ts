import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createProject } from '../../domain/project'
import { useKeyboardCursor } from './useKeyboardCursor'

function setup(hasSelection = false, settingFrame = ref(false)) {
  const project = createProject({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: 5, height: 4, unit: 'beads' },
  })
  const deps = {
    currentProject: () => project,
    reveal: vi.fn(),
    hasSelection: () => hasSelection,
    onCellHover: vi.fn(),
    onHoverEnd: vi.fn(),
    announceCursor: vi.fn(),
    invokeToolAt: vi.fn(),
    extendSelectionTo: vi.fn(),
    finishExtending: vi.fn(),
    settingFrame: () => settingFrame.value,
  }
  return { project, deps, ...useKeyboardCursor(deps) }
}

function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.createElement('div')
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('useKeyboardCursor', () => {
  it('moves with the arrows, past the Frame and into the negative, keeps itself in view, and announces', () => {
    const { beadCursor, deps, onProjectKey } = setup()
    onProjectKey(press('ArrowRight'))
    onProjectKey(press('ArrowDown'))
    expect(beadCursor.value).toEqual({ row: 1, column: 1 })
    onProjectKey(press('ArrowUp'))
    onProjectKey(press('ArrowUp'))
    expect(beadCursor.value).toEqual({ row: -1, column: 1 })
    expect(deps.onCellHover).toHaveBeenLastCalledWith(-1, 1)
    expect(deps.reveal).toHaveBeenLastCalledWith({ row: -1, column: 1 })
    expect(deps.announceCursor).toHaveBeenCalledTimes(4)
  })

  it('jumps with Home, End and Page Up / Down', () => {
    const { beadCursor, onProjectKey } = setup()
    onProjectKey(press('End'))
    expect(beadCursor.value.column).toBe(4)
    onProjectKey(press('PageDown'))
    expect(beadCursor.value.row).toBe(10)
    onProjectKey(press('Home'))
    onProjectKey(press('PageUp'))
    expect(beadCursor.value).toEqual({ row: 0, column: 0 })
  })

  it('remaps the arrows for a rotated Project', () => {
    const { project, beadCursor, onProjectKey } = setup()
    project.rotation = 90
    onProjectKey(press('ArrowLeft'))
    expect(beadCursor.value).toEqual({ row: 1, column: 0 })
  })

  it('uses the tool on Space and Enter and swallows the key', () => {
    const { deps, onProjectKey } = setup()
    const event = press(' ')
    onProjectKey(event)
    onProjectKey(press('Enter'))
    expect(deps.invokeToolAt).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
  })

  it('extends a Selection with Shift + arrows and finishes on Shift release', () => {
    const { deps, onProjectKey, onProjectKeyUp } = setup()
    onProjectKey(press('ArrowRight', { shiftKey: true }))
    expect(deps.extendSelectionTo).toHaveBeenCalledWith({ row: 0, column: 0 }, { row: 0, column: 1 })
    onProjectKeyUp(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(deps.finishExtending).toHaveBeenCalled()
  })

  it('leaves the Project on Escape, unless a Selection is up', () => {
    const free = setup()
    const event = press('Escape')
    free.onProjectKey(event)
    expect(event.defaultPrevented).toBe(true)
    const held = setup(true)
    const kept = press('Escape')
    held.onProjectKey(kept)
    expect(kept.defaultPrevented).toBe(false)
  })

  it('ignores other keys', () => {
    const { deps, onProjectKey } = setup()
    const event = press('a')
    onProjectKey(event)
    expect(event.defaultPrevented).toBe(false)
    expect(deps.announceCursor).not.toHaveBeenCalled()
  })

  it('shows the cursor on keyboard focus and announces it; hides it on blur', () => {
    const { keyboardOnProject, deps, onProjectKeyboardFocus } = setup()
    onProjectKeyboardFocus(true)
    expect(keyboardOnProject.value).toBe(true)
    expect(deps.announceCursor).toHaveBeenCalled()
    onProjectKeyboardFocus(false)
    expect(keyboardOnProject.value).toBe(false)
    expect(deps.finishExtending).toHaveBeenCalled()
    expect(deps.onHoverEnd).toHaveBeenCalled()
  })

  it('hides the cursor during Set Frame, whose arrows move the Frame, and shows it again once the Frame is done (ticket 286)', () => {
    const settingFrame = ref(true)
    const { keyboardOnProject, cursorShown, deps, onProjectKeyboardFocus } = setup(false, settingFrame)
    onProjectKeyboardFocus(true)
    expect(keyboardOnProject.value).toBe(true)
    expect(cursorShown.value).toBe(false)
    expect(deps.onCellHover).not.toHaveBeenCalled()
    expect(deps.announceCursor).not.toHaveBeenCalled()
    settingFrame.value = false
    expect(cursorShown.value).toBe(true)
  })
})

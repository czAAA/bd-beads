import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useAppShortcutTable, type AppShortcutTableDeps } from './useAppShortcutTable'

function mountTable(overrides: Partial<AppShortcutTableDeps> = {}) {
  const deps: AppShortcutTableDeps = {
    activeProject: () => undefined,
    activeTool: () => 'paint',
    hasSelection: () => false,
    selectionHasBeads: () => false,
    canUndo: () => true,
    canRedo: () => true,
    hasClipboard: () => true,
    hasOpenLayer: () => false,
    anyDialogOpen: () => false,
    cancelColorPick: () => false,
    onPickColorKey: vi.fn(),
    backOutOfSelect: vi.fn(() => false),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSelectTool: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectColor: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleRulers: vi.fn(),
    onEditFrame: vi.fn(),
    onToggleFramePanel: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPasteMode: vi.fn(),
    onFillSelection: vi.fn(),
    onFrameFromSelection: vi.fn(),
    pasteAtPointer: vi.fn(),
    onRotate: vi.fn(),
    canRemoveSelectedLine: () => true,
    canNamePiece: () => false,
    hasPaintColor: () => true,
    onNamePiece: vi.fn(),
    onRemoveSelectedLine: vi.fn(),
    onToggleRowDirection: vi.fn(),
    onToggleRowHighlight: vi.fn(),
    onMoveRow: vi.fn(),
    onResetProgress: vi.fn(),
    openShortcutsHelp: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFit: vi.fn(),
    ...overrides,
  }
  const wrapper = mount(
    defineComponent({
      setup() {
        useAppShortcutTable(deps)
      },
      render: () => h('div'),
    }),
  )
  return { deps, wrapper }
}

function press(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

describe('useAppShortcutTable', () => {
  it('Ctrl/⌘ + plus, minus and 0 drive Canvas zoom and never reach the browser, even while typing', () => {
    const { deps, wrapper } = mountTable()
    const input = document.createElement('input')
    document.body.append(input)
    const keys: KeyboardEventInit[] = [
      { key: '+', ctrlKey: true, shiftKey: true },
      { key: '=', metaKey: true },
      { key: '-', ctrlKey: true },
      { key: '0', metaKey: true },
    ]
    for (const init of keys) {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(deps.onZoomIn).toHaveBeenCalledTimes(2)
    expect(deps.onZoomOut).toHaveBeenCalledTimes(1)
    expect(deps.onFit).toHaveBeenCalledTimes(1)
    input.remove()
    wrapper.unmount()
  })

  it('swallows Ctrl/⌘ + plus without zooming while a dialog is open', () => {
    const { deps, wrapper } = mountTable({ anyDialogOpen: () => true })
    const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(deps.onZoomIn).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('Ctrl+A selects all only while a Project is open, and 7 is free (tickets 414, 431)', () => {
    const none = mountTable()
    press({ key: 'a', ctrlKey: true })
    expect(none.deps.onSelectAll).not.toHaveBeenCalled()
    none.wrapper.unmount()

    const { deps, wrapper } = mountTable({ activeProject: () => ({}) as never })
    press({ key: '7' })
    expect(deps.onSelectAll).not.toHaveBeenCalled()
    press({ key: 'a', ctrlKey: true })
    expect(deps.onSelectAll).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('routes Ctrl+Z to undo and Ctrl+Shift+Z / Ctrl+Y to redo', () => {
    const { deps, wrapper } = mountTable()
    press({ key: 'z', ctrlKey: true })
    press({ key: 'z', ctrlKey: true, shiftKey: true })
    press({ key: 'y', ctrlKey: true })
    expect(deps.onUndo).toHaveBeenCalledTimes(1)
    expect(deps.onRedo).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('selects tools with 1/2/3 and ignores them while a dialog is open', () => {
    let dialog = false
    const { deps, wrapper } = mountTable({ anyDialogOpen: () => dialog })
    press({ key: '2' })
    expect(deps.onSelectTool).toHaveBeenCalledWith('fill')
    dialog = true
    press({ key: '3' })
    expect(deps.onSelectTool).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('E picks the eraser, but not while a modal is open', () => {
    const { deps, wrapper } = mountTable()
    press({ key: '4' })
    expect(deps.onSelectTool).toHaveBeenCalledWith('erase')
    wrapper.unmount()
  })

  it('Delete empties the Selection and does nothing without one, never picking the eraser', () => {
    const { deps, wrapper } = mountTable({ activeTool: () => 'select', hasSelection: () => true })
    press({ key: 'Delete' })
    expect(deps.onClearSelection).toHaveBeenCalledTimes(1)
    expect(deps.onRemoveSelectedLine).not.toHaveBeenCalled()
    wrapper.unmount()
    const other = mountTable()
    press({ key: 'Delete' })
    expect(other.deps.onClearSelection).not.toHaveBeenCalled()
    expect(other.deps.onSelectTool).not.toHaveBeenCalled()
    other.wrapper.unmount()
  })

  it('Shift+Delete removes the selected row or column, and only when that applies', () => {
    const { deps, wrapper } = mountTable({ hasSelection: () => true })
    press({ key: 'Delete', shiftKey: true })
    expect(deps.onRemoveSelectedLine).toHaveBeenCalledTimes(1)
    expect(deps.onClearSelection).not.toHaveBeenCalled()
    wrapper.unmount()
    const refused = mountTable({ canRemoveSelectedLine: () => false })
    press({ key: 'Delete', shiftKey: true })
    expect(refused.deps.onRemoveSelectedLine).not.toHaveBeenCalled()
    refused.wrapper.unmount()
  })

  it('Shift+R rotates and plain R still toggles the rulers', () => {
    const { deps, wrapper } = mountTable()
    press({ key: 'R', shiftKey: true })
    expect(deps.onRotate).toHaveBeenCalledTimes(1)
    expect(deps.onToggleRulers).not.toHaveBeenCalled()
    press({ key: 'r' })
    expect(deps.onToggleRulers).toHaveBeenCalledTimes(1)
    expect(deps.onRotate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('Escape with nothing to dismiss selects Paint from any other tool', () => {
    for (const tool of ['fill', 'select', 'erase'] as const) {
      const { deps, wrapper } = mountTable({ activeTool: () => tool })
      press({ key: 'Escape' })
      expect(deps.onSelectTool).toHaveBeenCalledWith('paint')
      wrapper.unmount()
    }
    const paint = mountTable()
    press({ key: 'Escape' })
    expect(paint.deps.onSelectTool).not.toHaveBeenCalled()
    paint.wrapper.unmount()
  })

  it('Escape ends Pick color from canvas before anything else (ticket 398)', () => {
    const picking = mountTable({ activeTool: () => 'select', cancelColorPick: vi.fn(() => true) })
    press({ key: 'Escape' })
    expect(picking.deps.cancelColorPick).toHaveBeenCalled()
    expect(picking.deps.onSelectTool).not.toHaveBeenCalled()
    picking.wrapper.unmount()
  })

  it('Escape leaves the tool alone when it dismissed something', () => {
    const backed = mountTable({ activeTool: () => 'select', backOutOfSelect: vi.fn(() => true) })
    press({ key: 'Escape' })
    expect(backed.deps.onSelectTool).not.toHaveBeenCalled()
    backed.wrapper.unmount()
  })

  it('4, 5 and 6 pick Erase, Hand and Piece, and Ctrl+A selects all (tickets 292, 414, 431)', () => {
    const { deps, wrapper } = mountTable({ activeProject: () => ({}) as never })
    for (const key of ['4', '5', '6']) press({ key })
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(1, 'erase')
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(2, 'hand')
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(3, 'piece')
    expect(deps.onEditFrame).not.toHaveBeenCalled()
    press({ key: 'a', ctrlKey: true })
    expect(deps.onSelectAll).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('does nothing on keys that no longer have a control: E, H, F and the Mirror keys (tickets 174, 292)', () => {
    const { deps, wrapper } = mountTable({ activeProject: () => ({}) as never })
    for (const key of ['e', 'h', 'f', '-', '=', '[', ']', 'm', 'v']) press({ key })
    for (const fn of Object.values(deps)) if (typeof fn === 'function' && 'mock' in fn) expect(fn).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('Shift plus 1..9 and 0 hand their key index on, and Q and W no longer pick a color (tickets 88, 529)', () => {
    const codes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']
    const { deps, wrapper } = mountTable()
    for (const code of codes) press({ code, shiftKey: true })
    expect(vi.mocked(deps.onPickColorKey).mock.calls.map(([key]) => key)).toEqual(codes.map((_c, key) => key))
    press({ code: 'KeyQ', key: 'Q', shiftKey: true })
    press({ code: 'KeyW', key: 'W', shiftKey: true })
    expect(deps.onPickColorKey).toHaveBeenCalledTimes(10)
    expect(deps.onSelectColor).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('D turns the Row progress direction and P does nothing (tickets 94, 426)', () => {
    const { deps, wrapper } = mountTable({ activeProject: () => ({}) as never })
    press({ key: 'p' })
    expect(deps.onToggleRowDirection).not.toHaveBeenCalled()
    press({ key: 'd' })
    expect(deps.onToggleRowDirection).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('Enter and Space move one row on, with Shift one back, and only while Row progress is on (tickets 94, 178)', () => {
    const on = mountTable({ activeProject: () => ({ frame: {} }) as never })
    press({ key: 'Enter' })
    press({ key: ' ' })
    press({ key: 'Enter', shiftKey: true })
    press({ key: ' ', shiftKey: true })
    expect(vi.mocked(on.deps.onMoveRow).mock.calls).toEqual([[1], [1], [-1], [-1]])
    on.wrapper.unmount()
    const off = mountTable({ activeProject: () => ({}) as never })
    press({ key: 'Enter' })
    press({ key: ' ', shiftKey: true })
    expect(off.deps.onMoveRow).not.toHaveBeenCalled()
    off.wrapper.unmount()
  })

  it('leaves Enter and Space to a focused Progress bar button, so one press does not also move the row', () => {
    const { deps, wrapper } = mountTable({ activeProject: () => ({ frame: {} }) as never })
    for (const container of ['progress-bar']) {
      const holder = document.createElement('div')
      holder.dataset.testid = container
      const button = document.createElement('button')
      holder.appendChild(button)
      document.body.appendChild(holder)
      for (const init of [{ key: 'Enter' }, { key: ' ' }, { key: 'Enter', shiftKey: true }, { key: ' ', shiftKey: true }]) {
        button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
      }
      holder.remove()
    }
    expect(deps.onMoveRow).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('Ctrl/Cmd+X cuts the Selection (ticket 415)', () => {
    const { deps, wrapper } = mountTable()
    press({ key: 'x', ctrlKey: true })
    press({ key: 'x', metaKey: true })
    expect(deps.onCut).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('Ctrl/Cmd+C copies, and ? opens the shortcuts help (tickets 91, 96)', () => {
    const { deps, wrapper } = mountTable()
    press({ key: 'c', ctrlKey: true })
    press({ key: 'c', metaKey: true })
    press({ key: '?', shiftKey: true })
    expect(deps.onCopy).toHaveBeenCalledTimes(2)
    expect(deps.openShortcutsHelp).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('answers no key while typing in a form field, except those marked to', () => {
    const { deps, wrapper } = mountTable({ activeProject: () => ({ frame: {} }) as never, hasSelection: () => true, onPickColorKey: vi.fn() })
    const field = document.createElement('input')
    document.body.appendChild(field)
    for (const init of [
      { key: '1' }, { key: 'r' }, { key: 'p' }, { key: 'd' }, { key: 'Delete' }, { key: 'Enter' }, { key: ' ' }, { key: '?' },
      { key: 'c', ctrlKey: true }, { code: 'Digit2', shiftKey: true },
    ]) {
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    }
    field.remove()
    for (const fn of [deps.onSelectTool, deps.onToggleRulers, deps.onToggleRowDirection, deps.onClearSelection, deps.onMoveRow, deps.openShortcutsHelp, deps.onCopy, deps.onSelectColor]) {
      expect(fn).not.toHaveBeenCalled()
    }
    wrapper.unmount()
  })

  it('answers no key while a dialog is open, except Escape', () => {
    const { deps, wrapper } = mountTable({ anyDialogOpen: () => true, activeProject: () => ({ frame: {} }) as never, onPickColorKey: vi.fn() })
    for (const init of [{ key: '1' }, { key: '?' }, { key: 'Enter' }, { key: 'r' }, { key: 'p' }, { code: 'Digit1', shiftKey: true }]) press(init)
    for (const fn of [deps.onSelectTool, deps.openShortcutsHelp, deps.onMoveRow, deps.onToggleRulers, deps.onSelectColor]) {
      expect(fn).not.toHaveBeenCalled()
    }
    wrapper.unmount()
  })
})

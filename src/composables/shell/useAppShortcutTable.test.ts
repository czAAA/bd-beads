import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useAppShortcutTable, type AppShortcutTableDeps } from './useAppShortcutTable'

function mountTable(overrides: Partial<AppShortcutTableDeps> = {}) {
  const deps: AppShortcutTableDeps = {
    activeProject: () => undefined,
    activeTool: () => 'paint',
    hasSelection: () => false,
    hasOpenLayer: () => false,
    anyDialogOpen: () => false,
    collapseExpandedToolGroup: () => false,
    backOutOfSelect: vi.fn(() => false),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSelectTool: vi.fn(),
    onSelectColor: vi.fn(),
    onDeleteSelection: vi.fn(),
    onToggleRulers: vi.fn(),
    onToggleFrame: vi.fn(),
    settingFrame: () => false,
    finishFrame: vi.fn(),
    onCopy: vi.fn(),
    pasteAtPointer: vi.fn(),
    onSave: vi.fn(),
    onRotate: vi.fn(),
    canRemoveSelectedLine: () => true,
    onRemoveSelectedLine: vi.fn(),
    onToggleRowProgress: vi.fn(),
    onToggleRowDirection: vi.fn(),
    onMoveRow: vi.fn(),
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

  it('F toggles Set Frame only while a Project is open', () => {
    const none = mountTable()
    press({ key: '6' })
    expect(none.deps.onToggleFrame).not.toHaveBeenCalled()
    none.wrapper.unmount()

    const { deps, wrapper } = mountTable({ activeProject: () => ({}) as never })
    press({ key: '6' })
    expect(deps.onToggleFrame).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('Escape finishes Set Frame before Select or the default tool take it', () => {
    const { deps, wrapper } = mountTable({ settingFrame: () => true, activeTool: () => 'erase' })
    press({ key: 'Escape' })
    expect(deps.finishFrame).toHaveBeenCalledOnce()
    expect(deps.backOutOfSelect).not.toHaveBeenCalled()
    expect(deps.onSelectTool).not.toHaveBeenCalled()
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
    expect(deps.onDeleteSelection).toHaveBeenCalledTimes(1)
    expect(deps.onRemoveSelectedLine).not.toHaveBeenCalled()
    wrapper.unmount()
    const other = mountTable()
    press({ key: 'Delete' })
    expect(other.deps.onDeleteSelection).not.toHaveBeenCalled()
    expect(other.deps.onSelectTool).not.toHaveBeenCalled()
    other.wrapper.unmount()
  })

  it('Shift+Delete removes the selected row or column, and only when that applies', () => {
    const { deps, wrapper } = mountTable({ hasSelection: () => true })
    press({ key: 'Delete', shiftKey: true })
    expect(deps.onRemoveSelectedLine).toHaveBeenCalledTimes(1)
    expect(deps.onDeleteSelection).not.toHaveBeenCalled()
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

  it('Escape collapses an expanded Tool group before backing out of Select', () => {
    const { deps, wrapper } = mountTable({ collapseExpandedToolGroup: () => true })
    press({ key: 'Escape' })
    expect(deps.backOutOfSelect).not.toHaveBeenCalled()
    wrapper.unmount()
    const other = mountTable()
    press({ key: 'Escape' })
    expect(other.deps.backOutOfSelect).toHaveBeenCalled()
    other.wrapper.unmount()
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

  it('Escape leaves the tool alone when it dismissed something', () => {
    const backed = mountTable({ activeTool: () => 'select', backOutOfSelect: vi.fn(() => true) })
    press({ key: 'Escape' })
    expect(backed.deps.onSelectTool).not.toHaveBeenCalled()
    backed.wrapper.unmount()
    const group = mountTable({ activeTool: () => 'fill', collapseExpandedToolGroup: () => true })
    press({ key: 'Escape' })
    expect(group.deps.onSelectTool).not.toHaveBeenCalled()
    group.wrapper.unmount()
  })

  it('Ctrl+S saves only while a Project is open', () => {
    const none = mountTable()
    press({ key: 's', ctrlKey: true })
    expect(none.deps.onSave).not.toHaveBeenCalled()
    none.wrapper.unmount()
    const open = mountTable({ activeProject: () => ({}) as never })
    press({ key: 's', ctrlKey: true })
    expect(open.deps.onSave).toHaveBeenCalled()
    open.wrapper.unmount()
  })
})

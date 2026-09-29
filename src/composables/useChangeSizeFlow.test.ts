import { describe, expect, it, vi } from 'vitest'
import { createPattern, setRowProgressEnabled, type Pattern } from '../domain/pattern'
import { wholeLineSelection, type Selection } from '../domain/selection'
import { useChangeSizeFlow } from './useChangeSizeFlow'

const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })

function setup(options: { pattern?: Pattern | null; selection?: Selection } = {}) {
  const pattern = options.pattern === null ? undefined : (options.pattern ?? base)
  const deps = {
    currentPattern: () => pattern,
    replacePattern: vi.fn(),
    recordHistory: vi.fn(),
    mirrorAxisCounts: () => ({ columns: 1, rows: 0 }),
    clearMirrorAxisCounts: vi.fn(),
    selection: () => options.selection,
    clearSelectionAndHover: vi.fn(),
  }
  return { deps, pattern, ...useChangeSizeFlow(deps) }
}

describe('useChangeSizeFlow', () => {
  describe('Resize and Change size', () => {
    it('lands as one undo step carrying the grid, Row progress and the old size with Mirror counts', () => {
      const { deps, onResize } = setup()
      onResize({ columns: 6, rows: 3 })

      expect(deps.recordHistory).toHaveBeenCalledTimes(1)
      expect(deps.recordHistory).toHaveBeenCalledWith({
        grid: base.grid,
        rowProgress: base.rowProgress,
        size: { columns: 4, rows: 3, mirrorAxisCounts: { columns: 1, rows: 0 } },
      })
      expect(deps.replacePattern).toHaveBeenCalledWith(expect.objectContaining({ columns: 6, rows: 3 }))
    })

    it('resets Mirror axis counts and the Selection', () => {
      const { deps, onResize } = setup()
      onResize({ columns: 6, rows: 3 })
      expect(deps.clearMirrorAxisCounts).toHaveBeenCalledTimes(1)
      expect(deps.clearSelectionAndHover).toHaveBeenCalledTimes(1)
    })

    it('is not an undo step when the size does not change', () => {
      const { deps, onResize } = setup()
      onResize({ columns: 4, rows: 3 })
      expect(deps.recordHistory).not.toHaveBeenCalled()
      expect(deps.replacePattern).not.toHaveBeenCalled()
      expect(deps.clearMirrorAxisCounts).not.toHaveBeenCalled()
    })

    it('is refused while Row progress is on', () => {
      const { deps, onResize } = setup({ pattern: setRowProgressEnabled(base, true) })
      onResize({ columns: 6, rows: 3 })
      expect(deps.recordHistory).not.toHaveBeenCalled()
      expect(deps.replacePattern).not.toHaveBeenCalled()
    })

    it('does nothing with no Pattern open', () => {
      const { deps, onResize } = setup({ pattern: null })
      onResize({ columns: 6, rows: 3 })
      expect(deps.replacePattern).not.toHaveBeenCalled()
    })
  })

  describe('the Change size modal', () => {
    it('opens with a Pattern open and Row progress off', () => {
      const { changeSizeOpen, onRequestChangeSize } = setup()
      onRequestChangeSize()
      expect(changeSizeOpen.value).toBe(true)
    })

    it('stays shut under the Row progress lock, or with nothing open', () => {
      const locked = setup({ pattern: setRowProgressEnabled(base, true) })
      locked.onRequestChangeSize()
      expect(locked.changeSizeOpen.value).toBe(false)

      const none = setup({ pattern: null })
      none.onRequestChangeSize()
      expect(none.changeSizeOpen.value).toBe(false)
    })

    it('closes on confirm and resizes', () => {
      const { deps, changeSizeOpen, onRequestChangeSize, onConfirmChangeSize } = setup()
      onRequestChangeSize()
      onConfirmChangeSize({ columns: 5, rows: 5 })
      expect(changeSizeOpen.value).toBe(false)
      expect(deps.replacePattern).toHaveBeenCalledWith(expect.objectContaining({ columns: 5, rows: 5 }))
    })
  })

  describe('Remove selected row/column', () => {
    const selection = wholeLineSelection(base, 'row', 1)

    it('is available only when the Selection marks out a whole line', () => {
      expect(setup({ selection }).canRemoveSelectedLine.value).toBe(true)
      expect(setup().canRemoveSelectedLine.value).toBe(false)
      expect(setup({ pattern: null, selection }).canRemoveSelectedLine.value).toBe(false)
    })

    it('is not available under the Row progress lock', () => {
      const locked = setRowProgressEnabled(base, true)
      expect(setup({ pattern: locked, selection }).canRemoveSelectedLine.value).toBe(false)
    })

    it('removes the line as one undo step and resets the session state', () => {
      const { deps, onRemoveSelectedLine } = setup({ selection })
      onRemoveSelectedLine()
      expect(deps.recordHistory).toHaveBeenCalledTimes(1)
      expect(deps.replacePattern).toHaveBeenCalledWith(expect.objectContaining({ columns: 4, rows: 2 }))
      expect(deps.clearMirrorAxisCounts).toHaveBeenCalledTimes(1)
      expect(deps.clearSelectionAndHover).toHaveBeenCalledTimes(1)
    })

    it('does nothing without a line selected', () => {
      const { deps, onRemoveSelectedLine } = setup()
      onRemoveSelectedLine()
      expect(deps.recordHistory).not.toHaveBeenCalled()
    })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createProject, moveToRow, setRowProgressEnabled, type Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { useCanvasPointer } from './useCanvasPointer'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

interface Options {
  project?: Project | null
  tool?: Tool
  spaceHeld?: boolean
  strokeMode?: 'paint' | 'erase' | null
  color?: string | null
}

function setup(options: Options = {}) {
  const deps = {
    currentProject: () => (options.project === null ? undefined : (options.project ?? base)),
    activeTool: () => options.tool ?? 'paint',
    spaceHeld: () => options.spaceHeld ?? false,
    strokeMode: () => options.strokeMode ?? null,
    selectedColorHex: () => (options.color === undefined ? '#ff0000' : options.color),
    mirrorAxisCounts: () => ({ columns: 0, rows: 0 }),
    mirrorCopyMode: () => false,
    pastePreviewCells: vi.fn(() => [{ row: 9, column: 9 }]),
    beginSelectPress: vi.fn(),
    extendSelection: vi.fn(),
    backOutOfSelect: vi.fn(),
    beginOrCommitPress: vi.fn(),
    paintStrokeCell: vi.fn(),
    pasteAt: vi.fn(() => true),
  }
  return { deps, ...useCanvasPointer(deps) }
}

describe('useCanvasPointer', () => {
  describe('hover preview', () => {
    it('is empty until the pointer is over a cell, and again once it leaves', () => {
      const { previewCells, onCellHover, onHoverEnd } = setup()
      expect(previewCells.value).toEqual([])
      onCellHover(1, 2)
      expect(previewCells.value).toEqual([{ row: 1, column: 2 }])
      onHoverEnd()
      expect(previewCells.value).toEqual([])
    })

    it('shows the pasted block under Select', () => {
      const { deps, previewCells, onCellHover } = setup({ tool: 'select' })
      onCellHover(0, 0)
      expect(previewCells.value).toEqual([{ row: 9, column: 9 }])
      expect(deps.pastePreviewCells).toHaveBeenCalled()
    })

    it('shows only the hovered cell under Fill', () => {
      const { previewCells, onCellHover } = setup({ tool: 'fill' })
      onCellHover(3, 3)
      expect(previewCells.value).toEqual([{ row: 3, column: 3 }])
    })

    it('leaves out beads in rows already woven', () => {
      const woven = moveToRow(setRowProgressEnabled(base, true), 3)
      const { previewCells, onCellHover } = setup({ project: woven })
      onCellHover(0, 0)
      expect(previewCells.value).toEqual([])
    })
  })

  describe('primary press', () => {
    it('paints with the selected color under Paint', () => {
      const { deps, onCellPrimaryDown } = setup()
      onCellPrimaryDown(1, 2)
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('paint', '#ff0000', 1, 2)
    })

    it('erases under the Eraser, with no color needed', () => {
      const { deps, onCellPrimaryDown } = setup({ tool: 'erase', color: null })
      onCellPrimaryDown(1, 2)
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('erase', null, 1, 2)
    })

    it('starts a selection under Select', () => {
      const { deps, onCellPrimaryDown } = setup({ tool: 'select' })
      onCellPrimaryDown(1, 2)
      expect(deps.beginSelectPress).toHaveBeenCalledWith(1, 2)
      expect(deps.beginOrCommitPress).not.toHaveBeenCalled()
    })

    it('does nothing with no color chosen, no Project open, or Space held', () => {
      for (const options of [{ color: null }, { project: null }, { spaceHeld: true }, { tool: 'select' as const, spaceHeld: true }]) {
        const { deps, onCellPrimaryDown } = setup(options)
        onCellPrimaryDown(0, 0)
        expect(deps.beginOrCommitPress).not.toHaveBeenCalled()
        expect(deps.beginSelectPress).not.toHaveBeenCalled()
      }
    })
  })

  describe('primary drag', () => {
    it('paints along a paint stroke', () => {
      const { deps, onCellPrimaryMove } = setup({ strokeMode: 'paint' })
      onCellPrimaryMove(1, 1)
      expect(deps.paintStrokeCell).toHaveBeenCalledWith(1, 1, '#ff0000')
    })

    it('erases along an erase stroke', () => {
      const { deps, onCellPrimaryMove } = setup({ strokeMode: 'erase' })
      onCellPrimaryMove(1, 1)
      expect(deps.paintStrokeCell).toHaveBeenCalledWith(1, 1, null)
    })

    it('extends the selection under Select', () => {
      const { deps, onCellPrimaryMove } = setup({ tool: 'select' })
      onCellPrimaryMove(1, 1)
      expect(deps.extendSelection).toHaveBeenCalledWith(1, 1)
    })

    it('does nothing with no stroke running, no color, or Space held', () => {
      for (const options of [{}, { strokeMode: 'paint' as const, color: null }, { strokeMode: 'paint' as const, spaceHeld: true }]) {
        const { deps, onCellPrimaryMove } = setup(options)
        onCellPrimaryMove(1, 1)
        expect(deps.paintStrokeCell).not.toHaveBeenCalled()
      }
    })
  })

  describe('secondary press and drag', () => {
    it('erases under Paint, and again along the drag', () => {
      const { deps, onCellSecondaryDown, onCellSecondaryMove } = setup({ strokeMode: 'erase' })
      onCellSecondaryDown(2, 2)
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('erase', null, 2, 2)
      onCellSecondaryMove(2, 3)
      expect(deps.paintStrokeCell).toHaveBeenCalledWith(2, 3, null)
    })

    it('backs out of Select rather than erasing under it', () => {
      const { deps, onCellSecondaryDown } = setup({ tool: 'select' })
      onCellSecondaryDown(2, 2)
      expect(deps.backOutOfSelect).toHaveBeenCalled()
      expect(deps.beginOrCommitPress).not.toHaveBeenCalled()
    })

    it('does not drag-erase unless an erase stroke is running, or with Space held', () => {
      const idle = setup({ strokeMode: 'paint' })
      idle.onCellSecondaryMove(0, 0)
      const panning = setup({ strokeMode: 'erase', spaceHeld: true })
      panning.onCellSecondaryDown(0, 0)
      panning.onCellSecondaryMove(0, 0)
      expect(idle.deps.paintStrokeCell).not.toHaveBeenCalled()
      expect(panning.deps.paintStrokeCell).not.toHaveBeenCalled()
      expect(panning.deps.beginOrCommitPress).not.toHaveBeenCalled()
    })
  })

  describe('paste at the pointer', () => {
    it('claims the chord from the browser only when something was pasted', () => {
      const pasted = setup()
      const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent
      pasted.onCellHover(1, 1)
      pasted.pasteAtPointer(event)
      expect(pasted.deps.pasteAt).toHaveBeenCalledWith({ row: 1, column: 1 })
      expect(event.preventDefault).toHaveBeenCalled()

      const nothing = setup()
      nothing.deps.pasteAt.mockReturnValue(false)
      const other = { preventDefault: vi.fn() } as unknown as KeyboardEvent
      nothing.pasteAtPointer(other)
      expect(other.preventDefault).not.toHaveBeenCalled()
    })
  })
})

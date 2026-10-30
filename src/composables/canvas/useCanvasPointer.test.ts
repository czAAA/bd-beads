import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { stampCells } from '../../domain/selection'
import { useCanvasPointer } from './useCanvasPointer'
import { MIRROR_OFF, type MirrorSetting } from '../../domain/mirror'
import { frameOf } from '../../domain/layerRecord'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

interface Options {
  project?: Project | null
  tool?: Tool
  spaceHeld?: boolean
  strokeMode?: 'paint' | 'erase' | null
  color?: string | null
  mirror?: MirrorSetting
}

function setup(options: Options = {}) {
  const deps = {
    currentProject: () => (options.project === null ? undefined : (options.project ?? base)),
    activeTool: () => options.tool ?? 'paint',
    spaceHeld: () => options.spaceHeld ?? false,
    strokeMode: () => options.strokeMode ?? null,
    selectedColorHex: () => (options.color === undefined ? '#ff0000' : options.color),
    pastePreviewCells: vi.fn(() => [{ row: 9, column: 9 }]),
    // A 4 × 4 red block whose top-left lands on the hovered cell.
    pastePreviewStamp: vi.fn((_project: Project, at: { row: number; column: number }) => ({
      colors: Array.from({ length: 4 }, () => Array<string | null>(4).fill('#e63746')),
      top: at.row,
      left: at.column,
      rows: 4,
      columns: 4,
      lands: () => true,
    })),
    beginSelectPress: vi.fn(),
    extendSelection: vi.fn(),
    tapPiece: vi.fn(),
    beginOrCommitPress: vi.fn(),
    paintStrokeCells: vi.fn(),
    pasteAt: vi.fn(() => true),
    pickColorAt: vi.fn(() => false),
    mirror: () => options.mirror ?? MIRROR_OFF,
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

    it('shows every counterpart of the hovered Frame bead under Mirror, those in finished rows left out (ticket 0703)', () => {
      const { row, column } = frameOf(base)!
      const mirror: MirrorSetting = { ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, leftRight: true, topBottom: true } }
      const { previewCells, onCellHover } = setup({ project: moveToRow(base, 1), mirror })
      onCellHover(row + 3, column, 'frame')
      expect(previewCells.value).toEqual([
        { row: row + 3, column, layer: 'frame' },
        { row: row + 3, column: column + 3, layer: 'frame' },
      ])
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
      const woven = moveToRow(base, 3)
      const { previewCells, onCellHover } = setup({ project: woven })
      onCellHover(0, 0)
      expect(previewCells.value).toEqual([])
    })

    it('shows a block pasted on a grid as its stamp, leaving out the beads in rows already woven (ticket 0675)', () => {
      const { previewStamp, onCellHover, onHoverEnd } = setup({ tool: 'select', project: moveToRow(base, 3) })
      expect(previewStamp.value).toBeUndefined()
      onCellHover(0, 0)
      expect(stampCells(previewStamp.value!).map(({ row }) => row)).toEqual([3, 3, 3, 3])
      onHoverEnd()
      expect(previewStamp.value).toBeUndefined()
    })

    it('has no stamp under a tool that paints', () => {
      const { previewStamp, onCellHover } = setup({ tool: 'paint' })
      onCellHover(0, 0)
      expect(previewStamp.value).toBeUndefined()
    })
  })

  describe('primary press', () => {
    it('paints with the selected color under Paint', () => {
      const { deps, onCellPrimaryDown } = setup()
      onCellPrimaryDown(1, 2)
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('paint', '#ff0000', 1, 2, undefined)
    })

    it('erases under the Eraser, with no color needed', () => {
      const { deps, onCellPrimaryDown } = setup({ tool: 'erase', color: null })
      onCellPrimaryDown(1, 2)
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('erase', null, 1, 2, undefined)
    })

    it('starts a selection under Select', () => {
      const { deps, onCellPrimaryDown } = setup({ tool: 'select' })
      onCellPrimaryDown(1, 2)
      expect(deps.beginSelectPress).toHaveBeenCalledWith(1, 2, undefined)
      expect(deps.beginOrCommitPress).not.toHaveBeenCalled()
    })

    it('taps a Piece under Piece, with no preview and no stroke (ticket 414)', () => {
      const { deps, onCellPrimaryDown, onCellHover, previewCells } = setup({ tool: 'piece' })
      onCellHover(1, 1)
      onCellPrimaryDown(1, 1)
      expect(deps.tapPiece).toHaveBeenCalledWith(1, 1, undefined)
      expect(deps.beginSelectPress).not.toHaveBeenCalled()
      expect(deps.beginOrCommitPress).not.toHaveBeenCalled()
      expect(previewCells.value).toEqual([])
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
      expect(deps.paintStrokeCells).toHaveBeenCalledWith([{ row: 1, column: 1 }], '#ff0000')
    })

    it('erases along an erase stroke', () => {
      const { deps, onCellPrimaryMove } = setup({ strokeMode: 'erase' })
      onCellPrimaryMove(1, 1)
      expect(deps.paintStrokeCells).toHaveBeenCalledWith([{ row: 1, column: 1 }], null)
    })

    it('paints every bead one move crossed in one stroke step (ticket 0674), and Select follows the last', () => {
      const crossed = [{ row: 1, column: 1 }, { row: 1, column: 2 }, { row: 2, column: 3, layer: 'canvas' as const }]
      const paint = setup({ strokeMode: 'paint' })
      paint.onCellsPrimaryMove(crossed)
      expect(paint.deps.paintStrokeCells).toHaveBeenCalledTimes(1)
      expect(paint.deps.paintStrokeCells).toHaveBeenCalledWith(crossed, '#ff0000')

      const select = setup({ tool: 'select' })
      select.onCellsPrimaryMove(crossed)
      expect(select.deps.extendSelection).toHaveBeenCalledTimes(1)
      expect(select.deps.extendSelection).toHaveBeenCalledWith(2, 3, 'canvas')
    })

    it('extends the selection under Select', () => {
      const { deps, onCellPrimaryMove } = setup({ tool: 'select' })
      onCellPrimaryMove(1, 1)
      expect(deps.extendSelection).toHaveBeenCalledWith(1, 1, undefined)
    })

    it('does nothing with no stroke running, no color, or Space held', () => {
      for (const options of [{}, { strokeMode: 'paint' as const, color: null }, { strokeMode: 'paint' as const, spaceHeld: true }]) {
        const { deps, onCellPrimaryMove } = setup(options)
        onCellPrimaryMove(1, 1)
        expect(deps.paintStrokeCells).not.toHaveBeenCalled()
      }
    })
  })

  describe('layer of a press', () => {
    it('hands the layer the pointer hit to the tool, which a position alone cannot say (ADR 0066)', () => {
      const { deps, onCellPrimaryDown, onCellPrimaryMove } = setup({ strokeMode: 'paint' })
      onCellPrimaryDown(4, 1, 'frame')
      expect(deps.beginOrCommitPress).toHaveBeenCalledWith('paint', '#ff0000', 4, 1, 'frame')
      onCellPrimaryMove(4, 2, 'canvas')
      expect(deps.paintStrokeCells).toHaveBeenCalledWith([{ row: 4, column: 2, layer: 'canvas' }], '#ff0000')
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

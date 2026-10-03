import { describe, expect, it, vi } from 'vitest'
import { createPattern, setRowProgressEnabled, type Pattern } from '../../domain/pattern'
import type { Selection } from '../../domain/selection'
import { useRemoveLineFlow } from './useRemoveLineFlow'

const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const secondRow: Selection = { top: 1, left: 0, rows: 1, columns: 4 }

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
  return { deps, ...useRemoveLineFlow(deps) }
}

describe('useRemoveLineFlow', () => {
  it('is available only when the Selection marks out a whole line of the Frame', () => {
    expect(setup({ selection: secondRow }).canRemoveSelectedLine.value).toBe(true)
    expect(setup().canRemoveSelectedLine.value).toBe(false)
    expect(setup({ pattern: null, selection: secondRow }).canRemoveSelectedLine.value).toBe(false)
  })

  it('is not available under the Row progress lock', () => {
    expect(setup({ pattern: setRowProgressEnabled(base, true), selection: secondRow }).canRemoveSelectedLine.value).toBe(false)
  })

  it('removes the line as one undo step and resets the session state', () => {
    const { deps, onRemoveSelectedLine } = setup({ selection: secondRow })
    onRemoveSelectedLine()

    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({
      beads: base.beads,
      rowProgress: base.rowProgress,
      size: { frame: base.frame, mirrorAxisCounts: { columns: 1, rows: 0 } },
    })
    expect(deps.replacePattern).toHaveBeenCalledWith(expect.objectContaining({ frame: expect.objectContaining({ columns: 4, rows: 2 }) }))
    expect(deps.clearMirrorAxisCounts).toHaveBeenCalledTimes(1)
    expect(deps.clearSelectionAndHover).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a line selected', () => {
    const { deps, onRemoveSelectedLine } = setup()
    onRemoveSelectedLine()
    expect(deps.recordHistory).not.toHaveBeenCalled()
    expect(deps.replacePattern).not.toHaveBeenCalled()
  })
})

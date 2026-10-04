import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, setRowProgressEnabled, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { useRotateFlow } from './useRotateFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function setup(project: Project | null = base) {
  const deps = {
    currentProject: () => project ?? undefined,
    replaceProject: vi.fn(),
    recordHistory: vi.fn(),
    mirrorAxisCounts: () => ({ columns: 1, rows: 0 }),
    clearMirrorAxisCounts: vi.fn(),
    clearSelectionAndHover: vi.fn(),
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, ...useRotateFlow(deps) }
}

describe('useRotateFlow', () => {
  it('turns the Frame as one undo step that carries the beads, Row progress and the old Frame', () => {
    const { deps, onRotate } = setup()
    onRotate()

    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({
      beads: base.beads,
      rowProgress: base.rowProgress,
      size: { frame: base.frame, mirrorAxisCounts: { columns: 1, rows: 0 } },
    })
    const turned = deps.replaceProject.mock.calls[0]![0] as Project
    expect(turned.frame).toMatchObject({ rows: 3, columns: 2 })
    expect(deps.clearMirrorAxisCounts).toHaveBeenCalled()
    expect(deps.clearSelectionAndHover).toHaveBeenCalled()
  })

  it('only announces it when nothing was in the way', () => {
    const { deps, onRotate } = setup()
    onRotate()
    expect(deps.announce).toHaveBeenCalledWith('Pattern rotated')
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('says how many Pieces were in the way, with Undo that undoes the one step', () => {
    const frame = base.frame!
    // One bead just below the Frame, where the turned (taller) Frame reaches.
    const inTheWay: Project = { ...base, beads: withColors({}, [{ row: frame.row + frame.rows, column: frame.column + 1, color: '#00aa00' }]) }
    const { deps, onRotate } = setup(inTheWay)
    onRotate()

    expect(deps.showToast).toHaveBeenCalledTimes(1)
    const [id, text, tone, action] = deps.showToast.mock.calls[0]!
    expect(id).toBe('project-rotated')
    expect(text).toBe('Pattern rotated. 1 piece was in the way and moved outside the Frame.')
    expect(tone).toBe('info')
    expect(action.label).toBe('Undo')
    action.run()
    expect(deps.onUndo).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a Frame, while Row progress is on, or with no Project', () => {
    const { frame: _frame, ...open } = base
    for (const project of [open as Project, setRowProgressEnabled(base, true), null]) {
      const { deps, onRotate } = setup(project)
      onRotate()
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.recordHistory).not.toHaveBeenCalled()
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, setRowProgressEnabled, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateFlow } from './useRotateFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function setup(project: Project | null = base) {
  const harness = editHarness(project ?? undefined, { mirrorAxisCounts: { columns: 1, rows: 0 } })
  const deps = {
    edit: harness.edit,
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, harness, ...useRotateFlow(deps) }
}

describe('useRotateFlow', () => {
  it('turns the Frame as one undo step, resets the session, and Undo brings the old Frame back', () => {
    const { harness, onRotate } = setup()
    onRotate()

    expect(harness.project.frame).toMatchObject({ rows: 3, columns: 2 })
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(base.frame)
    expect(harness.history.canUndo.value).toBe(false)
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
  })

  it('does nothing without a Frame, while Row progress is on, or with no Project', () => {
    const { frame: _frame, ...open } = base
    for (const project of [open as Project, setRowProgressEnabled(base, true), null]) {
      const { harness, onRotate } = setup(project)
      onRotate()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})

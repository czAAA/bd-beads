import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'

const base = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
const framed: Project = {
  ...base,
  frame: { row: 20, column: 20, rows: 5, columns: 6 },
  beads: withColors({}, [{ row: 21, column: 22, color: '#e63746' }]),
}

function setup(project: Project = framed) {
  const harness = editHarness(project)
  const deps = { currentProject: harness.currentProject, replaceProject: harness.replaceProject, announce: vi.fn(), messages: () => en }
  return { deps, harness, ...useRotateCanvasFlow(deps) }
}

describe('useRotateCanvasFlow (ticket 471)', () => {
  it('advances the turn 0, 90, 180, 270 and back to 0 over four presses', () => {
    const { harness, onRotateCanvas } = setup()
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      onRotateCanvas()
      seen.push(harness.project.rotation)
    }
    expect(seen).toEqual([90, 180, 270, 0])
  })

  it('changes no bead, Frame, name or Row direction, and is no Undo step', () => {
    const { harness, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(harness.project.beads).toEqual(framed.beads)
    expect(harness.project.frame).toEqual(framed.frame)
    expect(harness.project.pieceNames).toEqual(framed.pieceNames)
    expect(harness.project.rowProgress).toEqual(framed.rowProgress)
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
  })

  it('still turns once a Row progress pass is done', () => {
    const done = moveToRow(framed, 1)
    const { harness, onRotateCanvas } = setup(done)
    onRotateCanvas()
    expect(harness.project.rotation).toBe(90)
  })

  it('announces the turn', () => {
    const { deps, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(deps.announce).toHaveBeenCalledWith('Canvas rotated')
  })
})

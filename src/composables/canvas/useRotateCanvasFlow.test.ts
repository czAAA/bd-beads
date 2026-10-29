import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'
import { beadsOfLayer, canvasOf, orientationOf } from '../../domain/layerRecord'
import { sheetOf, withFields } from '../../testUtils/flatFields'

const base = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
const framed: Project = withFields(base, {
frame: { technique: 'loom' as const, row: 20, column: 20, rows: 5, columns: 6, beads: {} },
  beads: withColors({}, [{ row: 21, column: 22, color: '#e63746' }]),
})

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
      seen.push(orientationOf(harness.project))
    }
    expect(seen).toEqual([90, 180, 270, 0])
  })

  it('changes no bead, Frame, name or Row direction, and is no Undo step', () => {
    const { harness, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual(beadsOfLayer(framed, 'canvas'))
    expect(sheetOf(harness.project)).toEqual(sheetOf(framed))
    expect(canvasOf(harness.project).pieceNames).toEqual(canvasOf(framed).pieceNames)
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(framed))
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
  })

  it('still turns once a Row progress pass is done', () => {
    const done = moveToRow(framed, 1)
    const { harness, onRotateCanvas } = setup(done)
    onRotateCanvas()
    expect(orientationOf(harness.project)).toBe(90)
  })

  it('turns a quarter clockwise from the angle a twist left it at (ticket 0672)', () => {
    const { harness, onRotateCanvas, onTwistCanvas } = setup()
    onTwistCanvas(30)
    onRotateCanvas()
    expect(orientationOf(harness.project)).toBe(120)
  })

  it('keeps the angle a twist settled on, changing no bead, Frame or Row progress, as no Undo step and with no announcement (ticket 0672)', () => {
    const { deps, harness, onTwistCanvas } = setup(moveToRow(framed, 1))
    onTwistCanvas(212.5)
    expect(orientationOf(harness.project)).toBe(212.5)
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual(beadsOfLayer(framed, 'canvas'))
    expect(sheetOf(harness.project)).toEqual(sheetOf(framed))
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(moveToRow(framed, 1)))
    expect(harness.history.canUndo.value).toBe(false)
    expect(deps.announce).not.toHaveBeenCalled()
  })

  it('announces the turn', () => {
    const { deps, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(deps.announce).toHaveBeenCalledWith('Canvas rotated')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { withPictureTurned } from '../../testUtils/layerFields'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf, seenWayOf } from '../../domain/rowProgress'
import { framePlacement } from '../../domain/framePlacement'
import { canvasPlacement } from '../../domain/table'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'
import { beadsOfLayer, canvasOf, orientationOf } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

const base = withPictureTurned(createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }), 0)
const framed: Project = withLayers(base, {
frame: { technique: 'loom' as const, row: 20, column: 20, rows: 5, columns: 6, beads: {} },
  beads: withColors({}, [{ row: 21, column: 22, color: '#e63746' }]),
})

function setup(project: Project = framed, turnView?: (orientation: number) => { x: number; y: number }) {
  const harness = editHarness(project)
  const deps = { currentProject: harness.currentProject, replaceProject: harness.replaceProject, announce: vi.fn(), messages: () => en, turnView }
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

  it('turns the Canvas alone: no bead or name changes, the Frame stays where it is with its way as seen, no Undo step (ticket 1188)', () => {
    const { harness, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual(beadsOfLayer(framed, 'canvas'))
    expect(beadsOfLayer(harness.project, 'frame')).toEqual(beadsOfLayer(framed, 'frame'))
    expect(canvasOf(harness.project).pieceNames).toEqual(canvasOf(framed).pieceNames)
    expect(framePlacement(harness.project)).toEqual(framePlacement(framed))
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(framed))
    expect(seenWayOf(harness.project)).toBe(seenWayOf(framed))
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
  })

  it('turns about the middle of the drawing area: the Canvas\'s origin moves as far as the view turned it', () => {
    const turnView = vi.fn(() => ({ x: 4, y: -6 }))
    const { harness, onRotateCanvas } = setup(framed, turnView)
    onRotateCanvas()
    expect(turnView).toHaveBeenCalledWith(90)
    expect(canvasPlacement(harness.project)).toEqual({ angle: 90, at: { x: 4, y: -6 } })
    expect(framePlacement(harness.project)).toEqual(framePlacement(framed))
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
    onTwistCanvas(212.5, { x: -1, y: 2 })
    expect(orientationOf(harness.project)).toBe(212.5)
    expect(canvasPlacement(harness.project).at).toEqual({ x: -1, y: 2 })
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual(beadsOfLayer(framed, 'canvas'))
    expect(framePlacement(harness.project)).toEqual(framePlacement(framed))
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

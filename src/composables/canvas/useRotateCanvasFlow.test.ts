import { frameIdIn } from '../../testUtils/frameId'
import { describe, expect, it, vi } from 'vitest'
import { withPictureTurned } from '../../testUtils/layerFields'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf, seenWayOf } from '../../domain/rowProgress'
import { tableTurnOf } from '../../domain/table'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'
import { beadsOfLayer, canvasOf, frameOf, orientationOf } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

const base = withPictureTurned(createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }), 0)
/** What places a Frame on the Table (spec 1234): its centre and its quarter turn. */
const placeOf = (project: Project) => ({ centre: frameOf(project)!.centre, angle: frameOf(project)!.angle })
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
    expect(beadsOfLayer(harness.project, frameIdIn(harness.project))).toEqual(beadsOfLayer(framed, frameIdIn(framed)))
    expect(canvasOf(harness.project).pieceNames).toEqual(canvasOf(framed).pieceNames)
    expect(placeOf(harness.project)).toEqual(placeOf(framed))
    expect(tableTurnOf(harness.project)).toBe(tableTurnOf(framed))
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual(rowProgressOf(framed, frameIdIn(framed)))
    expect(seenWayOf(harness.project, frameIdIn(harness.project))).toBe(seenWayOf(framed, frameIdIn(framed)))
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
  })

  it('turns about the middle of the drawing area: the Canvas\'s origin moves as far as the view turned it', () => {
    const turnView = vi.fn(() => ({ x: 4, y: -6 }))
    const { harness, onRotateCanvas } = setup(framed, turnView)
    onRotateCanvas()
    expect(turnView).toHaveBeenCalledWith(90)
    expect(canvasOf(harness.project)).toMatchObject({ orientation: 90, origin: { x: expect.any(Number), y: expect.any(Number) } })
    expect(canvasOf(harness.project).origin).not.toEqual({ x: 0, y: 0 })
    expect(placeOf(harness.project)).toEqual(placeOf(framed))
    expect(tableTurnOf(harness.project)).toBe(0)
  })

  it('still turns once a Row progress pass is done', () => {
    const done = moveToRow(framed, 1, frameIdIn(framed))
    const { harness, onRotateCanvas } = setup(done)
    onRotateCanvas()
    expect(orientationOf(harness.project)).toBe(90)
  })

  it('turns a quarter clockwise from the angle a twist left it at, the Frame and the Table turn staying (ticket 0672)', () => {
    const { harness, onRotateCanvas, onTwistTable } = setup()
    onTwistTable(30)
    const twisted = harness.project
    onRotateCanvas()
    expect(orientationOf(harness.project)).toBe(120)
    expect(tableTurnOf(harness.project)).toBe(30)
    expect(placeOf(harness.project)).toEqual(placeOf(twisted))
  })

  it('keeps the angle a twist settled on as the Table turn, changing no bead, Frame centre or Row progress, as no Undo step and with no announcement (ticket 0672)', () => {
    const { deps, harness, onTwistTable } = setup(moveToRow(framed, 1, frameIdIn(framed)))
    onTwistTable(212.5)
    expect(orientationOf(harness.project)).toBe(212.5)
    expect(tableTurnOf(harness.project)).toBe(212.5)
    expect(canvasOf(harness.project).orientation).toBe(0)
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual(beadsOfLayer(framed, 'canvas'))
    expect(placeOf(harness.project)).toEqual(placeOf(framed))
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual(rowProgressOf(moveToRow(framed, 1, frameIdIn(framed)), frameIdIn(framed)))
    expect(harness.history.canUndo.value).toBe(false)
    expect(deps.announce).not.toHaveBeenCalled()
  })

  it('announces the turn', () => {
    const { deps, onRotateCanvas } = setup()
    onRotateCanvas()
    expect(deps.announce).toHaveBeenCalledWith('Canvas rotated')
  })
})

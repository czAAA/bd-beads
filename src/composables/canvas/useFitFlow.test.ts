import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { frameOf, orientationOf, quarterTurnOf, withCanvas, withFrameFields } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { turnTableTo } from '../../domain/rotate'
import { tableTurnOf } from '../../domain/table'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { frameIdIn } from '../../testUtils/frameId'
import { withLayers } from '../../testUtils/layerFields'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'
import { useFitFlow } from './useFitFlow'
import { firstOf, SECOND, twoFrames } from '../../testUtils/twoFrames'
import { frameById } from '../../domain/layerRecord'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
const framed: Project = withLayers(base, { frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: {} }, beads: {} })

function setup(project: Project, expanded = false) {
  const harness = editHarness(project)
  const rotateCanvas = useRotateCanvasFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, announce: vi.fn(), messages: () => en })
  const fitView = vi.fn()
  const flow = useFitFlow({
    currentProject: harness.currentProject,
    // As the shell does: the Table back to 0°, the Canvas's own quarter turn as it is.
    turnTableBack: () => rotateCanvas.onTwistTable(quarterTurnOf(harness.currentProject()!)),
    fitView,
    frameExpanded: () => expanded,
  })
  return { harness, fitView, ...flow }
}

describe('useFitFlow (ticket 1227, spec 1234)', () => {
  it('puts the Table turn back to 0° and zooms to fit, with no Undo step', () => {
    const { harness, onFit, fitView } = setup(turnTableTo(framed, 40))
    expect(tableTurnOf(harness.project!)).toBe(40)
    onFit()
    expect(tableTurnOf(harness.project!)).toBe(0)
    expect(orientationOf(harness.project)).toBe(0)
    expect(fitView).toHaveBeenCalledOnce()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('keeps the Canvas\'s own quarter turn, and every Frame\'s centre and quarter turn as they were', () => {
    const turned = turnTableTo(withFrameFields(withCanvas(framed, { orientation: 90 }), { angle: 180 }, frameIdIn(framed)), 130)
    const { harness, onFit } = setup(turned)
    onFit()
    expect(tableTurnOf(harness.project!)).toBe(0)
    expect(orientationOf(harness.project)).toBe(90)
    expect(frameOf(harness.project)).toMatchObject({ angle: 180, centre: frameOf(turned)!.centre })
  })

  it('leaves a Table at 0° as it is, and only fits the view', () => {
    const turned = withFrameFields(framed, { angle: 90 }, frameIdIn(framed))
    const { harness, onFit, fitView } = setup(turned)
    onFit()
    expect(harness.project).toBe(turned)
    expect(harness.history.canUndo.value).toBe(false)
    expect(fitView).toHaveBeenCalledOnce()
  })

  it('only fits the expanded Frame, whose turns are its own', () => {
    const leaning = turnTableTo(framed, 40)
    const { harness, onFit, fitView } = setup(leaning, true)
    onFit()
    expect(harness.project).toBe(leaning)
    expect(fitView).toHaveBeenCalledOnce()
  })

  it('leaves every Frame where it lies (ticket 1220)', () => {
    const pair = turnTableTo(withFrameFields(twoFrames(), { angle: 90 }, SECOND), 25)
    const { harness, onFit } = setup(pair)
    onFit()
    for (const ref of [firstOf(pair), SECOND]) expect(frameById(harness.project, ref)).toEqual(frameById(pair, ref))
  })
})

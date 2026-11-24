import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { frameOf, orientationOf, withCanvas, withFrameFields } from '../../domain/layerRecord'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { withLayers } from '../../testUtils/layerFields'
import { useDialogs } from '../shell/useDialogs'
import { useRotateCanvasFlow } from './useRotateCanvasFlow'
import { useRotateFrameFlow } from '../tools/useRotateFrameFlow'
import { useFitFlow } from './useFitFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
const framed: Project = withLayers(base, { frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: {} }, beads: {} })

function setup(project: Project, expanded = false) {
  const harness = editHarness(project)
  const dialogs = useDialogs()
  const rotateFrame = useRotateFrameFlow({ edit: harness.edit, currentProject: harness.currentProject, announce: vi.fn(), messages: () => en, locale: () => 'en', dialogs })
  const rotateCanvas = useRotateCanvasFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, announce: vi.fn(), messages: () => en })
  const fitView = vi.fn()
  const flow = useFitFlow({
    currentProject: harness.currentProject,
    turnCanvasBack: () => rotateCanvas.onTwistCanvas(0),
    settleFrame: (angle) => rotateFrame.onTwistFrame(angle),
    fitView,
    frameExpanded: () => expanded,
  })
  return { harness, dialogs, fitView, ...flow }
}

describe('useFitFlow (ticket 1227)', () => {
  it('puts a turned Canvas back to 0° and zooms to fit, with no Undo step', () => {
    const { harness, onFit, fitView } = setup(withCanvas(framed, { orientation: 90 }))
    onFit()
    expect(orientationOf(harness.project)).toBe(0)
    expect(fitView).toHaveBeenCalledOnce()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('settles a leaning Frame onto its nearest quarter turn as one Undo step, which brings the lean back', () => {
    const { harness, onFit } = setup(withFrameFields(framed, { angle: 40 }))
    onFit()
    expect(frameOf(harness.project)!.angle).toBe(0)
    harness.history.onUndo()
    expect(frameOf(harness.project)!.angle).toBe(40)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('leaves a Frame on a quarter turn as it is, and a Canvas at 0°', () => {
    const turned = withFrameFields(framed, { angle: 90 })
    const { harness, onFit, fitView } = setup(turned)
    onFit()
    expect(harness.project).toBe(turned)
    expect(harness.history.canUndo.value).toBe(false)
    expect(fitView).toHaveBeenCalledOnce()
  })

  it('does both in one Fit, only the Frame an Undo step', () => {
    const { harness, onFit } = setup(withFrameFields(withCanvas(framed, { orientation: 180 }), { angle: 140 }))
    onFit()
    expect(orientationOf(harness.project)).toBe(0)
    expect(frameOf(harness.project)!.angle).toBe(180)
    harness.history.onUndo()
    expect(frameOf(harness.project)!.angle).toBe(140)
    expect(orientationOf(harness.project)).toBe(0)
  })

  it('settles through Rotate Frame\'s own rule: a lean about the quarter turn its rows are read by asks nothing and keeps them', () => {
    const woven = moveToRow(withFrameFields(framed, { angle: 40 }), 1)
    const { harness, dialogs, onFit, fitView } = setup(woven)
    onFit()
    expect(dialogs.open.value).toBeUndefined()
    expect(frameOf(harness.project)!.angle).toBe(0)
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(woven))
    expect(fitView).toHaveBeenCalledOnce()
  })

  it('hands the settle to the flow that asks, as Rotate Frame does', () => {
    const settleFrame = vi.fn()
    const flow = useFitFlow({ currentProject: () => withFrameFields(framed, { angle: 140 }), turnCanvasBack: vi.fn(), settleFrame, fitView: vi.fn(), frameExpanded: () => false })
    flow.onFit()
    expect(settleFrame).toHaveBeenCalledExactlyOnceWith(180)
  })

  it('only fits the expanded Frame, whose turns are its own', () => {
    const leaning = withFrameFields(withCanvas(framed, { orientation: 90 }), { angle: 40 })
    const { harness, onFit, fitView } = setup(leaning, true)
    onFit()
    expect(harness.project).toBe(leaning)
    expect(fitView).toHaveBeenCalledOnce()
  })
})

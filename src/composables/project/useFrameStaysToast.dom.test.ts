import { describe, expect, it, vi } from 'vitest'
import { findBead } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { withFrame } from '../../domain/frame'
import { beadIdOfLayer, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { replaceBead } from '../../domain/projectBead'
import { moveToRow } from '../../domain/rowProgress'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import type { ToastAction } from '../ui/useToasts'
import { useFrameFlow } from './useFrameFlow'
import { useFrameStaysToast } from './useFrameStaysToast'

/** A peyote bracelet with a Frame, both layers peyote in TOHO Cube. */
const framed = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 8, height: 6, unit: 'beads' } })
const unframed = withFrame(framed, undefined)

function setup(project: Project = framed) {
  const harness = editHarness(project)
  const frameFlow = useFrameFlow({
    currentProject: harness.currentProject,
    edit: harness.edit,
    hold: harness.editing.hold,
    settle: harness.editing.settle,
    announce: vi.fn(),
    showToast: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
    centreOn: vi.fn(),
    visibleCentre: vi.fn(() => ({ row: 0, column: 0 })),
  })
  const showToast = vi.fn()
  const requestFrameBead = vi.fn()
  const openFrameSettings = vi.fn()
  const stays = useFrameStaysToast({
    currentProject: harness.currentProject,
    messages: () => en,
    showToast,
    setFrameTechnique: (technique) => stays.afterChange('technique', () => frameFlow.setLayerTechnique('frame', technique)),
    requestFrameBead,
    openFrameSettings,
  })
  const setTechnique = (layer: 'canvas' | 'frame', technique: 'loom' | 'peyote' | 'brick') => stays.afterChange('technique', () => frameFlow.setLayerTechnique(layer, technique))
  /** Replace Bead's confirmed change, which waits for its Color catalog first. */
  const setBead = (layer: 'canvas' | 'frame', beadId: string) =>
    stays.afterChange('bead', async () => {
      await Promise.resolve()
      harness.edit('exempt', (current) => replaceBead(current, findBead(beadId)!, undefined, layer))
    })
  /** The last toast's actions, first and second. */
  const actions = () => {
    const [, , , first, options] = showToast.mock.calls.at(-1) as [string, string, string, ToastAction, { secondAction?: ToastAction } | undefined]
    return [first, options?.secondAction]
  }
  return { harness, showToast, requestFrameBead, openFrameSettings, setTechnique, setBead, actions }
}

describe('useFrameStaysToast (ticket 0935)', () => {
  it('says the Frame stays on its Technique after the Canvas changes, with Change the Frame too and Open Frame', () => {
    const { showToast, setTechnique, actions } = setup()
    setTechnique('canvas', 'loom')
    expect(showToast).toHaveBeenCalledWith('frame-stays', 'The Canvas is Loom now. The Frame stays Peyote.', 'info', expect.anything(), expect.anything())
    expect(actions().map((action) => action?.label)).toEqual(['Change the Frame too', 'Open Frame'])
  })

  it("weaves the Frame in the Canvas's Technique on Change the Frame too, one Undo step that brings it back", () => {
    const { harness, showToast, setTechnique, actions } = setup()
    setTechnique('canvas', 'loom')
    actions()[0]!.run()
    expect(layerOf(harness.project, 'frame')!.weave.technique).toBe('loom')
    expect(showToast).toHaveBeenCalledTimes(1)
    harness.history.onUndo()
    expect(layerOf(harness.project, 'frame')!.weave.technique).toBe('peyote')
    expect(layerOf(harness.project, 'canvas').weave.technique).toBe('loom')
  })

  it('opens the Frame panel on its settings on Open Frame', () => {
    const { openFrameSettings, setTechnique, actions } = setup()
    setTechnique('canvas', 'brick')
    actions()[1]!.run()
    expect(openFrameSettings).toHaveBeenCalledOnce()
  })

  it('says nothing with no Frame, when the Frame matches, for a change that changed nothing, or for the Frame’s own change', () => {
    const none = setup(unframed)
    none.setTechnique('canvas', 'loom')
    const matching = setup(framed)
    matching.setTechnique('frame', 'loom')
    matching.setTechnique('canvas', 'loom')
    matching.setTechnique('canvas', 'loom')
    expect(none.showToast).not.toHaveBeenCalled()
    expect(matching.showToast).not.toHaveBeenCalled()
  })

  it('offers only Open Frame where the Frame cannot take the Technique, a pass being done', () => {
    const { showToast, setTechnique, actions } = setup(moveToRow(framed, 1))
    setTechnique('canvas', 'loom')
    expect(showToast).toHaveBeenCalledOnce()
    expect(actions().map((action) => action?.label)).toEqual(['Open Frame', undefined])
  })

  it('says the Frame stays on its Bead after the Canvas takes another, and asks the Frame panel’s Replace Bead on Change the Frame too', async () => {
    const { harness, showToast, requestFrameBead, setBead, actions } = setup()
    await setBead('canvas', 'miyuki/delica/11-0')
    expect(beadIdOfLayer(harness.project, 'canvas')).toBe('miyuki/delica/11-0')
    expect(showToast.mock.calls[0]?.[1]).toBe('The Canvas is Miyuki Delica 11/0 now. The Frame stays TOHO Cube 1.5mm.')
    actions()[0]!.run()
    expect(requestFrameBead).toHaveBeenCalledWith('miyuki/delica/11-0')
    await setBead('frame', 'miyuki/delica/11-0')
    expect(showToast).toHaveBeenCalledOnce()
  })
})

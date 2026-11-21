import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { withFrame } from '../../domain/frame'
import { createProject } from '../../domain/createProject'
import { frameOf } from '../../domain/layerRecord'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { withLayers } from '../../testUtils/layerFields'
import { useLiftFrameFlow } from './useLiftFrameFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
const framed = withLayers(base, { frame: { technique: 'loom' as const, row: 2, column: 2, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: '#e63746' }]) } })

function setup() {
  const harness = editHarness(framed)
  const announce = vi.fn()
  return { harness, announce, ...useLiftFrameFlow({ edit: harness.edit, currentProject: harness.currentProject, announce, messages: () => en }) }
}

describe('useLiftFrameFlow (ticket 1177)', () => {
  it('lifts a Frame that lies flat as one Undo step and says so, then lays it flat again', () => {
    const { harness, announce, onToggleLift } = setup()
    onToggleLift()
    expect(frameOf(harness.project)?.lifted).toBe(true)
    expect(announce).toHaveBeenLastCalledWith('Pieces lifted')
    onToggleLift()
    expect(frameOf(harness.project)?.lifted).toBeUndefined()
    expect(announce).toHaveBeenLastCalledWith('Pieces laid flat')
    harness.history.onUndo()
    expect(frameOf(harness.project)?.lifted).toBe(true)
  })

  it('changes no bead and does nothing without a Frame', () => {
    const { harness, onToggleLift } = setup()
    onToggleLift()
    expect(frameOf(harness.project)?.beads).toEqual(frameOf(framed)?.beads)
    const unframed = withFrame(base, undefined)
    const none = editHarness(unframed)
    const flow = useLiftFrameFlow({ edit: none.edit, currentProject: none.currentProject, announce: vi.fn(), messages: () => en })
    flow.onToggleLift()
    expect(none.project).toBe(unframed)
  })
})

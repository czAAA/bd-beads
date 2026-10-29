import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { backgroundOf, withBackground } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { moveToRow } from '../../domain/rowProgress'
import { editHarness } from '../../testUtils/editHarness'
import { useBackgroundFlow } from './useBackgroundFlow'

const framed = (): Project => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

function setup(project: Project | undefined) {
  const harness = editHarness(project)
  const remember = vi.fn()
  const deps = { currentProject: harness.currentProject, replaceProject: harness.replaceProject, remember, start: () => 2 }
  return { harness, remember, ...useBackgroundFlow(deps) }
}

describe('useBackgroundFlow (ticket 0666)', () => {
  it('sets the Canvas\'s and the Frame\'s Background each on its own, saved with the Project and no Undo step', () => {
    const { harness, setBackground } = setup(framed())
    setBackground('canvas', 3)
    setBackground('frame', '#336699')
    expect(backgroundOf(harness.project, 'canvas')).toBe(3)
    expect(backgroundOf(harness.project, 'frame')).toBe('#336699')
    expect(harness.replaceProject).toHaveBeenCalledTimes(2)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('keeps the last one picked on the device, as the Background a new Project starts with', () => {
    const { remember, setBackground } = setup(framed())
    setBackground('frame', '#336699')
    expect(remember).toHaveBeenCalledWith('#336699')
  })

  it('keeps the other layer on what it showed when it had none, so a pick never moves it (ticket 0666)', () => {
    const { harness, setBackground } = setup(framed())
    setBackground('frame', '#336699')
    expect(backgroundOf(harness.project, 'canvas')).toBe(2)
  })

  it('still sets it once a Row progress pass is done', () => {
    const { harness, setBackground } = setup(moveToRow(framed(), 2))
    setBackground('frame', 5)
    expect(backgroundOf(harness.project, 'frame')).toBe(5)
  })

  it('writes nothing for the Background a layer already has, or with no Project open', () => {
    const { harness, setBackground } = setup(withBackground(withBackground(framed(), 'canvas', 2), 'frame', 5))
    setBackground('canvas', 2)
    expect(harness.replaceProject).not.toHaveBeenCalled()
    const none = setup(undefined)
    none.setBackground('canvas', 4)
    expect(none.harness.replaceProject).not.toHaveBeenCalled()
    expect(none.remember).not.toHaveBeenCalled()
  })
})

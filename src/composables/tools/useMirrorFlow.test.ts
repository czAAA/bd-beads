import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createProject } from '../../domain/createProject'
import { canvasAxesOf, MIRROR_OFF, mirrorSettingOf, withAxisToggled, withMirror } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { useMirrorFlow } from './useMirrorFlow'

function setup(initial?: Project) {
  const project = shallowRef<Project | undefined>(initial ?? createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }))
  const replaceProject = vi.fn((next: Project) => void (project.value = next))
  const flow = useMirrorFlow({ currentProject: () => project.value, replaceProject, edit: () => ({ kind: 'unchanged' }), viewCentre: () => undefined })
  return { flow, project, replaceProject }
}

describe('useMirrorFlow (ticket 0703)', () => {
  it('reads the open Project\'s setting, off for a new one, with the Frame\'s count limits', () => {
    const { flow } = setup()
    expect(flow.setting.value).toEqual(MIRROR_OFF)
    expect(flow.on.value).toBe(false)
    expect(flow.limits.value).toEqual({ leftRight: 4, topBottom: 2 })
  })

  it('puts a changed setting on the Project without an Undo step, and the tile lights while the mode is not Off', () => {
    const { flow, project, replaceProject } = setup()
    flow.update({ ...MIRROR_OFF, mode: 'repeat' })
    expect(replaceProject).toHaveBeenCalledTimes(1)
    expect(mirrorSettingOf(project.value!)).toEqual({ ...MIRROR_OFF, mode: 'repeat' })
    expect(flow.on.value).toBe(true)
  })

  it('key 8 toggles the mode with its last settings: Mirror with Left–right first, off, then back to Repeat as it was', () => {
    const { flow } = setup()
    flow.toggle()
    expect(flow.setting.value).toEqual({ ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, leftRight: true } })
    flow.update({ ...flow.setting.value, mode: 'repeat' })
    flow.toggle()
    expect(flow.setting.value.mode).toBe('off')
    flow.toggle()
    expect(flow.setting.value).toEqual({ ...MIRROR_OFF, mode: 'repeat', axes: { ...MIRROR_OFF.axes, leftRight: true } })
  })

  it('opens and closes the popover from the tile, and does nothing with no Project open', () => {
    const { flow } = setup()
    flow.togglePopover()
    expect(flow.popoverOpen.value).toBe(true)
    flow.togglePopover()
    expect(flow.popoverOpen.value).toBe(false)

    const { flow: none, replaceProject } = setup()
    none.toggle()
    expect(replaceProject).toHaveBeenCalledTimes(1)
    const empty = useMirrorFlow({ currentProject: () => undefined, replaceProject, edit: () => ({ kind: 'unchanged' }), viewCentre: () => undefined })
    empty.toggle()
    expect(replaceProject).toHaveBeenCalledTimes(1)
    expect(empty.setting.value).toEqual(MIRROR_OFF)
    expect(empty.limits.value).toBeUndefined()
  })

  it('a Project opened with Mirror on shows it on, as saved', () => {
    const saved = withMirror(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }), { ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, topBottom: true } })
    expect(setup(saved).flow.on.value).toBe(true)
  })
})

describe('the Canvas\'s Axes and their handles (ticket 0704)', () => {
  /** The flow over a real Edit and Undo, the view's middle over a loom position's centre or a point between two. */
  function withView(centre: { x: number; y: number } | null = { x: 73, y: 10 }) {
    const harness = editHarness(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }))
    const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit, viewCentre: () => centre ?? undefined })
    return { flow, harness, axes: () => canvasAxesOf(harness.project!) }
  }

  it('places an Axis through the view\'s centre, snapped, when its direction goes on, and keeps it when it goes off and on', () => {
    const { flow, axes, harness } = withView()
    expect(flow.canvasAxes.value).toEqual({})
    flow.update(withAxisToggled(MIRROR_OFF, 'leftRight'))
    expect(axes()).toEqual({ leftRight: 3 })
    expect(flow.canvasAxes.value).toEqual({ leftRight: 3 })
    expect(harness.history.canUndo.value).toBe(false)

    flow.update(withAxisToggled(flow.setting.value, 'leftRight'))
    expect(axes()).toEqual({ leftRight: 3 })
    expect(flow.canvasAxes.value).toEqual({})
    flow.update({ ...flow.setting.value, axes: { ...flow.setting.value.axes, leftRight: true, topBottom: true } })
    expect(axes()).toEqual({ leftRight: 3, topBottom: 0 })
  })

  it('places Left–right at the origin when key 8 turns Mirror on before the view is measured', () => {
    const { flow, axes } = withView(null)
    flow.toggle()
    expect(axes()).toEqual({ leftRight: 0 })
  })

  it('shows no Canvas Axis in Repeat mode: with no edge there is no strip to repeat (spec 0702)', () => {
    const { flow } = withView()
    flow.update({ ...withAxisToggled(MIRROR_OFF, 'leftRight'), mode: 'repeat' })
    expect(flow.canvasAxes.value).toEqual({})
  })

  it('drags a handle to a snapped position, shown as it goes and saved on release as one Undo step; a release without a move is none', () => {
    const { flow, axes, harness } = withView()
    flow.update(withAxisToggled(MIRROR_OFF, 'leftRight'))
    flow.pressAxis('leftRight')
    expect(flow.heldAxis.value).toBe('leftRight')
    flow.dragAxis('leftRight', 118)
    expect(flow.canvasAxes.value).toEqual({ leftRight: 5.5 })
    expect(axes()).toEqual({ leftRight: 3 })
    flow.releaseAxis()
    expect(flow.heldAxis.value).toBeUndefined()
    expect(axes()).toEqual({ leftRight: 5.5 })
    expect(harness.history.canUndo.value).toBe(true)
    harness.history.onUndo()
    expect(axes()).toEqual({ leftRight: 3 })
    expect(harness.history.canUndo.value).toBe(false)

    flow.pressAxis('leftRight')
    flow.releaseAxis()
    expect(harness.history.canUndo.value).toBe(false)
  })
})

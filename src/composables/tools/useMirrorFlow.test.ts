import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createProject } from '../../domain/createProject'
import { changeFrame } from '../../domain/changeFrame'
import { canvasAxesOf, MIRROR_OFF, mirrorAreaOf, mirrorSettingOf, withAxisToggled, withMirror } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useMirrorFlow } from './useMirrorFlow'

/** No Edit and no measured view: the setting tests need neither; the toasts are counted. */
const showToast = vi.fn()
const NO_VIEW = { edit: () => ({ kind: 'unchanged' as const }), viewCentre: () => undefined, showToast, messages: () => en }

function setup(initial?: Project) {
  const project = shallowRef<Project | undefined>(initial ?? createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }))
  const replaceProject = vi.fn((next: Project) => void (project.value = next))
  const flow = useMirrorFlow({ currentProject: () => project.value, replaceProject, ...NO_VIEW })
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
    const empty = useMirrorFlow({ currentProject: () => undefined, replaceProject, ...NO_VIEW })
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
    const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit, viewCentre: () => centre ?? undefined, showToast, messages: () => en })
    return { flow, harness, axes: () => canvasAxesOf(harness.project!) }
  }

  it('places an Axis through the view\'s centre, snapped, each time its direction goes on, with no Undo step; Off keeps it', () => {
    const { flow, axes, harness } = withView()
    expect(flow.canvasAxes.value).toEqual({})
    flow.update(withAxisToggled(MIRROR_OFF, 'leftRight'))
    expect(axes()).toEqual({ leftRight: 3 })
    expect(flow.canvasAxes.value).toEqual({ leftRight: 3 })
    expect(harness.history.canUndo.value).toBe(false)

    flow.update(withAxisToggled(flow.setting.value, 'leftRight'))
    expect(axes()).toEqual({ leftRight: 3 })
    expect(flow.canvasAxes.value).toEqual({})
    flow.toggle()
    expect(axes()).toEqual({ leftRight: 3 })
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
    flow.dragAxis('leftRight', { x: 118, y: 0 })
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

  it('places Radial\'s centre at the view\'s middle when it goes on, shows it in Repeat mode too, and drags it to a position or a corner as one Undo step (ticket 0705)', () => {
    const { flow, axes, harness } = withView()
    flow.update(withAxisToggled(MIRROR_OFF, 'radial'))
    expect(axes()).toEqual({ centre: { row: 0, column: 3 } })
    expect(flow.canvasAxes.value).toEqual({ centre: { row: 0, column: 3 } })
    expect(harness.history.canUndo.value).toBe(false)
    flow.update({ ...flow.setting.value, mode: 'repeat' })
    expect(flow.canvasAxes.value).toEqual({ centre: { row: 0, column: 3 } })

    flow.pressAxis('radial')
    expect(flow.heldAxis.value).toBe('radial')
    flow.dragAxis('radial', { x: 118, y: 44 })
    expect(flow.canvasAxes.value).toEqual({ centre: { row: 1.5, column: 5.5 } })
    expect(axes()).toEqual({ centre: { row: 0, column: 3 } })
    flow.releaseAxis()
    expect(axes()).toEqual({ centre: { row: 1.5, column: 5.5 } })
    expect(harness.history.canUndo.value).toBe(true)
    harness.history.onUndo()
    expect(axes()).toEqual({ centre: { row: 0, column: 3 } })

    // Radial off brings the straight Axes back; its centre stays placed for next time and is not shown.
    flow.update(withAxisToggled(flow.setting.value, 'radial'))
    expect(flow.canvasAxes.value).toEqual({})
    expect(axes()).toEqual({ centre: { row: 0, column: 3 } })
  })
})

describe('the Area (ticket 0710, spec 0702)', () => {
  /** The flow over a real Edit on a 5 × 3 loom Frame, or on the open Canvas with the Frame removed. */
  function framed(open = false) {
    let project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } })
    if (open) project = (changeFrame(project, { remove: true }) as { project: Project }).project
    const harness = editHarness(project)
    showToast.mockClear()
    const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit, viewCentre: () => ({ x: 73, y: 10 }), showToast, messages: () => en })
    return { flow, harness }
  }

  it('Select area closes the popover and picks; a drag over the beads draws the band and the release sets the Area as one Undo step, the popover back, a toast saying so, and Mirror on with Left–right if it was Off', () => {
    const { flow, harness } = framed()
    expect(flow.areaRow.value).toBe('frame')
    expect(flow.area.value).toBeUndefined()
    flow.togglePopover()
    flow.startPick()
    expect(flow.popoverOpen.value).toBe(false)
    expect(flow.picking.value).toBe(true)
    flow.pressArea({ row: 2, column: 4 })
    flow.dragArea({ row: 0, column: 9 })
    expect(flow.band.value).toEqual({ row: 0, column: 4, rows: 3, columns: 1 })
    flow.releaseArea()
    expect(flow.picking.value).toBe(false)
    expect(flow.band.value).toBeUndefined()
    expect(flow.popoverOpen.value).toBe(true)
    expect(flow.area.value).toEqual({ row: 0, column: 4, rows: 3, columns: 1 })
    expect(mirrorAreaOf(harness.project!, 'frame')).toEqual({ row: 0, column: 4, rows: 3, columns: 1 })
    expect(flow.setting.value).toEqual({ ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, leftRight: true } })
    expect(showToast).toHaveBeenCalledWith('mirror-area', 'Area 1 × 3: the Axes run inside it', 'info')
    expect(flow.limits.value).toEqual({ leftRight: 1, topBottom: 2 })
    harness.history.onUndo()
    expect(flow.area.value).toBeUndefined()
  })

  it('Whole Frame makes the Frame the Area, picking or not, with its toast; Clear the area removes it; a pick keeps the Axes as they were', () => {
    const { flow, harness } = framed()
    flow.update(withAxisToggled({ ...MIRROR_OFF, mode: 'repeat' }, 'topBottom'))
    flow.startPick()
    flow.pickWholeFrame()
    expect(flow.picking.value).toBe(false)
    expect(flow.area.value).toEqual({ row: 0, column: 0, rows: 3, columns: 5 })
    expect(flow.setting.value.mode).toBe('repeat')
    expect(flow.setting.value.axes).toEqual({ ...MIRROR_OFF.axes, topBottom: true })
    expect(showToast).toHaveBeenLastCalledWith('mirror-area', 'The whole Frame is the area', 'info')
    flow.clearArea()
    expect(flow.area.value).toBeUndefined()
    expect(mirrorAreaOf(harness.project!, 'frame')).toBeUndefined()
    expect(harness.history.canUndo.value).toBe(true)
  })

  it('Escape or the tile cancels a pick, reopening the popover with nothing set; a release with no press sets nothing', () => {
    const { flow } = framed()
    flow.startPick()
    flow.pressArea({ row: 0, column: 0 })
    expect(flow.cancelPick()).toBe(true)
    expect(flow.picking.value).toBe(false)
    expect(flow.band.value).toBeUndefined()
    expect(flow.popoverOpen.value).toBe(true)
    expect(flow.area.value).toBeUndefined()
    expect(flow.cancelPick()).toBe(false)
    flow.startPick()
    flow.togglePopover()
    expect(flow.picking.value).toBe(false)
    expect(flow.popoverOpen.value).toBe(true)
    flow.releaseArea()
    expect(flow.area.value).toBeUndefined()
  })

  it('on the open Canvas the Area is the Canvas layer\'s, the handles give way to it, and the count limits are its beads minus 1', () => {
    const { flow, harness } = framed(true)
    expect(flow.areaRow.value).toBe('canvas')
    flow.update(withAxisToggled(MIRROR_OFF, 'leftRight'))
    expect(flow.canvasAxes.value).toEqual({ leftRight: 3 })
    flow.startPick()
    flow.pressArea({ row: -1, column: 2 })
    flow.dragArea({ row: 1, column: 7 })
    flow.releaseArea()
    expect(mirrorAreaOf(harness.project!, 'canvas')).toEqual({ row: -1, column: 2, rows: 3, columns: 6 })
    expect(flow.canvasAxes.value).toEqual({})
    expect(flow.limits.value).toEqual({ leftRight: 5, topBottom: 2 })
    flow.clearArea()
    expect(flow.canvasAxes.value).toEqual({ leftRight: 3 })
  })
})

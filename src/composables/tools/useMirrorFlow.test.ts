import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { changeFrame } from '../../domain/changeFrame'
import { MIRROR_OFF, mirrorSettingOf, withAxisToggled, withMirrorMode } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { useMirrorFlow } from './useMirrorFlow'

/** The flow over a real Edit and Undo history, on a 5 × 3 loom Frame or, `open`, the Canvas with the Frame removed. */
function setup(open = false) {
  let project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } })
  if (open) project = (changeFrame(project, { remove: true }) as { project: Project }).project
  const harness = editHarness(project)
  const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit })
  return { flow, harness }
}

const area = { row: 1, column: 2, rows: 3, columns: 6 }

describe('useMirrorFlow (ADR 0082, ticket 0750)', () => {
  it('is off for a new Project, and off with no Project open', () => {
    const { flow } = setup()
    expect(flow.setting.value).toEqual(MIRROR_OFF)
    expect(flow.on.value).toBe(false)
    expect(flow.rect.value).toBeUndefined()
    const none = useMirrorFlow({ currentProject: () => undefined, replaceProject: () => {}, edit: () => ({ kind: 'unchanged' }) })
    expect(none.setting.value).toEqual(MIRROR_OFF)
  })

  it('makes the Mirror from a rectangle as one Undo step, Mirror mode with Left–right, its Area as a Selection for the handles', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    expect(flow.on.value).toBe(true)
    expect(flow.setting.value.place).toEqual({ layer: 'canvas', area })
    expect(flow.setting.value.axes).toEqual({ leftRight: true, topBottom: false, radial: false })
    expect(flow.rect.value).toEqual(area)
    expect(flow.areaSelection.value).toEqual({ top: 1, left: 2, rows: 3, columns: 6, layer: 'canvas' })
    harness.history.onUndo()
    expect(flow.on.value).toBe(false)
  })

  it('puts the bar\'s settings on the Project with no Undo step, and Undo of the place keeps them', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    flow.update(withMirrorMode(withAxisToggled(flow.setting.value, 'topBottom'), 'repeat'))
    expect(mirrorSettingOf(harness.project!)).toMatchObject({ mode: 'repeat', axes: { leftRight: true, topBottom: true }, place: { layer: 'canvas', area } })
    flow.makeFrom({ row: 0, column: 0, rows: 4, columns: 4 })
    harness.history.onUndo()
    expect(mirrorSettingOf(harness.project!)).toMatchObject({ mode: 'repeat', axes: { topBottom: true }, place: { layer: 'canvas', area } })
  })

  it('mirrors the whole Frame, its rect the Frame\'s, and closes as one Undo step keeping the settings', () => {
    const { flow, harness } = setup()
    flow.placeWholeFrame()
    expect(flow.onFrame.value).toBe(true)
    expect(flow.rect.value).toEqual({ row: 0, column: 0, rows: 3, columns: 5 })
    expect(flow.areaSelection.value).toBeUndefined()
    flow.update(withMirrorMode(flow.setting.value, 'repeat'))
    flow.close()
    expect(flow.on.value).toBe(false)
    expect(flow.setting.value.mode).toBe('repeat')
    harness.history.onUndo()
    expect(flow.onFrame.value).toBe(true)
  })

  it('resizes and moves the Area with its handles as the Selection is, drawn as it goes and saved as one Undo step on release', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    flow.pressArea({ kind: 'handle', edges: ['right'] }, { row: 2, column: 7 })
    flow.dragArea({ row: 2, column: 9 })
    expect(flow.adjusting.value).toBe(true)
    expect(flow.setting.value.place).toEqual({ layer: 'canvas', area: { ...area, columns: 8 } })
    expect(mirrorSettingOf(harness.project!).place).toEqual({ layer: 'canvas', area })
    flow.releaseArea()
    expect(flow.adjusting.value).toBe(false)
    expect(mirrorSettingOf(harness.project!).place).toEqual({ layer: 'canvas', area: { ...area, columns: 8 } })

    flow.pressArea({ kind: 'inside' }, { row: 2, column: 4 })
    flow.dragArea({ row: 4, column: 3 })
    flow.releaseArea()
    expect(flow.setting.value.place).toEqual({ layer: 'canvas', area: { row: 3, column: 1, rows: 3, columns: 8 } })
    harness.history.onUndo()
    expect(flow.setting.value.place).toEqual({ layer: 'canvas', area: { ...area, columns: 8 } })
  })

  it('records nothing for a press that never moved the Area, nor for a release with no press', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    flow.pressArea({ kind: 'inside' }, { row: 2, column: 4 })
    flow.dragArea({ row: 2, column: 4 })
    flow.releaseArea()
    flow.releaseArea()
    harness.history.onUndo()
    expect(flow.on.value).toBe(false)
  })
})

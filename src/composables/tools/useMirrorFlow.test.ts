import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { changeFrame } from '../../domain/changeFrame'
import { MIRROR_OFF, mirrorSettingOf, withAxisToggled, withMirrorCount, withMirrorFold, withMirrorMode } from '../../domain/mirror'
import { en } from '../../i18n/en'
import type { Project } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { withLayers } from '../../testUtils/layerFields'
import { useMirrorFlow } from './useMirrorFlow'

/** The flow over a real Edit and Undo history, on a 5 × 3 loom Frame or, `open`, the Canvas with the Frame removed. */
function setup(open = false) {
  let project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } })
  if (open) project = (changeFrame(project, { remove: true }) as { project: Project }).project
  const harness = editHarness(project)
  const showToast = vi.fn()
  const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit, showToast, messages: () => en, locale: () => 'en' })
  return { flow, harness, showToast }
}

const area = { row: 1, column: 2, rows: 3, columns: 6 }

describe('useMirrorFlow (ADR 0082, ticket 0750)', () => {
  it('is off for a new Project, and off with no Project open', () => {
    const { flow } = setup()
    expect(flow.setting.value).toEqual(MIRROR_OFF)
    expect(flow.on.value).toBe(false)
    expect(flow.rect.value).toBeUndefined()
    const none = useMirrorFlow({ currentProject: () => undefined, replaceProject: () => {}, edit: () => ({ kind: 'unchanged' }), showToast: () => {}, messages: () => en, locale: () => 'en' })
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
    const fitting = { ...area, rows: 4 }
    flow.makeFrom(fitting)
    flow.update(withMirrorMode(withAxisToggled(flow.setting.value, 'topBottom'), 'repeat'))
    expect(mirrorSettingOf(harness.project!)).toMatchObject({ mode: 'repeat', axes: { leftRight: true, topBottom: true }, place: { layer: 'canvas', area: fitting } })
    flow.makeFrom({ row: 0, column: 0, rows: 4, columns: 4 })
    harness.history.onUndo()
    expect(mirrorSettingOf(harness.project!)).toMatchObject({ mode: 'repeat', axes: { topBottom: true }, place: { layer: 'canvas', area: fitting } })
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

  it('a press on the Area dropped for the Radial toolbox leaves it as it was and records nothing (ticket 1084)', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    flow.pressArea({ kind: 'inside' }, { row: 2, column: 4 })
    flow.dragArea({ row: 3, column: 4 })
    flow.dropArea()
    flow.releaseArea()
    expect(flow.adjusting.value).toBe(false)
    expect(flow.setting.value.place).toEqual({ layer: 'canvas', area })
    harness.history.onUndo()
    expect(flow.on.value).toBe(false)
  })

  it('moves the Canvas Area a bead for an arrow on its move grip, one Undo step each (ticket 0808)', () => {
    const { flow, harness } = setup(true)
    flow.makeFrom(area)
    flow.moveAreaBy(0, 1)
    flow.moveAreaBy(1, 0)
    expect(mirrorSettingOf(harness.project!).place).toEqual({ layer: 'canvas', area: { ...area, row: 2, column: 3 } })
    harness.history.onUndo()
    expect(mirrorSettingOf(harness.project!).place).toEqual({ layer: 'canvas', area: { ...area, column: 3 } })
  })

  it('holds a press that grabbed the Area until it is let go, so its drags are the Area\'s (ticket 0808)', () => {
    const { flow } = setup(true)
    flow.makeFrom(area)
    expect(flow.holding()).toBe(false)
    flow.pressArea({ kind: 'inside' }, { row: 2, column: 4 })
    expect(flow.holding()).toBe(true)
    flow.releaseArea()
    expect(flow.holding()).toBe(false)
  })

  it('grows a Canvas Area a bar setting does not fit, right and down, as one Undo step for the setting and the size, and says so (ticket 1027)', () => {
    const { flow, harness, showToast } = setup(true)
    flow.makeFrom({ row: 1, column: 2, rows: 24, columns: 25 })
    flow.update(withMirrorMode(flow.setting.value, 'repeat'))
    expect(flow.rect.value).toEqual({ row: 1, column: 2, rows: 24, columns: 26 })
    expect(showToast).toHaveBeenLastCalledWith('mirror-grown', 'Mirror area grown to 26×24 so Repeat with 1 Left–right axis lines up.', 'info')
    flow.update(withMirrorCount(flow.setting.value, 'leftRight', 2))
    expect(flow.rect.value).toEqual({ row: 1, column: 2, rows: 24, columns: 27 })

    // Back to one Axis it never shrinks to 26: Repeat's two strips grow it to 28. A count 28 fits changes nothing.
    showToast.mockClear()
    flow.update(withMirrorCount(flow.setting.value, 'leftRight', 1))
    expect(flow.rect.value?.columns).toBe(28)
    flow.update(withMirrorCount(flow.setting.value, 'leftRight', 3))
    expect(flow.rect.value?.columns).toBe(28)
    expect(showToast).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(flow.setting.value).toMatchObject({ counts: { leftRight: 2 }, place: { area: { columns: 27 } } })
    harness.history.onUndo()
    expect(flow.setting.value).toMatchObject({ mode: 'repeat', counts: { leftRight: 1 }, place: { area: { columns: 26 } } })
    harness.history.onRedo()
    expect(flow.setting.value).toMatchObject({ mode: 'repeat', counts: { leftRight: 2 }, place: { area: { columns: 27 } } })
  })

  it('says the Fold it grew a square for (ticket 1027)', () => {
    const { flow, showToast } = setup(true)
    flow.makeFrom({ row: 0, column: 0, rows: 5, columns: 8 })
    flow.update(withMirrorFold(withAxisToggled(flow.setting.value, 'radial'), 4))
    expect(flow.rect.value).toEqual({ row: 0, column: 0, rows: 8, columns: 8 })
    expect(showToast).toHaveBeenLastCalledWith('mirror-grown', 'Mirror area grown to 8×8 so Radial with Fold 4 lines up.', 'info')
  })
})

describe('the Area sticks to Fitting sizes as it is dragged, made or moved (ticket 1028)', () => {
  /** An open loom Canvas whose Area of 6 × 3 at (1, 2) holds 2 Left–right Axes in Repeat: its width goes in threes. */
  function inThrees() {
    const { flow, harness, showToast } = setup(true)
    flow.makeFrom(area)
    flow.update(withMirrorCount(withMirrorMode(flow.setting.value, 'repeat'), 'leftRight', 2))
    expect(flow.rect.value).toEqual(area)
    showToast.mockClear()
    return { flow, harness, showToast }
  }
  const placeOf = (project: Project | undefined) => mirrorSettingOf(project!).place

  it('shows a handle\'s drag only at Fitting sizes, the nearest not smaller than the pointer, and says so once on release', () => {
    const { flow, harness, showToast } = inThrees()
    flow.pressArea({ kind: 'handle', edges: ['right'] }, { row: 2, column: 7 })
    flow.dragArea({ row: 2, column: 10 })
    expect(flow.rect.value).toEqual({ ...area, columns: 9 })
    flow.dragArea({ row: 2, column: 8 })
    expect(flow.rect.value).toEqual({ ...area, columns: 9 })
    expect(showToast).not.toHaveBeenCalled()
    flow.releaseArea()
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { ...area, columns: 9 } })
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('mirror-grown', 'Mirror area grown to 9×3 so Repeat with 2 Left–right axes lines up.', 'info')
    harness.history.onUndo()
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area })
  })

  it('keeps the edge opposite a dragged handle, and never goes below the smallest Fitting size nor changes a count', () => {
    const { flow, harness, showToast } = inThrees()
    flow.pressArea({ kind: 'handle', edges: ['left'] }, { row: 2, column: 2 })
    flow.dragArea({ row: 2, column: 1 })
    expect(flow.rect.value).toEqual({ ...area, column: -1, columns: 9 })
    flow.dragArea({ row: 2, column: 7 })
    expect(flow.rect.value).toEqual({ ...area, column: 5, columns: 3 })
    flow.releaseArea()
    expect(mirrorSettingOf(harness.project!)).toMatchObject({ counts: { leftRight: 2 }, place: { area: { ...area, column: 5, columns: 3 } } })
    expect(showToast).toHaveBeenCalledTimes(1)
  })

  it('shows no Message for a drag that ends on a Fitting size, nor for a move on loom, which keeps the size', () => {
    const { flow, harness, showToast } = inThrees()
    flow.pressArea({ kind: 'handle', edges: ['right'] }, { row: 2, column: 7 })
    flow.dragArea({ row: 2, column: 10 })
    flow.releaseArea()
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { ...area, columns: 9 } })
    flow.pressArea({ kind: 'inside' }, { row: 2, column: 4 })
    flow.dragArea({ row: 3, column: 5 })
    flow.releaseArea()
    flow.moveAreaBy(0, 1)
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { row: 2, column: 4, rows: 3, columns: 9 } })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('makes an Area from a rectangle at a Fitting size for the kept settings, grown right and down, and says so', () => {
    const { flow, harness, showToast } = inThrees()
    flow.close()
    flow.makeFrom({ row: 4, column: 4, rows: 2, columns: 4 })
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { row: 4, column: 4, rows: 2, columns: 6 } })
    expect(showToast).toHaveBeenCalledWith('mirror-grown', 'Mirror area grown to 6×2 so Repeat with 2 Left–right axes lines up.', 'info')
    // A Mirror-mode drag up and left keeps the corner it started from.
    flow.makeFrom({ row: 4, column: 4, rows: 2, columns: 4 }, { leftRight: 'last', topBottom: 'last' })
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { row: 4, column: 2, rows: 2, columns: 6 } })
    harness.history.onUndo()
    expect(placeOf(harness.project)).toEqual({ layer: 'canvas', area: { row: 4, column: 4, rows: 2, columns: 6 } })
  })

  it('keeps Fold 4 on loom square as a handle is dragged', () => {
    const { flow } = setup(true)
    flow.makeFrom({ row: 0, column: 0, rows: 6, columns: 6 })
    flow.update(withMirrorFold(withAxisToggled(flow.setting.value, 'radial'), 4))
    flow.pressArea({ kind: 'handle', edges: ['right'] }, { row: 3, column: 5 })
    flow.dragArea({ row: 3, column: 8 })
    expect(flow.rect.value).toEqual({ row: 0, column: 0, rows: 9, columns: 9 })
    flow.dragArea({ row: 3, column: 3 })
    expect(flow.rect.value).toEqual({ row: 0, column: 0, rows: 4, columns: 4 })
    flow.releaseArea()
    expect(flow.setting.value.fold).toBe(4)
  })

  it('grows a moved Area on peyote with a Drop above 1 where its new place does not fit, one Undo step with the Message', () => {
    const peyote = (changeFrame(createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }), { remove: true }) as { project: Project }).project
    const harness = editHarness(withLayers(peyote, { techniqueSettings: { peyoteDrop: 2 } }))
    const showToast = vi.fn()
    const flow = useMirrorFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject, edit: harness.edit, showToast, messages: () => en, locale: () => 'en' })
    flow.makeFrom({ row: 0, column: 0, rows: 4, columns: 8 })
    const before = flow.rect.value!
    showToast.mockClear()
    const columns = [1, 2, 3].map(() => {
      flow.moveAreaBy(0, 1)
      return flow.rect.value!.columns
    })
    expect(columns.some((each) => each > before.columns)).toBe(true)
    expect(columns.every((each) => each >= before.columns)).toBe(true)
    expect(showToast).toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createProject } from '../../domain/createProject'
import { MIRROR_OFF, mirrorSettingOf, withMirror } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import { useMirrorFlow } from './useMirrorFlow'

function setup(initial?: Project) {
  const project = shallowRef<Project | undefined>(initial ?? createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 5, height: 3, unit: 'beads' } }))
  const replaceProject = vi.fn((next: Project) => void (project.value = next))
  const flow = useMirrorFlow({ currentProject: () => project.value, replaceProject })
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
    const empty = useMirrorFlow({ currentProject: () => undefined, replaceProject })
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

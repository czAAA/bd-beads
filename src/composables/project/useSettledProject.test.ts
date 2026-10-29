import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { useSettledProject } from './useSettledProject'

function projectNamed(name: string): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), name }
}

describe('useSettledProject', () => {
  it('starts as the Project', () => {
    const open = shallowRef<Project | undefined>(projectNamed('one'))

    expect(useSettledProject(() => open.value, () => false).value).toBe(open.value)
  })

  it('follows every change to the Project while nothing is being drawn', () => {
    const open = shallowRef<Project | undefined>(projectNamed('one'))
    const settled = useSettledProject(() => open.value, () => false)
    const next = projectNamed('two')

    open.value = next

    expect(settled.value).toBe(next)
  })

  it('keeps the Project from before the stroke, however many beads the stroke changes', () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(false)
    const before = open.value
    const settled = useSettledProject(() => open.value, () => drawing.value)

    drawing.value = true
    open.value = projectNamed('first')
    open.value = projectNamed('second')

    expect(settled.value).toBe(before)
  })

  it('catches up the moment the stroke ends', () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    open.value = projectNamed('first')
    const last = projectNamed('last')
    open.value = last

    drawing.value = false

    expect(settled.value).toBe(last)
  })

  it('follows a Project being closed, and another being opened', () => {
    const open = shallowRef<Project | undefined>(projectNamed('one'))
    const settled = useSettledProject(() => open.value, () => false)

    open.value = undefined
    expect(settled.value).toBeUndefined()

    const other = projectNamed('other')
    open.value = other
    expect(settled.value).toBe(other)
  })
})

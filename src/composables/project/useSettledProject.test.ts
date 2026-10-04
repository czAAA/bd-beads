import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { createProject, type Project } from '../../domain/project'
import { SUMMARY_INTERVAL_MS, useSettledProject } from './useSettledProject'

function projectNamed(name: string): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), name }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

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

  it('follows the first change of a stroke at once, so a single click shows straight away', () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(false)
    const settled = useSettledProject(() => open.value, () => drawing.value)

    drawing.value = true
    const first = projectNamed('first bead')
    open.value = first

    expect(settled.value).toBe(first)
  })

  it('then looks again only every so often, however many beads the stroke changes', async () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    const first = projectNamed('first')
    open.value = first
    expect(settled.value).toBe(first)

    open.value = projectNamed('second')
    open.value = projectNamed('third')
    const last = projectNamed('last')
    open.value = last
    expect(settled.value).toBe(first)

    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS)
    expect(settled.value).toBe(last)
  })

  it('reads the Project as it is when its turn comes, not as it was when it was asked for', async () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    open.value = projectNamed('first')

    open.value = projectNamed('second')
    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS / 2)
    const latest = projectNamed('latest')
    open.value = latest
    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS)

    expect(settled.value).toBe(latest)
  })

  it('catches up the moment the stroke ends', async () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    open.value = projectNamed('first')
    const last = projectNamed('last')
    open.value = last

    drawing.value = false
    await nextTick()

    expect(settled.value).toBe(last)
  })

  it('does not look again after the stroke has ended and it has caught up', async () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    open.value = projectNamed('first')
    open.value = projectNamed('second')
    drawing.value = false
    const after = projectNamed('after')
    open.value = after

    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS * 2)

    expect(settled.value).toBe(after)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('follows the first change of the next stroke at once as well, however soon it comes', () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledProject(() => open.value, () => drawing.value)
    open.value = projectNamed('first stroke')
    drawing.value = false

    drawing.value = true
    const next = projectNamed('second stroke')
    open.value = next

    expect(settled.value).toBe(next)
  })

  it('with an interval of Infinity, waits for the stroke to end', async () => {
    const open = shallowRef<Project | undefined>(projectNamed('before'))
    const drawing = shallowRef(true)
    const before = open.value
    const settled = useSettledProject(() => open.value, () => drawing.value, Number.POSITIVE_INFINITY)

    open.value = projectNamed('first')
    await vi.advanceTimersByTimeAsync(60_000)
    open.value = projectNamed('second')
    expect(settled.value).toBe(before)
    expect(vi.getTimerCount()).toBe(0)

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

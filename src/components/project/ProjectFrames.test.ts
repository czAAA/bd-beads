import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectFrames from './ProjectFrames.vue'
import { createProject } from '../../domain/createProject'
import { withFrameSheet } from '../../domain/frameSheet'
import { frameIdOf, withLayer } from '../../domain/layerRecord'
import { MAX_FRAMES } from '../../domain/frameLimit'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { frameIdIn } from '../../testUtils/frameId'
import { twoFrames, SECOND, firstOf } from '../../testUtils/twoFrames'
import { withLayers } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})
afterEach(() => {
  document.body.innerHTML = ''
})

const bare = (): Project => withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: undefined })
const one = (): Project => withLayers(bare(), { frame: { row: 0, column: 0, rows: 6, columns: 4, technique: 'loom', beads: {} } })
const mountFrames = (project: Project) => mount(ProjectFrames, { props: { project }, attachTo: document.body })
const headers = (wrapper: ReturnType<typeof mountFrames>) => wrapper.findAll('.panel-section').map((section) => [section.get('.panel-section__label').text(), section.get('.panel-section__header').attributes('aria-expanded')])

describe('ProjectFrames (ProjectPanel card, ticket 1222)', () => {
  it('opens "add a frame" with no Frame, over its three ways, and folds it once there is one', () => {
    const none = mountFrames(bare())
    expect(headers(none)).toEqual([['add a frame', 'true']])
    expect(none.findAll('[data-testid="frame-from-starter"], [data-testid="frame-fit"], [data-testid="frame-select"]')).toHaveLength(3)
    expect(none.get('[data-testid="project-frames-line"]').text()).toBe(en.frame.noFrameLine)
    expect(headers(mountFrames(one()))[0]).toEqual(['add a frame', 'false'])
  })

  it('lists each Frame by name with its Technique and size, open while it is the only one and folded at two or more', () => {
    const named = withLayer(one(), frameIdIn(one()), { name: 'Gerdan' })
    expect(headers(mountFrames(named))[1]).toEqual(['Gerdan', 'true'])
    const wrapper = mountFrames(withLayer(withLayer(twoFrames(), firstOf(twoFrames()), { name: 'Gerdan' }), SECOND, { name: 'Earring' }))
    expect(headers(wrapper).slice(1)).toEqual([['Gerdan', 'false'], ['Earring', 'false']])
    expect(wrapper.findAll('[data-testid="project-frame"]').map((section) => section.get('.panel-section__header').attributes('aria-label'))).toEqual(['Gerdan, Loom · 4 × 6', 'Earring, Loom · 4 × 6'])
  })

  it('calls an unnamed Frame by the default its place gives it, Frame 1, then Frame 2', () => {
    expect(headers(mountFrames(one()))[1]![0]).toBe('Frame 1')
    expect(headers(mountFrames(twoFrames())).slice(1).map(([name]) => name)).toEqual(['Frame 1', 'Frame 2'])
  })

  it('shows, exports and removes the Frame whose section it is, from the heading\'s button and from its rows', async () => {
    const wrapper = mountFrames(one())
    const id = frameIdIn(one())
    await wrapper.get('[data-testid="project-frame-show-button"]').trigger('click')
    await wrapper.get('[data-testid="project-frame-show"]').trigger('click')
    await wrapper.get('[data-testid="project-frame-export"]').trigger('click')
    await wrapper.get('[data-testid="project-frame-remove"]').trigger('click')
    expect(wrapper.emitted('show-frame')).toEqual([[id], [id]])
    expect(wrapper.emitted('export-frame')).toEqual([[id]])
    expect(wrapper.emitted('remove-frame')).toEqual([[id]])
    expect(wrapper.get('[data-testid="project-frame-remove"]').classes()).toContain('panel-item--danger')
  })

  it('disables every way to add a Frame at the most Frames, saying so, and Fit while nothing is drawn', async () => {
    let full: Project = one()
    for (let made = 1; made < MAX_FRAMES; made += 1) full = withFrameSheet(full, { rows: 4, columns: 4, beads: {}, technique: 'loom' }, { frame: frameIdOf({ id: `more-${made}` }) })
    const wrapper = mountFrames(full)
    await wrapper.get('[data-testid="project-frames-add"] .panel-section__header').trigger('click')
    for (const id of ['frame-from-starter', 'frame-fit', 'frame-select']) expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-disabled'), id).toBe('true')
    expect(wrapper.get('[data-testid="project-frames-line"]').text()).toBe('A Project holds up to 4 Frames.')
    const empty = mountFrames(bare())
    expect(empty.get('[data-testid="frame-fit"]').attributes('aria-disabled')).toBe('true')
    expect(empty.get('[data-testid="frame-select"]').attributes('aria-disabled')).toBeUndefined()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectFrames from './ProjectFrames.vue'
import ProjectThumbnail from './ProjectThumbnail.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
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
const rows = (wrapper: ReturnType<typeof mountFrames>) => wrapper.findAll('[data-testid="project-frame"]').map((row) => [row.get('.panel-list-row__name').text(), row.get('.panel-list-row__sub').text()])
const unfoldFrames = (wrapper: ReturnType<typeof mountFrames>) => wrapper.get('[data-testid="project-frames-list"] .panel-section__header').trigger('click')

describe('ProjectFrames (ProjectPanel card, ticket 1222)', () => {
  it('opens "add a frame" with no Frame, over its three ways, and folds it once there is one', () => {
    const none = mountFrames(bare())
    expect(headers(none)).toEqual([['add a frame', 'true']])
    expect(none.findAll('[data-testid="frame-from-starter"], [data-testid="frame-fit"], [data-testid="frame-select"]')).toHaveLength(3)
    expect(none.get('[data-testid="project-frames-line"]').text()).toBe(en.frame.noFrameLine)
    expect(headers(mountFrames(one()))[0]).toEqual(['add a frame', 'false'])
  })

  it('holds the Frames in one "frames" section, open while there is only one and folded at two or more (ticket 1250)', async () => {
    expect(headers(mountFrames(bare()))).toHaveLength(1)
    expect(headers(mountFrames(one()))[1]).toEqual(['frames', 'true'])
    const wrapper = mountFrames(twoFrames())
    expect(headers(wrapper).slice(1)).toEqual([['frames', 'false']])
    expect(rows(wrapper)).toEqual([])
    await unfoldFrames(wrapper)
    expect(rows(wrapper)).toHaveLength(2)
  })

  it('lists each Frame as a row with its picture, name, Technique and size', async () => {
    const wrapper = mountFrames(withLayer(withLayer(twoFrames(), firstOf(twoFrames()), { name: 'Gerdan' }), SECOND, { name: 'Earring' }))
    await unfoldFrames(wrapper)
    expect(rows(wrapper)).toEqual([['Gerdan', 'Loom · 4 × 6'], ['Earring', 'Loom · 4 × 6']])
    expect(wrapper.findAllComponents(ProjectThumbnail).map((picture) => picture.props('frame'))).toEqual([firstOf(twoFrames()), SECOND])
  })

  it('calls an unnamed Frame by the default its place gives it, Frame 1, then Frame 2', async () => {
    expect(rows(mountFrames(one()))[0]![0]).toBe('Frame 1')
    const wrapper = mountFrames(twoFrames())
    await unfoldFrames(wrapper)
    expect(rows(wrapper).map(([name]) => name)).toEqual(['Frame 1', 'Frame 2'])
  })

  it('shows, exports and removes a Frame from the icon buttons always on its row, each named with the Frame', async () => {
    const wrapper = mountFrames(one())
    const id = frameIdIn(one())
    const buttons = ['show', 'export', 'remove'].map((what) => wrapper.get(`[data-testid="project-frame-${what}"]`))
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([`${en.frame.showFrame}: Frame 1`, `${en.frame.exportThisFrame}: Frame 1`, `${en.frame.removeThisFrame}: Frame 1`])
    for (const button of buttons) await button.trigger('click')
    expect(wrapper.emitted('show-frame')).toEqual([[id]])
    expect(wrapper.emitted('export-frame')).toEqual([[id]])
    expect(wrapper.emitted('remove-frame')).toEqual([[id]])
  })

  it('closes the panel for Export and Remove, which open something else, and keeps it for Show', async () => {
    const close = vi.fn()
    const wrapper = mount(ProjectFrames, { props: { project: one() }, global: { provide: { [PANEL_CONTEXT as symbol]: { close, openSub: () => {} } } } })
    await wrapper.get('[data-testid="project-frame-show"]').trigger('click')
    expect(close).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="project-frame-export"]').trigger('click')
    await wrapper.get('[data-testid="project-frame-remove"]').trigger('click')
    expect(close).toHaveBeenCalledTimes(2)
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

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectsLibrary from './ProjectsLibrary.vue'
import { createProject, summarizeProject, type Project } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const make = (name: string, extra: Partial<Parameters<typeof createProject>[0]> = {}) =>
  createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 4, height: 4, unit: 'beads' }, ...extra })
const first = make('Moth', { makerName: 'Ada' })
const second = make('Fern')
const noFrame = (project: Project): Project => ({ ...project, frame: undefined })

function mountLibrary(props: Record<string, unknown> = {}) {
  return mount(ProjectsLibrary, { props: { projects: [first, second], ...props }, global: { stubs: { ProjectThumbnail: true } } })
}

describe('ProjectsLibrary (ticket 0553)', () => {
  it('lists each project with its name, maker and Pieces count, newest first', () => {
    const rows = mountLibrary().findAll('[data-testid="project-item"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Moth')
    expect(rows[0]!.text()).toContain('Ada')
    expect(rows[0]!.get('[data-testid="project-pieces"]').text()).toBe('0')
    expect(rows[1]!.text()).not.toContain('Ada')
  })

  it('marks the framed projects and rings the open one', () => {
    const wrapper = mountLibrary({ projects: [first, noFrame(second)], activeProjectId: first.id })
    const rows = wrapper.findAll('[data-testid="project-item"]')
    expect(rows[0]!.find('[data-testid="project-framed"]').exists()).toBe(true)
    expect(rows[1]!.find('[data-testid="project-framed"]').exists()).toBe(false)
    expect(rows[0]!.get('.panel-list-row').classes()).toContain('panel-list-row--active')
    expect(rows[1]!.get('.panel-list-row').classes()).not.toContain('panel-list-row--active')
  })

  it('opens a project on a press and asks to remove it from its ×', async () => {
    const wrapper = mountLibrary()
    const button = wrapper.get(`[data-testid="select-project-${first.id}"]`)
    expect(button.attributes('aria-label')).toBe(summarizeProject(first))
    await button.trigger('click')
    await wrapper.get(`[data-testid="remove-project-${first.id}"]`).trigger('click')
    expect(wrapper.emitted('select')).toEqual([[first.id]])
    expect(wrapper.emitted('remove')).toEqual([[first.id]])
  })

  it('exports all and takes an import, each naming .openbeads', async () => {
    const wrapper = mountLibrary()
    expect(wrapper.get('[data-testid="menu-import"]').text()).toContain('.openbeads')
    await wrapper.get('[data-testid="menu-export-all"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-export-all"]').text()).toContain('.openbeads')
    expect(wrapper.emitted('exportAll')).toHaveLength(1)
  })

  it('says there are none yet, and cannot export', () => {
    const wrapper = mountLibrary({ projects: [] })
    expect(wrapper.get('[data-testid="project-list-empty"]').text()).toContain(en.projects.emptyTitle)
    expect(wrapper.get('[data-testid="project-list-empty"]').text()).toContain('.openbeads')
    expect(wrapper.get('[data-testid="menu-export-all"]').attributes('aria-disabled')).toBe('true')
  })
})

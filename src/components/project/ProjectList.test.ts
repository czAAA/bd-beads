import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectList from './ProjectList.vue'
import ExpandablePanel from '../ui/ExpandablePanel.vue'
import { createProject, summarizeProject, type Project } from '../../domain/project'
import { BEAD_CATALOG } from '../../domain/beads'
import { ru } from '../../i18n/ru'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject() {
  return createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

describe('ProjectList', () => {
  it('says "no Frame" where the size goes for a Project without a Frame', () => {
    const open: Project = { ...makeProject(), frame: undefined }
    const wrapper = mount(ProjectList, { props: { projects: [open] } })

    expect(wrapper.find('.project-list__size').text()).toBe(ru.canvas.noFrame)
  })

  it('still renders its box with an empty message when there are no saved projects (ticket 39: always one of the below-canvas boxes)', () => {
    const wrapper = mount(ProjectList, { props: { projects: [] } })

    expect(wrapper.find('[data-testid="project-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-list-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-item"]').exists()).toBe(false)
  })

  it('marks its own box with the library icon (ticket 188)', () => {
    const wrapper = mount(ProjectList, { props: { projects: [] } })

    expect(wrapper.find('[data-testid="project-list"] .expandable-panel__icon').attributes('data-icon')).toBe('library')
  })

  it('renders one entry per saved project with its name and size, named by its summary', () => {
    const first = makeProject()
    const second = makeProject()
    const wrapper = mount(ProjectList, { props: { projects: [first, second] } })

    const items = wrapper.findAll('[data-testid="project-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain(first.name)
    expect(items[0]!.text()).toContain(`${first.frame!.columns}×${first.frame!.rows}`)
    expect(items[0]!.find(`[data-testid="select-project-${first.id}"]`).attributes('aria-label')).toBe(summarizeProject(first))
    expect(items[1]!.text()).toContain(second.name)
  })

  it('marks the active project as pressed', () => {
    const first = makeProject()
    const second = makeProject()
    const wrapper = mount(ProjectList, {
      props: { projects: [first, second], activeProjectId: second.id },
    })

    expect(wrapper.find(`[data-testid="select-project-${first.id}"]`).attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.find(`[data-testid="select-project-${second.id}"]`).attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('emits select with the project id when an entry is clicked', async () => {
    const project = makeProject()
    const wrapper = mount(ProjectList, { props: { projects: [project] } })

    await wrapper.find(`[data-testid="select-project-${project.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[project.id]])
  })

  it('emits remove with the project id when its remove button is clicked', async () => {
    const project = makeProject()
    const wrapper = mount(ProjectList, { props: { projects: [project] } })

    await wrapper.find(`[data-testid="remove-project-${project.id}"]`).trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[project.id]])
  })

  it('renders the remove button as an icon, with an aria-label conveying its action for screen readers', () => {
    const project = makeProject()
    const wrapper = mount(ProjectList, { props: { projects: [project] } })

    const removeButton = wrapper.find(`[data-testid="remove-project-${project.id}"]`)
    expect(removeButton.text()).toBe('')
    expect(removeButton.find('svg').exists()).toBe(true)
    expect(removeButton.attributes('aria-label')).toBe(
      `${ru.projects.removeButton}: ${summarizeProject(project)}`,
    )
  })
})

describe('ProjectList recent thumbnails (ticket 147)', () => {
  const library = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ ...makeProject(), id: `p${index}`, name: `Project ${index}` }))

  it('shows the five most recently saved, first first, with "5 of 12" in the header', () => {
    const projects = library(12)
    const wrapper = mount(ProjectList, { props: { projects } })

    const items = wrapper.findAll('[data-testid="project-item"]')
    expect(items.map((item) => item.find('.project-list__name').text())).toEqual(projects.slice(0, 5).map((p) => p.name))
    expect(wrapper.find('[data-testid="project-list-meta"]').text()).toMatch(/^5 (of|из) 12$/)
  })

  it('shows every Project once expanded, with the exports under them', async () => {
    const wrapper = mount(ProjectList, { props: { projects: library(12) } })

    await wrapper.find('[data-testid="panel-expand"]').trigger('click')

    expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(12)
    expect(wrapper.find('[data-testid="project-list-meta"]').text()).toMatch(/^12 (of|из) 12$/)
    expect(wrapper.find('[data-testid="export-library"]').exists()).toBe(true)
  })

  it('rings the open Project, and cuts a long name to one line with the full name in a tooltip', async () => {
    const projects = library(2)
    projects[1]!.name = 'A very long Project name indeed'
    const wrapper = mount(ProjectList, { props: { projects, activeProjectId: 'p1' }, attachTo: document.body })

    const open = wrapper.findAll('[data-testid="project-item"]')[1]!
    expect(open.classes()).toContain('project-list__item--active')
    await open.find('[data-testid="select-project-p1"]').trigger('focusin')
    expect(open.find('[data-testid="tooltip"]').text()).toBe('A very long Project name indeed')
  })
})

describe('ProjectList name tooltip (ticket 175)', () => {
  it('turns off the panel’s own overflow clip, so a hovered name’s tooltip is never cut off by the collapsed body', () => {
    const wrapper = mount(ProjectList, { props: { projects: [makeProject(), makeProject()] } })

    expect(wrapper.findComponent(ExpandablePanel).props('clipOverflow')).toBe(false)
  })
})

describe('ProjectList exports (ticket 118)', () => {
  /** The exports sit in the footer the box shows once expanded (ticket 147). */
  async function mountExpanded(props: { projects: Project[]; activeProjectId?: string }) {
    const wrapper = mount(ProjectList, { props })
    await wrapper.find('[data-testid="panel-expand"]').trigger('click')
    return wrapper
  }

  function named(name: string): Project {
    return createProject({
      name,
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  it('asks for the open Project to be exported', async () => {
    const project = named('Fox')
    const wrapper = await mountExpanded({ projects: [project], activeProjectId: project.id })

    await wrapper.find('[data-testid="export-project"]').trigger('click')

    expect(wrapper.emitted('exportProject')).toHaveLength(1)
  })

  it('has no Project to export while none is open, even with some saved', async () => {
    const wrapper = await mountExpanded({ projects: [named('Fox')] })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-project"]').attributes('aria-disabled')).toBe('true')
  })

  it('asks for the whole library to be exported', async () => {
    const library = [named('Fox'), named('Owl')]
    const wrapper = await mountExpanded({ projects: library, activeProjectId: library[0]!.id })

    await wrapper.find('[data-testid="export-library"]').trigger('click')

    expect(wrapper.emitted('exportLibrary')).toHaveLength(1)
  })

  it('has nothing to export while nothing is saved: the empty box has no expand button and no footer', () => {
    const wrapper = mount(ProjectList, { props: { projects: [] } })

    expect(wrapper.find('[data-testid="panel-expand"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-library"]').exists()).toBe(false)
  })

  describe('at the 24″ and larger tier (ticket 83; responsive.md, bp-desktop)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('shows ten thumbnails before expanding, instead of five', () => {
      vi.stubGlobal('matchMedia', fakeMatchMedia({ '(min-width: 1920px)': true }).matchMedia)
      const projects = Array.from({ length: 12 }, makeProject)
      const wrapper = mount(ProjectList, { props: { projects } })

      expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(10)
    })

    it('keeps five below that tier', () => {
      vi.stubGlobal('matchMedia', fakeMatchMedia({ '(min-width: 1920px)': false }).matchMedia)
      const projects = Array.from({ length: 12 }, makeProject)
      const wrapper = mount(ProjectList, { props: { projects } })

      expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(5)
    })
  })
})

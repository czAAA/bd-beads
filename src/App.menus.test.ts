import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { createProject } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openPanel, openSavedProjects } from './testUtils/pill'

/** Menu and Project (spec 0440, ticket 443): one test per control → flow (docs/testing.md, "Assert each behavior at one
 * level only"). What the panels hold is in MenuPanel and ProjectPanel, opening, Back, Escape and focus in AppPanel and
 * useOverlayLayer, the rules in useProjectManageFlow and useNewProjectFlow, and fitting in panelsFit. */

const moth = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 10, height: 10, unit: 'beads' } })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([moth()])
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

const names = () => loadProjects().map((project) => project.name).sort()
const text = (wrapper: ReturnType<typeof mountApp>, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()
const escape = async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await nextTick()
}

describe('Menu', () => {
  it('closes on Escape', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await escape()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('opens the Projects library and New Project as its subpanels, each under its own title', async () => {
    const wrapper = mountApp()
    await openSavedProjects(wrapper)
    expect(text(wrapper, 'panel-sub-title')).toBe(en.projects.heading)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    expect(text(wrapper, 'panel-sub-title')).toBe(en.projects.newProjectButton)
    expect(wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)
  })

  it('deletes every Project after a confirmation, and lands on the empty state; Cancel keeps them', async () => {
    saveProjects([moth(), { ...moth(), id: 'other', name: 'Other' }])
    const wrapper = mountApp()
    await openSavedProjects(wrapper)
    await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-projects-modal"]').exists()).toBe(false)
    expect(loadProjects()).toHaveLength(2)

    await openSavedProjects(wrapper)
    await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toEqual([])
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })

  it('starts a Project from a Starter: a category, an option, and Create puts it in place and closes the panel (ticket 0596)', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await wrapper.get('[data-testid="pick-starter"]').trigger('click')
    await wrapper.get('[data-testid="starter-category-shapes"]').trigger('click')
    await wrapper.get('[data-testid="starter-card-star"]').trigger('click')
    await wrapper.get('[data-testid="create-starter-project"]').trigger('click')
    await flushPromises()

    expect(loadProjects().find((project) => project.name === en.frame.customKinds.star)!.frame).toMatchObject({ kind: 'star' })
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('puts a Starter on the open Project from the Frame panel, and closes the panel (tickets 555, 0596)', async () => {
    const { frame: _frame, ...open } = moth()
    saveProjects([open])
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-frame')
    await wrapper.get('[data-testid="frame-from-starter"]').trigger('click')
    await wrapper.get('[data-testid="starter-category-shapes"]').trigger('click')
    await wrapper.get('[data-testid="starter-card-triangle"]').trigger('click')
    await wrapper.get('[data-testid="create-starter-project"]').trigger('click')
    await flushPromises()

    expect(loadProjects()[0]!.frame).toMatchObject({ kind: 'triangle' })
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('opens on the form by itself with an empty library, and again from the empty-canvas bar button', async () => {
    saveProjects([])
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)

    await escape()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    await wrapper.get('[data-testid="phone-bar-new-project"]').trigger('click')
    expect(wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)
  })
})

describe('Project', () => {
  it('renames from the pencil, and Try again saves what a full storage refused', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    await flushPromises()
    await wrapper.get<HTMLInputElement>('[data-testid="project-name-input"]').setValue('Owl')
    await wrapper.get('[data-testid="project-name-form"]').trigger('submit')
    await flushPromises()
    expect(names()).toEqual(['Moth'])

    setItem.mockRestore()
    await wrapper.get('[data-testid="save-try-again"]').trigger('click')
    await flushPromises()
    expect(names()).toEqual(['Owl'])
    expect(text(wrapper, 'save-state')).toBe(en.panels.project.savedLocal)
  })

  it('duplicates through the popup and opens the copy; Cancel changes nothing', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="duplicate-cancel"]').trigger('click')
    expect(names()).toEqual(['Moth'])

    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="duplicate-confirm"]').trigger('click')
    await flushPromises()

    expect(names()).toEqual(['Moth', 'Moth 2'])
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'project-name')).toBe('Moth 2')
  })

  it('deletes after a confirmation naming the Project, and lands on the empty state; Cancel keeps it', async () => {
    saveProjects([moth(), { ...moth(), id: 'other', name: 'Other' }])
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    const open = text(wrapper, 'project-name')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'delete-project-modal')).toContain(`Delete ${open}?`)
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(loadProjects()).toHaveLength(2)

    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toHaveLength(1)
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })
})

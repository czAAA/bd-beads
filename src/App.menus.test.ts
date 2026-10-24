import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { createProject } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openPanel } from './testUtils/pill'

/** Menu and Project (spec 0440, ticket 443): one happy path per flow; both open as a dropdown on every screen size. */

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

describe('Menu and Project open as a dropdown on every screen size', () => {
  it('opens as a dropdown with no scrim, and swaps one for the other', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')

    expect(wrapper.find('[data-testid="panel-dropdown"]').attributes('role')).toBe('menu')
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.find('[data-testid="project-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="strip-project"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-pressed')).not.toBe('true')
  })

  it('closes on Escape and on a press outside, and gives focus back to the button', async () => {
    const wrapper = mountApp()
    const button = wrapper.get('[data-testid="strip-project"]')
    await button.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)

    await button.trigger('click')
    wrapper.get('[data-testid="app-canvas"]').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('has no fixed height on its rows, so a stacked row is not clipped', async () => {
    const wrapper = mountApp()
    for (const panel of ['strip-menu', 'strip-project'] as const) {
      await openPanel(wrapper, panel)
      for (const row of wrapper.findAll('[data-testid="panel-body"] :is([class*="panel-item"], [class*="setting"], [class*="menu-panel__"], [class*="name-row"], [class*="save-export"]):not(svg)')) expect(row.attributes('style') ?? '').not.toMatch(/(^|;|\s)height:/)
    }
  })
})

describe('Menu', () => {
  it('holds Projects, Preferences, Help and About in that order, with Delete all Projects last in Projects', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')

    const sections = wrapper.findAll('[data-testid="menu-panel"] [role="group"]').filter((group) => group.find('h3').exists())
    expect(sections.map((section) => section.get('h3').text())).toEqual([en.panels.menu.projects, en.panels.menu.preferences, en.panels.menu.help, en.panels.menu.about])
    const projects = sections[0]!.findAll('button, a, label').map((item) => item.text()).filter(Boolean)
    expect(projects[0]).toBe(en.projects.newProjectButton)
    expect(projects.at(-1)).toBe(en.panels.menu.deleteAll)
    expect(text(wrapper, 'menu-export-all')).toContain('.openbeads')
    expect(text(wrapper, 'menu-saved-projects')).toContain('1')
  })

  it('moves the pill from Tools position, applied at once', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')

    await wrapper.get('[data-testid="menu-tools-position"] [data-value="top"]').trigger('click')

    expect(localStorage.getItem('openbeads:tool-pill-position')).toBe('top')
  })

  it('has no Pen/Mouse in the pill, and no Input row in Menu until a pen has been seen', async () => {
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="pill-input-mode"]').exists()).toBe(false)
    await openPanel(wrapper, 'strip-menu')
    expect(wrapper.find('[data-testid="menu-input-mode"]').exists()).toBe(false)
  })

  it('has an Input row once a pen has been seen, where Pen | Mouse is chosen and kept', async () => {
    localStorage.setItem('openbeads:pen-seen', 'yes')
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')

    expect(wrapper.find('[data-testid="menu-input-mode"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-input-mode"] [data-value="mouse"]').trigger('click')
    expect(localStorage.getItem('openbeads:input-mode')).toBe('mouse')
  })

  it('deletes every Project after a confirmation, and lands on the empty state; Cancel keeps them', async () => {
    saveProjects([moth(), { ...moth(), id: 'other', name: 'Other' }])
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    expect(text(wrapper, 'menu-delete-all')).toBe(en.panels.menu.deleteAll)

    await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(text(wrapper, 'delete-all-projects-modal')).toContain(en.panels.menu.deleteAllTitle)
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(loadProjects()).toHaveLength(2)

    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toEqual([])
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })

  it('opens New Project as a subpanel in the Menu, and Back returns to the list with the Project untouched', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    const open = wrapper.get('[data-testid="strip-project"]').text()
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')

    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    expect(text(wrapper, 'panel-sub-title')).toBe(en.projects.newProjectButton)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="strip-project"]').text()).toBe(open)
  })

  it('goes back one level on Escape, then closes', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('creates the Project from the Create button, switches to it and closes the panel', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Heron')
    expect(wrapper.find('[data-testid="create-project"]').exists()).toBe(true)
    await wrapper.get('form.new-project-form').trigger('submit')
    await flushPromises()

    expect(names()).toEqual(['Heron', 'Moth'])
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'project-name')).toBe('Heron')
  })

  it('starts a Project from a Template: a card opens its setup, Back returns to the gallery, Create makes the Frame in place', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    expect(wrapper.find('[data-testid="template-gallery"]').exists()).toBe(true)

    await wrapper.get('[data-testid="template-card-bracelet"]').trigger('click')
    expect(text(wrapper, 'panel-sub-title')).toBe(en.templates.bracelet.name)
    expect(wrapper.find('[data-testid="template-gallery"]').exists()).toBe(false)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="template-gallery"]').exists()).toBe(true)
    expect(text(wrapper, 'panel-sub-title')).toBe(en.projects.newProjectButton)

    await wrapper.get('[data-testid="template-card-bracelet"]').trigger('click')
    await wrapper.get('[data-testid="template-height-preset-100"]').trigger('click')
    await wrapper.get('[data-testid="create-template-project"]').trigger('click')
    await flushPromises()

    expect(names()).toEqual([en.templates.bracelet.name, 'Moth'])
    const made = loadProjects().find((project) => project.name === en.templates.bracelet.name)!
    expect(made.technique).toBe('loom')
    expect(made.frame).toMatchObject({ row: 0, column: 0, columns: 12, rows: 100, beads: {} })
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('discards the draft on Back', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await wrapper.get('[data-testid="name-input"]').setValue('Heron')
    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')

    expect((wrapper.get('[data-testid="name-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('opens Menu on the form with an empty library, Escape closes it, and Back shows the list', async () => {
    saveProjects([])
    const wrapper = mountApp()
    // The empty canvas opens Menu on the form by itself.
    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(true)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-import"]').exists()).toBe(true)

    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('opens Menu on the form by itself when the empty canvas shows', async () => {
    saveProjects([])
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(true)
  })

  it('opens Menu on the form from the empty-canvas bar button', async () => {
    saveProjects([])
    const wrapper = mountApp()
    await wrapper.get('[data-testid="phone-bar-new-project"]').trigger('click')

    expect(wrapper.find('[data-testid="panel-dropdown"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bead-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-dropdown"]').attributes('role')).toBe('dialog')
  })

  it('has no Menu section for the open Project: Project is hidden with none open, and Menu stays', async () => {
    localStorage.clear()
    localStorage.setItem('openbeads:locale', 'en')
    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)
  })
})

describe('Project', () => {
  it('renames from the pencil on Enter, saved at once; an empty name is refused and Escape changes nothing', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'project-name')).toBe('Moth')
    expect(wrapper.get('[data-testid="project-rename"]').attributes('aria-label')).toBe('Rename Moth')

    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>('[data-testid="project-rename-input"]')
    expect(input.attributes('maxlength')).toBe('40')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    await wrapper.get('[data-testid="project-rename-form"]').trigger('submit')
    expect(text(wrapper, 'project-rename-error')).toBe(en.panels.project.nameRequired)
    expect(names()).toEqual(['Moth'])

    await input.setValue('Owl')
    expect(text(wrapper, 'project-rename-form')).toContain('3/40')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('submit')
    await flushPromises()
    expect(names()).toEqual(['Owl'])
    expect(text(wrapper, 'project-name')).toBe('Owl')

    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-testid="project-rename-input"]').setValue('Fox')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('keydown', { key: 'Escape' })
    expect(names()).toEqual(['Owl'])
    expect(text(wrapper, 'project-name')).toBe('Owl')
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(true)
  })

  it('shows the save state: saved, then failed with the reason and Try again', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'save-state')).toBe(en.saveBox.savedState)
    expect(wrapper.get('[data-testid="save-state"]').attributes('aria-live')).toBe('polite')

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    await flushPromises()
    await wrapper.get<HTMLInputElement>('[data-testid="project-rename-input"]').setValue('Owl')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('submit')
    await flushPromises()
    expect(text(wrapper, 'save-state')).toContain('Not saved. ')
    expect(wrapper.find('[data-testid="save-try-again"]').exists()).toBe(true)

    setItem.mockRestore()
    await wrapper.get('[data-testid="save-try-again"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'save-state')).toBe(en.saveBox.savedState)
  })

  it('duplicates through the popup with the suggested name, keeps Row progress and opens the copy; Cancel changes nothing', async () => {
    saveProjects([{ ...moth(), rowProgress: { direction: 'rows', currentRow: 2, currentColumn: 0 } }])
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')

    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    const input = wrapper.get<HTMLInputElement>('[data-testid="duplicate-name-input"]')
    expect(input.element.value).toBe('Moth 2')
    expect(wrapper.get('[data-testid="duplicate-project-modal"]').text()).toContain(en.panels.project.duplicateNote)

    await wrapper.get('[data-testid="duplicate-cancel"]').trigger('click')
    expect(names()).toEqual(['Moth'])

    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="duplicate-confirm"]').trigger('click')
    await flushPromises()

    expect(names()).toEqual(['Moth', 'Moth 2'])
    const copy = loadProjects().find((project) => project.name === 'Moth 2')!
    expect(copy.rowProgress.currentRow).toBe(2)
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'project-name')).toBe('Moth 2')
  })

  it('clears this Project from its own item, after the usual confirmation, and keeps the Project', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    expect(text(wrapper, 'project-clear')).toBe(en.panels.project.clear)

    await wrapper.get('[data-testid="project-clear"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toHaveLength(1)
    expect(Object.keys(loadProjects()[0]!.beads)).toHaveLength(0)
  })

  it('deletes after a confirmation naming the Project, and lands on the empty state', async () => {
    saveProjects([moth(), { ...moth(), id: 'other', name: 'Other' }])
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')
    const open = text(wrapper, 'project-name')

    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await flushPromises()
    const modal = wrapper.get('[data-testid="delete-project-modal"]')
    expect(modal.text()).toContain(`Delete ${open}?`)
    expect(modal.text()).toContain('Export it first')

    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(loadProjects()).toHaveLength(2)

    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toHaveLength(1)
    expect(wrapper.find('[data-testid="project-surface"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })

  it('holds the Canvas color and Position marks, which left the strip, and has no Frame Edit, Fit or Remove', async () => {
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="canvas-color-button"]').exists()).toBe(false)
    await openPanel(wrapper, 'strip-project')

    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('click')
    expect(localStorage.getItem('openbeads:canvas-background')).toBe('2')
    await wrapper.get('[data-testid="position-marks"] [data-value="squares"]').trigger('click')
    expect(localStorage.getItem('openbeads:position-marks')).toBe('squares')
    for (const gone of ['frame-edit', 'frame-fit', 'frame-remove']) expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
  })

  it('sets the Maker\'s name from the row onto this Project', async () => {
    const wrapper = mountApp()
    await openPanel(wrapper, 'strip-project')

    await wrapper.get('[data-testid="maker-name-input"]').setValue('Maria')
    await wrapper.get('[data-testid="maker-name-input"]').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(loadProjects()[0]!.makerName).toBe('Maria')
  })
})

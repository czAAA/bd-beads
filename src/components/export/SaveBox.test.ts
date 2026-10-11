import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveBox from './SaveBox.vue'
import { en } from '../../i18n/en'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

function mountBox(props: Record<string, unknown> = {}) {
  return mount(SaveBox, { props: { saveFailed: false, ...props }, attachTo: document.body })
}

async function openMenu(wrapper: ReturnType<typeof mountBox>) {
  await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
}

describe('SaveBox (ticket 148)', () => {
  it('says the library is saved on this device, with a check', () => {
    const wrapper = mountBox()

    const state = wrapper.find('[data-testid="save-state"]')
    expect(state.text()).toBe(en.saveBox.savedState)
    expect(state.find('[data-icon="check"]').exists()).toBe(true)
    expect(state.classes()).not.toContain('save-box__state--failed')
  })

  it('turns to a danger warning when a save fails', () => {
    const state = mountBox({ saveFailed: true }).find('[data-testid="save-state"]')

    expect(state.text()).toBe(en.saveBox.failedState)
    expect(state.find('[data-icon="warning"]').exists()).toBe(true)
    expect(state.classes()).toContain('save-box__state--failed')
  })

  it('has Save Project as its primary action, naming its shortcut, and asks for a save', async () => {
    const wrapper = mountBox()
    const save = wrapper.find('[data-testid="save-button"]')

    expect(save.text()).toBe(en.saveBox.saveButton)
    expect(save.classes()).toContain('app-button--primary')
    expect(save.attributes('title')).toBeUndefined()
    expect(wrapper.find('[data-testid="save-button"]').element.closest('.app-tooltip')?.textContent).toContain('Ctrl/Cmd+S')
    await save.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('keeps the full name as the Save button\'s accessible name, for when only its icon fits (ticket 231)', () => {
    const save = mountBox().find('[data-testid="save-button"]')

    expect(save.attributes('aria-label')).toBe(en.saveBox.saveButton)
  })

  it('opens the Export menu with PNG image and PDF for printing, and the formats hint beside it', async () => {
    const wrapper = mountBox()
    expect(wrapper.find('[data-testid="export-formats"]').text()).toBe('png · pdf')

    await openMenu(wrapper)

    const items = wrapper.findAll('[role="menuitem"]').map((item) => item.text())
    // Then the name on exports row (ticket 161).
    expect(items).toEqual([en.saveBox.menuPng, en.saveBox.menuPdf, en.saveBox.addName])
  })

  it.each([
    ['export-png', 'export-png'],
    ['export-pdf', 'export-pdf'],
  ])('asks for %s from its menu item, closing the menu', async (testId, event) => {
    const wrapper = mountBox()
    await openMenu(wrapper)

    await wrapper.find(`[data-testid="${testId}"]`).trigger('click')

    expect(wrapper.emitted(event)).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('holds PNG and PDF while one is being drawn', async () => {
    const wrapper = mountBox({ exporting: 'pdf' })
    await openMenu(wrapper)

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-png"]').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-pdf"]').element.disabled).toBe(true)
  })
})

describe('SaveBox without a Frame (ticket 233)', () => {
  it('opens "Set Frame to export" in the menu\'s place, with Fit to drawing and Set Frame', async () => {
    const wrapper = mountBox({ hasFrame: false })
    await openMenu(wrapper)

    const prompt = wrapper.find('[data-testid="export-needs-frame"]')
    expect(prompt.text()).toContain(en.frame.exportPromptTitle)
    expect(prompt.text()).toContain(en.frame.explainer)
    expect(wrapper.find('[data-testid="export-png"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pdf"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="name-on-exports"]').exists()).toBe(false)
    expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(true)
  })

  it('asks for Fit to drawing or Set Frame, and closes the prompt', async () => {
    const wrapper = mountBox({ hasFrame: false })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="export-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toHaveLength(1)
    expect(wrapper.find('[data-testid="export-needs-frame"]').exists()).toBe(false)

    await openMenu(wrapper)
    await wrapper.find('[data-testid="export-set-frame"]').trigger('click')
    expect(wrapper.emitted('set-frame')).toHaveLength(1)
  })

  it('offers the formats as before once there is a Frame', async () => {
    const wrapper = mountBox({ hasFrame: true })
    await openMenu(wrapper)
    expect(wrapper.find('[data-testid="export-needs-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-png"]').exists()).toBe(true)
  })
})
